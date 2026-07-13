import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import type { Database } from "./database.types";

export type {
  ChatTab,
  MessageRole,
  FileStatus,
  ChatSessionRow,
  ChatMessageRow,
  GeneratedQuestionRow,
  UploadedFileRow,
} from "./types";

// Server-only client authenticated with the service_role key. This bypasses
// Row Level Security, so it must never be imported into client components.
let client: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseAdmin() {
  if (!client) {
    client = createClient<Database>(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
      auth: { persistSession: false },
    });
  }
  return client;
}
