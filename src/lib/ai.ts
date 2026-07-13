import { createOpenAI } from "@ai-sdk/openai";
import { env } from "./env";

let openaiProvider: ReturnType<typeof createOpenAI> | null = null;

function getOpenAI() {
  if (!openaiProvider) {
    openaiProvider = createOpenAI({ apiKey: env.openaiApiKey() });
  }
  return openaiProvider;
}

export function chatModel() {
  return getOpenAI().chat(env.openaiChatModel());
}

export function visionModel() {
  return getOpenAI().chat(env.openaiVisionModel());
}

export function embeddingModel() {
  return getOpenAI().embedding(env.openaiEmbeddingModel());
}

// text-embedding-3-large/small support truncating output dimensions via
// this provider option — must match the Pinecone index's configured dimension.
export function embeddingProviderOptions() {
  return { openai: { dimensions: env.openaiEmbeddingDimensions() } };
}

export function imageModel() {
  return getOpenAI().image(env.openaiImageModel());
}
