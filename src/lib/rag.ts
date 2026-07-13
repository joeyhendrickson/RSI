import { embed } from "ai";
import { embeddingModel, embeddingProviderOptions } from "./ai";
import { getPineconeIndex } from "./pinecone";

export interface RetrievedChunk {
  text: string;
  filename: string;
  score: number;
}

export async function retrieveContext(
  query: string,
  topK = 6
): Promise<RetrievedChunk[]> {
  const { embedding } = await embed({
    model: embeddingModel(),
    value: query,
    providerOptions: embeddingProviderOptions(),
  });

  const index = getPineconeIndex();
  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
  });

  return (results.matches ?? []).map((match) => ({
    text: (match.metadata?.text as string) ?? "",
    filename: (match.metadata?.filename as string) ?? "unknown",
    score: match.score ?? 0,
  }));
}

export function formatContextForPrompt(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant knowledge base context was found for this query.";
  }
  return chunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1} — ${chunk.filename} (relevance ${chunk.score.toFixed(2)})]\n${chunk.text}`
    )
    .join("\n\n");
}
