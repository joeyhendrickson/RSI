import { embedChunksInBatches } from "./embed-batch";
import { downloadFileFromGcs } from "./gcs";
import { extractText } from "./extract-text";
import { chunkText } from "./chunk";
import { getPineconeIndex, KnowledgeChunkMetadata } from "./pinecone";
import { supabaseAdmin } from "./supabase";
import type { UploadedFileRow } from "./types";

const NAMESPACE = "knowledge-base";

export interface VectorizeResult {
  ok: boolean;
  file?: UploadedFileRow;
  error?: string;
}

/**
 * Runs the full GCS -> extract -> chunk -> embed -> Pinecone pipeline for a
 * single tracked file, updating its status in Supabase along the way.
 * Shared by the manual "Vectorize" button and the bucket sync action.
 */
export async function vectorizeFile(fileId: string): Promise<VectorizeResult> {
  const db = supabaseAdmin();

  const { data: fileRow, error: fetchError } = await db
    .from("uploaded_files")
    .select("*")
    .eq("id", fileId)
    .single();

  if (fetchError || !fileRow) {
    return { ok: false, error: "File not found" };
  }

  try {
    await db.from("uploaded_files").update({ status: "chunking" }).eq("id", fileId);

    const buffer = await downloadFileFromGcs(fileRow.gcs_path);
    const text = await extractText(buffer, fileRow.filename, fileRow.mime_type ?? undefined);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("No extractable text found in file");
    }

    await db.from("uploaded_files").update({ status: "embedding" }).eq("id", fileId);

    const embeddings = await embedChunksInBatches(chunks);

    const vectors = chunks.map((chunk, i) => ({
      id: `${fileId}-${i}`,
      values: embeddings[i],
      metadata: {
        text: chunk,
        filename: fileRow.filename,
        fileId,
        chunkIndex: i,
      } satisfies KnowledgeChunkMetadata,
    }));

    const index = getPineconeIndex();
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      await index.namespace(NAMESPACE).upsert({ records: vectors.slice(i, i + batchSize) });
    }

    const { data: updated } = await db
      .from("uploaded_files")
      .update({
        status: "vectorized",
        chunk_count: chunks.length,
        pinecone_namespace: NAMESPACE,
        vectorized_at: new Date().toISOString(),
      })
      .eq("id", fileId)
      .select("*")
      .single();

    return { ok: true, file: updated ?? undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vectorization failed";
    await db
      .from("uploaded_files")
      .update({ status: "error", error_message: message })
      .eq("id", fileId);
    return { ok: false, error: message };
  }
}
