import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env";

let pineconeClient: Pinecone | null = null;

function getPinecone(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: env.pineconeApiKey() });
  }
  return pineconeClient;
}

export function getPineconeIndex() {
  const pc = getPinecone();
  const host = env.pineconeHost();
  // Targeting by host avoids an extra describe_index lookup on every request.
  return host
    ? pc.index(env.pineconeIndexName(), host)
    : pc.index(env.pineconeIndexName());
}

export interface KnowledgeChunkMetadata {
  text: string;
  filename: string;
  fileId: string;
  chunkIndex: number;
  [key: string]: string | number | boolean;
}
