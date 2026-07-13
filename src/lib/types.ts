export type ChatTab = "advisor" | "persona";
export type MessageRole = "user" | "assistant" | "system";
export type FileStatus = "uploaded" | "chunking" | "embedding" | "vectorized" | "error";

export type { RagTurnMetadata, RagConfidence, RagEvidenceChunk, ConfidenceLevel } from "./rag-confidence";

export interface ChatSessionRow {
  id: string;
  tab: ChatTab;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
  rag_metadata?: import("./rag-confidence").RagTurnMetadata | null;
}

export interface GeneratedQuestionRow {
  id: string;
  session_id: string;
  content: string;
  created_at: string;
}

export interface UploadedFileRow {
  id: string;
  filename: string;
  gcs_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  status: FileStatus;
  error_message: string | null;
  chunk_count: number | null;
  pinecone_namespace: string | null;
  uploaded_at: string;
  vectorized_at: string | null;
}
