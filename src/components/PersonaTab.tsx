"use client";

import { useState } from "react";
import { useChatSession } from "@/hooks/useChatSession";
import { SessionSidebar } from "@/components/SessionSidebar";
import { PanelHeader } from "@/components/PanelHeader";
import { ChatMessageList } from "@/components/ChatMessageList";
import { ChatComposer } from "@/components/ChatComposer";
import { exportTranscript, exportJson } from "@/lib/export";

export function PersonaTab() {
  const {
    sessions,
    currentSessionId,
    messages,
    questions,
    loadingSessions,
    sending,
    error,
    createSession,
    selectSession,
    renameSession,
    send,
  } = useChatSession("persona", "/api/persona");

  const [transcript, setTranscript] = useState("");

  const currentTitle =
    sessions.find((s) => s.id === currentSessionId)?.title ?? "New persona interview session";

  const generateQuestions = () => {
    if (!transcript.trim()) return;
    send("Generate the next batch of interview questions based on the transcript so far.", {
      transcript,
      mode: "generate_questions",
    });
  };

  return (
    <div className="flex h-full">
      <SessionSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        loading={loadingSessions}
        onSelect={selectSession}
        onCreate={createSession}
      />

      <div className="flex w-80 flex-col border-r border-border bg-surface shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Live transcript</h3>
          <p className="text-xs text-muted">Paste excerpts from the interview as it happens.</p>
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste live transcription here…"
          className="flex-1 resize-none bg-surface p-3 text-sm text-text placeholder:text-muted focus:outline-none"
        />
        <div className="p-3 border-t border-border">
          <button
            onClick={generateQuestions}
            disabled={sending || !transcript.trim()}
            className="w-full rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 transition-colors text-sm font-medium py-2 text-bg"
          >
            Generate questions
          </button>
          {questions.length > 0 && (
            <button
              onClick={() => exportJson(`${currentTitle}-questions`, questions)}
              className="w-full mt-2 rounded-lg border border-border hover:border-accent text-xs font-medium py-1.5"
            >
              Export questions only ({questions.length} batch{questions.length > 1 ? "es" : ""})
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <PanelHeader
          title={currentTitle}
          subtitle="Persona Interview Copilot — questions + discussion, grounded in transcript & knowledge base"
          onSave={currentSessionId ? renameSession : undefined}
          onExport={
            currentSessionId
              ? () => exportTranscript(currentTitle, messages, questions)
              : undefined
          }
          disabled={!currentSessionId}
        />

        <ChatMessageList
          messages={messages}
          emptyHint="Paste a transcript excerpt on the left, then generate questions, or just discuss what the persona is saying here."
        />

        {error && <p className="px-4 py-1 text-xs text-danger">{error}</p>}

        <ChatComposer
          onSend={(text) => send(text, { transcript, mode: "chat" })}
          disabled={sending}
          placeholder="Discuss the interview, ask follow-ups, or request analysis…"
        />
      </div>
    </div>
  );
}
