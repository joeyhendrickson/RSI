import { NextRequest } from "next/server";
import { streamText } from "ai";
import { chatModel } from "@/lib/ai";
import { retrieveContext, formatContextForPrompt } from "@/lib/rag";
import { supabaseAdmin } from "@/lib/supabase";

const BASE_SYSTEM_PROMPT = `You are the Sing Creative Advisor's Persona Interview Copilot. You support live persona interviews conducted with Business Central users at Renaissance Services.

You have access to:
1. A live transcript excerpt from the current interview (pasted by the interviewer in real time)
2. A knowledge base of documentation about Business Central processes and the personas/users being interviewed

You do two things:
- When asked to investigate or generate questions, analyze the transcript against the knowledge base: summarize key themes, flag gaps or inconsistencies versus documented RSI processes, and produce a focused, numbered list of sharp follow-up questions tied to specifics from the transcript and context.
- When asked to discuss, act as a thinking partner: analyze what the persona has said, flag inconsistencies or gaps versus the documented process, and suggest angles to explore — in normal conversational form, not just questions.`;

export async function POST(request: NextRequest) {
  const { sessionId, message, transcript, mode } = await request.json();

  if (!sessionId || !message) {
    return new Response(JSON.stringify({ error: "sessionId and message are required" }), {
      status: 400,
    });
  }

  const db = supabaseAdmin();

  const ragQuery = transcript ? `${transcript}\n\n${message}` : message;

  const [{ data: priorMessages }, contextChunks] = await Promise.all([
    db
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    retrieveContext(ragQuery),
  ]);

  await db.from("chat_messages").insert({ session_id: sessionId, role: "user", content: message });

  const context = formatContextForPrompt(contextChunks);
  const transcriptBlock = transcript
    ? `Live interview transcript (most recent excerpt):\n"""\n${transcript}\n"""`
    : "No transcript has been pasted yet for this session.";

  const isGeneratingQuestions =
    mode === "generate_questions" || mode === "investigate";

  const result = streamText({
    model: chatModel(),
    system: `${BASE_SYSTEM_PROMPT}\n\n${transcriptBlock}\n\nKnowledge base context:\n${context}\n\nCurrent request mode: ${
      mode === "investigate"
        ? "INVESTIGATE — summarize transcript themes, compare to knowledge base, list grounded follow-ups"
        : isGeneratingQuestions
          ? "GENERATE QUESTIONS"
          : "DISCUSS"
    }`,
    messages: [
      ...(priorMessages ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: message },
    ],
    onFinish: async ({ text }) => {
      await db.from("chat_messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: text,
      });
      if (isGeneratingQuestions) {
        await db.from("generated_questions").insert({
          session_id: sessionId,
          content: text,
        });
      }
    },
  });

  return result.toTextStreamResponse();
}
