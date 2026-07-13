import { NextRequest } from "next/server";
import { streamText } from "ai";
import { chatModel } from "@/lib/ai";
import { retrieveContextAgentic } from "@/lib/rag-agentic";
import { formatContextForPrompt } from "@/lib/rag";
import {
  buildRagTurnMetadata,
  encodeRagMetadataLine,
} from "@/lib/rag-confidence";
import { supabaseAdmin } from "@/lib/supabase";

const SYSTEM_PROMPT = `You are the Sing Creative Advisor — an expert internal assistant for Renaissance Services staff working in Microsoft Dynamics 365 Business Central.

You help with:
- Answering questions about Business Central processes, workflows, and the specific personas/users documented in the knowledge base
- Answering questions about RSI's actual Business Central configuration using direct table exports in the knowledge base (Excel files such as Chart of Accounts, Dimensions, Vendors, Customers, Items, Payment Terms, journal batches, and related setup/master data)
- Designing and describing process flow charts for Business Central users (you can describe flows in clear numbered steps, and the user can request a generated diagram image separately)
- General consulting/advisory discussion grounded in the uploaded knowledge base

The knowledge base includes BOTH narrative documents (PowerPoint, PDF, Word, transcripts) AND direct Business Central table exports (Excel/CSV-style rows with column headers). When you see sections labeled "Business Central table export", treat them as authoritative setup/master data from RSI's BC environment — including chart of accounts, posting groups, dimensions, vendors, customers, items, and other configuration records.

Ground your answers in the provided knowledge base context when it's relevant. When retrieved context includes an **Answer focus** header and RSI-specific sources (org chart, BC Implementation Plan, BC table exports), answer directly and specifically from those sources — do not hedge with broad Business Central generalizations or disclaimers about lacking detail.

When the context includes RSI organization charts, transcripts, or role lists, prefer specific people, titles, and departments named there over generic Business Central role descriptions.

Org chart excerpts often list a person's name on one line and their title/department on the next — read them together. When an org chart excerpt shows a department (e.g. "Controller & Accounting") with a person's name (e.g. "Bob Fugazzi"), state that person as the RSI owner/lead for that function. Do not claim no specific person is named if the org chart excerpt includes one.

RSI department names on the org chart may differ from casual terms — e.g. "Operations" maps to **Operations & PERFECT-3D** (not a standalone Operations box), manufacturing maps to **Manufacturing & Quality Engineering**. When asked who leads Operations, answer with the Operations & PERFECT-3D lead from the org chart. When the context includes a parsed "RSI org chart — named functional leads" summary at the top, treat it as authoritative and cite those names directly.

PowerPoint excerpts are labeled by slide; spreadsheet excerpts are labeled by BC table export. Synthesize across all retrieved sources before answering. Prefer the RSI Org Chart over implementation-plan vendor assignments when the question is about who leads a function at RSI today. When the question is about what vendor/partner RSI hired for Business Central implementation, answer from the BC Implementation Plan — **Dexpro** is the implementation partner (not entries in Vendors.xlsx, which are supplier master records).

Do NOT claim the knowledge base only provides high-level process/ownership views if the retrieved context includes BC table exports, org chart names/titles, account numbers, posting groups, dimension codes, vendor/customer records, or other detailed configuration data. Quote specific values from those exports when answering setup questions.

When the Answer focus instructs you to use a specific source type, do not dilute the answer with unrelated ERP overview material that may appear in the context. Be direct: state the answer first, then cite the supporting source file.

If the context truly doesn't cover something, say so clearly rather than guessing, and answer from general Business Central expertise instead. Be concise, structured, and practical. Cite which source file (and slide or BC table export when available) supports key facts.`;

export async function POST(request: NextRequest) {
  const { sessionId, message } = await request.json();

  if (!sessionId || !message) {
    return new Response(JSON.stringify({ error: "sessionId and message are required" }), {
      status: 400,
    });
  }

  const db = supabaseAdmin();

  const [{ data: priorMessages }, agenticResult] = await Promise.all([
    db
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    retrieveContextAgentic(message),
  ]);

  const { chunks: contextChunks, passes, strategy, passLog } = agenticResult;

  await db.from("chat_messages").insert({ session_id: sessionId, role: "user", content: message });

  const ragMetadata = buildRagTurnMetadata(message, contextChunks, {
    strategy,
    passes,
    passLog,
  });
  const context = formatContextForPrompt(contextChunks, message);

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
