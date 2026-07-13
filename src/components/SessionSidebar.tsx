"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { ChatSessionRow } from "@/lib/types";

interface Props {
  sessions: ChatSessionRow[];
  currentSessionId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename?: (sessionId: string, title: string) => void;
  /** Session id to start inline rename for (e.g. newly created). */
  renameSessionId?: string | null;
  onRenameFocusHandled?: () => void;
}

export function SessionSidebar({
  sessions,
  currentSessionId,
  loading,
  onSelect,
  onCreate,
  onRename,
  renameSessionId,
  onRenameFocusHandled,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!renameSessionId || !onRename) return;
    const session = sessions.find((s) => s.id === renameSessionId);
    if (!session) return;
    setEditingId(renameSessionId);
    setEditValue(session.title || "New session");
    onRenameFocusHandled?.();
  }, [renameSessionId, sessions, onRename, onRenameFocusHandled]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const commitRename = (sessionId: string, fallbackTitle: string) => {
    const trimmed = editValue.trim();
    setEditingId(null);
    if (!onRename) return;
    if (trimmed && trimmed !== fallbackTitle) {
      onRename(sessionId, trimmed);
    }
  };

  const startEdit = (session: ChatSessionRow, e: MouseEvent) => {
    e.stopPropagation();
    if (!onRename) return;
    setEditingId(session.id);
    setEditValue(session.title || "New session");
  };

  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-surface shrink-0">
      <div className="p-3 border-b border-border">
        <button
          onClick={onCreate}
          className="w-full rounded-lg bg-accent hover:bg-accent-hover transition-colors text-sm font-medium py-2 px-3 text-bg"
        >
          + New session
        </button>
        {onRename && (
          <p className="text-[10px] text-muted mt-2 px-0.5 leading-snug">
            Name in header or double-click a session to rename.
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <p className="text-xs text-muted px-2 py-1">Loading sessions…</p>
        )}
        {!loading && sessions.length === 0 && (
          <p className="text-xs text-muted px-2 py-1">No sessions yet.</p>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="relative">
            {editingId === s.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => commitRename(s.id, s.title)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRename(s.id, s.title);
                  }
                  if (e.key === "Escape") {
                    setEditingId(null);
                    setEditValue(s.title);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-md px-2 py-2 text-sm bg-surface-2 border border-accent text-text focus:outline-none focus:ring-2 focus:ring-accent/30"
                aria-label="Rename session"
              />
            ) : (
              <button
                onClick={() => onSelect(s.id)}
                onDoubleClick={(e) => startEdit(s, e)}
                className={`w-full text-left rounded-md px-2 py-2 text-sm truncate transition-colors ${
                  s.id === currentSessionId
                    ? "bg-accent-soft text-accent-hover"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
                title={onRename ? `${s.title} — double-click to rename` : s.title}
              >
                {s.title || "Untitled session"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
