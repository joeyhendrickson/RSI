"use client";

import type { MouseEvent } from "react";
import type { PersonaLiveTranscriptRow } from "@/lib/types";
import { SessionSidebar } from "@/components/SessionSidebar";
import type { ChatSessionRow } from "@/lib/types";

interface Props {
  sessions: ChatSessionRow[];
  currentSessionId: string | null;
  loading: boolean;
  liveTranscripts: PersonaLiveTranscriptRow[];
  selectedTranscriptId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (sessionId: string, title: string) => void;
  onDelete: (sessionId: string) => void;
  onSelectTranscript: (id: string) => void;
  onDeleteTranscript: (id: string) => void;
  renameSessionId?: string | null;
  onRenameFocusHandled?: () => void;
}

function formatTranscriptTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PersonaLeftPanel({
  sessions,
  currentSessionId,
  loading,
  liveTranscripts,
  selectedTranscriptId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onSelectTranscript,
  onDeleteTranscript,
  renameSessionId,
  onRenameFocusHandled,
}: Props) {
  const handleDeleteTranscript = (item: PersonaLiveTranscriptRow, e: MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Delete this Live Transcription from ${formatTranscriptTime(item.created_at)}?`
      )
    ) {
      return;
    }
    onDeleteTranscript(item.id);
  };

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-surface shrink-0">
      <div className="max-h-[42%] min-h-0 flex flex-col border-b border-border">
        <SessionSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          loading={loading}
          onSelect={onSelect}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
          renameSessionId={renameSessionId}
          onRenameFocusHandled={onRenameFocusHandled}
          createButtonLabel="+ New Segment"
          defaultTitle="New Segment"
          entityLabel="segment"
          loadingLabel="Loading segments…"
          emptyLabel="No segments yet."
          hintText="Name in header or double-click to rename. Hover to delete."
          embedded
        />
      </div>

      <div className="flex flex-1 min-h-0 flex-col">
        <div className="px-3 py-2 border-b border-border shrink-0">
          <h3 className="text-xs font-semibold text-text">Saved Live Transcriptions</h3>
          <p className="text-[10px] text-muted mt-0.5 leading-snug">
            Saved from the Life Transcript panel for this segment.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {!currentSessionId && (
            <p className="text-xs text-muted px-2 py-1">Select or create a segment.</p>
          )}
          {currentSessionId && liveTranscripts.length === 0 && (
            <p className="text-xs text-muted px-2 py-1">No saved transcriptions yet.</p>
          )}
          {liveTranscripts.map((item) => (
            <div key={item.id} className="group flex items-start gap-0.5">
              <button
                type="button"
                onClick={() => onSelectTranscript(item.id)}
                className={`min-w-0 flex-1 rounded-md px-2 py-2 text-left transition-colors ${
                  selectedTranscriptId === item.id
                    ? "bg-accent-soft text-accent-hover"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <p className="text-xs font-medium truncate">Live Transcription</p>
                <p className="text-[10px] text-muted mt-0.5">
                  {formatTranscriptTime(item.created_at)}
                </p>
              </button>
              <button
                type="button"
                onClick={(e) => handleDeleteTranscript(item, e)}
                className="shrink-0 rounded-md p-1.5 text-muted opacity-0 transition-opacity hover:bg-danger/10 hover:text-danger group-hover:opacity-100 focus:opacity-100"
                aria-label={`Delete Live Transcription from ${formatTranscriptTime(item.created_at)}`}
                title="Delete saved transcription"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
