"use client";

import { useCallback, useEffect, useState } from "react";
import { useChatSession } from "@/hooks/useChatSession";
import { useVoiceTranscript } from "@/hooks/useVoiceTranscript";
import { PersonaLeftPanel } from "@/components/PersonaLeftPanel";
import { PanelHeader } from "@/components/PanelHeader";
import { ChatMessageList } from "@/components/ChatMessageList";
import { ChatComposer } from "@/components/ChatComposer";
import { exportTranscript, exportJson } from "@/lib/export";
import { combinePersonaTranscript } from "@/lib/persona-transcript";

export function PersonaTab() {
  const {
    sessions,
    currentSessionId,
    messages,
    questions,
    liveTranscripts,
    loadingSessions,
    sending,
    savingTranscript,
    error,
    createSession,
    selectSession,
    renameSession,
    deleteSession,
    saveLiveTranscript,
    deleteLiveTranscript,
    send,
  } = useChatSession("persona", "/api/persona");

  const [transcript, setTranscript] = useState("");
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [renameFocusSessionId, setRenameFocusSessionId] = useState<string | null>(null);
  const [headerRenameFocus, setHeaderRenameFocus] = useState(false);

  useEffect(() => {
    setTranscript("");
    setSelectedTranscriptId(null);
  }, [currentSessionId]);

  const appendTranscript = useCallback((text: string) => {
    setSelectedTranscriptId(null);
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
    sessions.find((s) => s.id === currentSessionId)?.title ?? "New Segment";

  const combinedTranscript = combinePersonaTranscript(liveTranscripts, transcript);

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

  const handleSave = async () => {
    if (!transcript.trim()) return;
    const saved = await saveLiveTranscript(transcript);
    if (saved) {
      setSelectedTranscriptId(saved.id);
    }
  };

  const handleSelectTranscript = (id: string) => {
    const item = liveTranscripts.find((t) => t.id === id);
    if (!item) return;
    setSelectedTranscriptId(id);
    setTranscript(item.content);
  };

  const handleDeleteTranscript = async (id: string) => {
    await deleteLiveTranscript(id);
    if (selectedTranscriptId === id) {
      setSelectedTranscriptId(null);
      setTranscript("");
    }
  };

  return (
    <div className="flex h-full">
      <PersonaLeftPanel
        sessions={sessions}
        currentSessionId={currentSessionId}
        loading={loadingSessions}
        liveTranscripts={liveTranscripts}
        selectedTranscriptId={selectedTranscriptId}
        onSelect={selectSession}
        onCreate={handleCreateSession}
        onRename={handleSidebarRename}
        onDelete={deleteSession}
        onSelectTranscript={handleSelectTranscript}
        onDeleteTranscript={handleDeleteTranscript}
        renameSessionId={renameFocusSessionId}
        onRenameFocusHandled={() => setRenameFocusSessionId(null)}
      />

      <div className="flex w-80 flex-col border-r border-border bg-surface shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Life Transcript</h3>
          <p className="text-xs text-muted mt-0.5">
            Record with the microphone or paste text from an external transcriber, then Save.
          </p>
        </div>
        <textarea
          value={transcript}
          onChange={(e) => {
            setSelectedTranscriptId(null);
            setTranscript(e.target.value);
          }}
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
            onClick={handleSave}
            disabled={savingTranscript || !transcript.trim()}
            className="w-full rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 transition-colors text-sm font-medium py-2 text-bg"
          >
            {savingTranscript ? "Saving…" : "Save"}
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
          emptyHint="Save a Life Transcript for this segment, then chat based on the transcription."
        />

        {error && <p className="px-4 py-1 text-xs text-danger">{error}</p>}

        <ChatComposer
          onSend={(text) =>
            send(text, {
              transcript: combinedTranscript || undefined,
              mode: "chat",
            })
          }
          disabled={sending}
          placeholder="Chat based on transcription"
        />
      </div>
    </div>
  );
}
