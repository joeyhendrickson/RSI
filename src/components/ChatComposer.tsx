"use client";

import { useState, KeyboardEvent } from "react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  secondaryAction?: { label: string; onClick: (text: string) => void; disabled?: boolean };
}

export function ChatComposer({ onSend, disabled, placeholder, secondaryAction }: Props) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border bg-surface p-3">
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Ask the advisor…"}
          rows={2}
          disabled={disabled}
          className="flex-1 resize-none rounded-lg bg-surface-2 border border-border px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
        />
        <div className="flex flex-col gap-2">
          <button
            onClick={submit}
            disabled={disabled || !text.trim()}
            className="rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium px-4 py-2 text-bg whitespace-nowrap"
          >
            Send
          </button>
          {secondaryAction && (
            <button
              onClick={() => secondaryAction.onClick(text)}
              disabled={secondaryAction.disabled || disabled}
              className="rounded-lg border border-accent text-accent-hover hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium px-4 py-2 whitespace-nowrap"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted mt-1.5">Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
