import { embedMany } from "ai";
import { embeddingModel, embeddingProviderOptions } from "./ai";

/** OpenAI embeddings API allows up to 300k tokens per request. */
const MAX_CHUNKS_PER_BATCH = 40;

export async function embedChunksInBatches(chunks: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += MAX_CHUNKS_PER_BATCH) {
    const batch = chunks.slice(i, i + MAX_CHUNKS_PER_BATCH);
    const { embeddings } = await embedMany({
      model: embeddingModel(),
      values: batch,
      providerOptions: embeddingProviderOptions(),
    });
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
