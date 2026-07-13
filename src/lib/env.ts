function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  openaiApiKey: () => required("OPENAI_API_KEY"),
  openaiChatModel: () => process.env.OPENAI_CHAT_MODEL ?? "gpt-5.5",
  openaiEmbeddingModel: () =>
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-large",
  // Must match the dimension the Pinecone index was created with.
  openaiEmbeddingDimensions: () =>
    Number(process.env.OPENAI_EMBEDDING_DIMENSIONS ?? "1024"),
  openaiImageModel: () => process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
  // Vision model for OCR / screenshot text extraction during vectorization.
  openaiVisionModel: () =>
    process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_CHAT_MODEL ?? "gpt-5.5",

  pineconeApiKey: () => required("PINECONE_API_KEY"),
  pineconeIndexName: () => process.env.PINECONE_INDEX_NAME ?? "rsi",
  pineconeHost: () => process.env.PINECONE_HOST,

  gcsBucketName: () => required("GCS_BUCKET_NAME"),
  gcpProjectId: () => required("GCP_PROJECT_ID"),
  gcpServiceAccountKey: () => required("GCP_SERVICE_ACCOUNT_KEY"),

  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
};
