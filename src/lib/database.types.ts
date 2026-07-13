import type { ChatTab, FileStatus, MessageRole } from "./types";
import type { RagTurnMetadata } from "./rag-confidence";

export interface Database {
  public: {
    Tables: {
      chat_sessions: {
        Row: {
          id: string;
          tab: ChatTab;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tab: ChatTab;
          title?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_sessions"]["Insert"]>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: MessageRole;
          content: string;
          created_at: string;
          rag_metadata: RagTurnMetadata | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: MessageRole;
          content: string;
          created_at?: string;
          rag_metadata?: RagTurnMetadata | null;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };
      generated_questions: {
        Row: {
          id: string;
          session_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          content: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["generated_questions"]["Insert"]>;
        Relationships: [];
      };
      uploaded_files: {
        Row: {
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
        };
        Insert: {
          id?: string;
          filename: string;
          gcs_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          status?: FileStatus;
          error_message?: string | null;
          chunk_count?: number | null;
          pinecone_namespace?: string | null;
          uploaded_at?: string;
          vectorized_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["uploaded_files"]["Insert"]>;
        Relationships: [];
      };
      flow_charts: {
        Row: {
          id: string;
          session_id: string | null;
          prompt: string;
          image_url: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id?: string | null;
          prompt: string;
          image_url: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["flow_charts"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
