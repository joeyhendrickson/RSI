import { NextRequest } from "next/server";
import { streamText } from "ai";
import { chatModel } from "@/lib/ai";
import { retrieveContext, formatContextForPrompt } from "@/lib/rag";
import {
  buildRagTurnMetadata,
  encodeRagMetadataLine,
} from "@/lib/rag-confidence";
import { supabaseAdmin } from "@/lib/supabase";

const SYSTEM_PROMPT = `You are the Sing Creative Advisor — an expert internal assistant for Renaissance Services staff working in Microsoft Dynamics 365 Business Central.

You help with:
- Answering questions about Business Central processes, workflows, and the specific personas/users documented in the knowledge base
- Designing and describing process flow charts for Business Central users (you can describe flows in clear numbered steps, and the user can request a generated diagram image separately)
- General consulting/advisory discussion grounded in the uploaded knowledge base

Ground your answers in the provided knowledge base context when it's relevant. If the context doesn't cover something, say so clearly rather than guessing, and answer from general Business Central expertise instead. Be concise, structured, and practical.`;

export async function POST(request: NextRequest) {
  const { sessionId, message } = await request.json();

  if (!sessionId || !message) {
    return new Response(JSON.stringify({ error: "sessionId and message are required" }), {
      status: 400,
    });
  }

  const db = supabaseAdmin();

  const [{ data: priorMessages }, contextChunks] = await Promise.all([
    db
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    retrieveContext(message),
  ]);

  await db.from("chat_messages").insert({ session_id: sessionId, role: "user", content: message });

  const ragMetadata = buildRagTurnMetadata(message, contextChunks);
  const context = formatContextForPrompt(contextChunks);

  const result = streamText({
    model: chatModel(),
    system: `${SYSTEM_PROMPT}\n\nKnowledge base context:\n${context}`,
    messages: [
      ...(priorMessages ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: message },
    ],
    onFinish: async ({ text }) => {
      await db.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: text,
        rag_metadata: ragMetadata,
      });
    },
  });

  const textStream = result.textStream;
  const metadataLine = encodeRagMetadataLine(ragMetadata);

  const combined = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(metadataLine));
      try {
        for await (const chunk of textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "The chat model failed to respond";
        controller.enqueue(
          encoder.encode(
            `Sorry — I couldn't generate a response. ${message}\n\nIf this persists, verify \`OPENAI_CHAT_MODEL\` (currently \`${process.env.OPENAI_CHAT_MODEL ?? "gpt-5.5"}\`) and your OpenAI API access.`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(combined, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
