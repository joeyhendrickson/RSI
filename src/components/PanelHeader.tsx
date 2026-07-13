"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  subtitle?: string;
  onSave?: (title: string) => void;
  onExport?: () => void;
  disabled?: boolean;
  /** Focus and select the title field (e.g. after creating a new session). */
  autoFocusRename?: boolean;
  onRenameFocusHandled?: () => void;
}

export function PanelHeader({
  title,
  subtitle,
  onSave,
  onExport,
  disabled,
  autoFocusRename,
  onRenameFocusHandled,
}: Props) {
  const [value, setValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(title);
  }, [title]);

  useEffect(() => {
    if (!autoFocusRename || !onSave || disabled) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
    onRenameFocusHandled?.();
  }, [autoFocusRename, onSave, disabled, onRenameFocusHandled]);

  const commit = () => {
    const trimmed = value.trim();
    if (!onSave) return;
    if (!trimmed) {
      setValue(title);
      return;
    }
    if (trimmed !== title) {
      onSave(trimmed);
    }
  };

  const editable = Boolean(onSave) && !disabled;

  return (
    <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 gap-3">
      <div className="min-w-0 flex-1">
        {editable ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
                inputRef.current?.blur();
              }
              if (e.key === "Escape") {
                setValue(title);
                inputRef.current?.blur();
              }
            }}
            placeholder="Name this session…"
            aria-label="Session name"
            className="w-full max-w-md bg-surface-2 border border-border hover:border-accent/50 focus:border-accent rounded-md px-2.5 py-1 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        ) : (
          <h2 className="text-sm font-semibold truncate text-muted">{title}</h2>
        )}
        {subtitle && <p className="text-xs text-muted truncate mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        {onExport && (
          <button
            disabled={disabled}
            onClick={onExport}
            className="rounded-md bg-surface-2 border border-border hover:border-accent hover:text-accent-hover disabled:opacity-40 transition-colors text-xs font-medium px-3 py-1.5"
          >
            Export
          </button>
        )}
      </div>
    </div>
  );
}
