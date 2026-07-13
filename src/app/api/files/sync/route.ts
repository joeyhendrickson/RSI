import { NextResponse } from "next/server";
import { listGcsFiles } from "@/lib/gcs";
import { supabaseAdmin } from "@/lib/supabase";
import { vectorizeFile } from "@/lib/vectorize";

export async function POST() {
  const db = supabaseAdmin();

  const [gcsFiles, { data: tracked, error: trackedError }] = await Promise.all([
    listGcsFiles(),
    db.from("uploaded_files").select("gcs_path"),
  ]);

  if (trackedError) {
    return NextResponse.json({ error: trackedError.message }, { status: 500 });
  }

  const trackedPaths = new Set((tracked ?? []).map((f) => f.gcs_path));

  const newRows = gcsFiles
    .filter((file) => !file.name.endsWith("/") && !trackedPaths.has(file.name))
    .map((file) => {
      const filename = file.name.split("/").pop() || file.name;
      const size = file.metadata?.size ? Number(file.metadata.size) : null;
      return {
        filename,
        gcs_path: file.name,
        mime_type: file.metadata?.contentType ?? null,
        size_bytes: size,
        status: "uploaded" as const,
        uploaded_at: file.metadata?.timeCreated ?? new Date().toISOString(),
      };
    });

  if (newRows.length === 0) {
    return NextResponse.json({ added: 0, vectorized: 0, failed: 0, files: [] });
  }

  const { data: inserted, error } = await db.from("uploaded_files").insert(newRows).select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // This is the "sync straight into the knowledge base" step: every newly
  // discovered file is chunked, embedded, and upserted into Pinecone right away.
  // Vectorize one file at a time to avoid OpenAI rate/token limits during bulk sync.
  const results = [];
  for (const file of inserted ?? []) {
    results.push({ file, result: await vectorizeFile(file.id) });
  }

  const vectorized = results.filter((r) => r.result.ok).length;
  const failed = results.length - vectorized;

  return NextResponse.json({
    added: inserted?.length ?? 0,
    vectorized,
    failed,
    files: results.map((r) => r.result.file ?? r.file),
  });
}
