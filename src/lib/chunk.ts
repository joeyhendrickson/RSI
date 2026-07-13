export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

/**
 * Splits text into overlapping chunks, preferring paragraph/sentence
 * boundaries near the target size so embeddings aren't cut mid-thought.
 */
export function chunkText(
  text: string,
  { chunkSize = 1200, overlap = 200 }: ChunkOptions = {}
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const window = normalized.slice(start, end);
      const boundary = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("\n")
      );
      if (boundary > chunkSize * 0.5) {
        end = start + boundary + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
