"use client";

import { useState } from "react";

interface Props {
  title: string;
  subtitle?: string;
  onSave?: (title: string) => void;
  onExport?: () => void;
  disabled?: boolean;
}

export function PanelHeader({ title, subtitle, onSave, onExport, disabled }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [savedFlash, setSavedFlash] = useState(false);

  const commit = () => {
    setEditing(false);
    if (value.trim() && value !== title) {
      onSave?.(value.trim());
    }
  };

  const flashSaved = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 gap-3">
      <div className="min-w-0">
        {editing ? (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className="bg-surface-2 border border-accent rounded px-2 py-0.5 text-sm font-semibold text-text focus:outline-none"
          />
        ) : (
          <h2
            className="text-sm font-semibold truncate cursor-text"
            onClick={() => {
              setValue(title);
              setEditing(true);
            }}
            title="Click to rename"
          >
            {title}
          </h2>
        )}
        {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        {onSave && (
          <button
            disabled={disabled}
            onClick={() => {
              onSave(title);
              flashSaved();
            }}
            className="rounded-md border border-border hover:border-accent hover:text-accent-hover disabled:opacity-40 transition-colors text-xs font-medium px-3 py-1.5"
          >
            {savedFlash ? "Saved ✓" : "Save"}
          </button>
        )}
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
