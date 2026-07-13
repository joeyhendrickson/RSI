"use client";

import { useCallback, useState } from "react";
import { useChatSession } from "@/hooks/useChatSession";
import { useVoiceTranscript } from "@/hooks/useVoiceTranscript";
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
  const [renameFocusSessionId, setRenameFocusSessionId] = useState<string | null>(null);
  const [headerRenameFocus, setHeaderRenameFocus] = useState(false);

  const appendTranscript = useCallback((text: string) => {
    setTranscript((prev) => {
      const trimmed = text.trim();
      if (!trimmed) return prev;
      if (!prev.trim()) return trimmed;
      return `${prev.trimEnd()}\n\n${trimmed}`;
    });
  }, []);

  const {
    recording,
    transcribing,
    error: voiceError,
    toggleRecording,
    supported: micSupported,
  } = useVoiceTranscript(appendTranscript);

  const currentTitle =
    sessions.find((s) => s.id === currentSessionId)?.title ?? "New session";

  const handleCreateSession = async () => {
    const session = await createSession();
    if (session?.id) {
      setRenameFocusSessionId(session.id);
      setHeaderRenameFocus(true);
    }
  };

  const handleRename = (title: string) => {
    if (currentSessionId) renameSession(title, currentSessionId);
  };

  const handleSidebarRename = (sessionId: string, title: string) => {
    renameSession(title, sessionId);
  };

  const investigate = () => {
    if (!transcript.trim()) return;
    send(
      "Investigate this interview transcript against the knowledge base. Summarize what the persona has revealed, flag gaps or inconsistencies versus documented RSI processes, and list specific follow-up angles grounded in the knowledge base.",
      {
        transcript,
        mode: "investigate",
      }
    );
  };

  return (
    <div className="flex h-full">
      <SessionSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        loading={loadingSessions}
        onSelect={selectSession}
        onCreate={handleCreateSession}
        onRename={handleSidebarRename}
        renameSessionId={renameFocusSessionId}
        onRenameFocusHandled={() => setRenameFocusSessionId(null)}
      />

      <div className="flex w-80 flex-col border-r border-border bg-surface shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Live transcript</h3>
          <p className="text-xs text-muted mt-0.5">
            Record with the microphone or paste text from an external transcriber.
          </p>
        </div>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste or dictate live transcription here…"
          className="flex-1 resize-none bg-surface p-3 text-sm text-text placeholder:text-muted focus:outline-none"
        />
        <div className="p-3 border-t border-border space-y-2">
          {micSupported ? (
            <button
              type="button"
              onClick={toggleRecording}
              disabled={transcribing}
              className={`w-full rounded-lg border transition-colors text-sm font-medium py-2 px-3 ${
                recording
                  ? "border-danger bg-danger/10 text-danger animate-pulse"
                  : "border-border hover:border-accent hover:text-accent-hover text-text"
              } disabled:opacity-40`}
            >
              {transcribing
                ? "Transcribing…"
                : recording
                  ? "■ Stop recording"
                  : "🎤 Record with microphone"}
            </button>
          ) : (
            <p className="text-xs text-muted text-center">
              Microphone not available in this browser.
            </p>
          )}
          {voiceError && <p className="text-xs text-danger">{voiceError}</p>}
          <button
            onClick={investigate}
            disabled={sending || !transcript.trim()}
            className="w-full rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 transition-colors text-sm font-medium py-2 text-bg"
          >
            Investigate
          </button>
          {questions.length > 0 && (
            <button
              onClick={() => exportJson(`${currentTitle}-questions`, questions)}
              className="w-full rounded-lg border border-border hover:border-accent text-xs font-medium py-1.5"
            >
              Export questions only ({questions.length} batch
              {questions.length > 1 ? "es" : ""})
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <PanelHeader
          title={currentTitle}
          subtitle="Persona Interview Copilot"
          onSave={currentSessionId ? handleRename : undefined}
          autoFocusRename={headerRenameFocus}
          onRenameFocusHandled={() => setHeaderRenameFocus(false)}
          onExport={
            currentSessionId
              ? () => exportTranscript(currentTitle, messages, questions)
              : undefined
          }
          disabled={!currentSessionId}
        />

        <ChatMessageList
          messages={messages}
          emptyHint="Add a live transcript on the left, then use Investigate or chat based on the transcription."
        />

        {error && <p className="px-4 py-1 text-xs text-danger">{error}</p>}

        <ChatComposer
          onSend={(text) => send(text, { transcript, mode: "chat" })}
          disabled={sending}
          placeholder="Chat based on transcription"
        />
      </div>
    </div>
  );
}
