"use client";

import type { ChatSessionRow } from "@/lib/types";

interface Props {
  sessions: ChatSessionRow[];
  currentSessionId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function SessionSidebar({ sessions, currentSessionId, loading, onSelect, onCreate }: Props) {
  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-surface shrink-0">
      <div className="p-3 border-b border-border">
        <button
          onClick={onCreate}
          className="w-full rounded-lg bg-accent hover:bg-accent-hover transition-colors text-sm font-medium py-2 px-3 text-bg"
        >
          + New session
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <p className="text-xs text-muted px-2 py-1">Loading sessions…</p>
        )}
        {!loading && sessions.length === 0 && (
          <p className="text-xs text-muted px-2 py-1">No sessions yet.</p>
        )}
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left rounded-md px-2 py-2 text-sm truncate transition-colors ${
              s.id === currentSessionId
                ? "bg-accent-soft text-accent-hover"
                : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
            title={s.title}
          >
            {s.title || "Untitled session"}
          </button>
        ))}
      </div>
    </div>
  );
}
