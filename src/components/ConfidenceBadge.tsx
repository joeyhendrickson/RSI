"use client";

import type { ConfidenceLevel } from "@/lib/rag-confidence";

const LEVEL_STYLES: Record<
  ConfidenceLevel,
  { bg: string; text: string; border: string }
> = {
  high: {
    bg: "bg-success/15",
    text: "text-success",
    border: "border-success/40",
  },
  medium: {
    bg: "bg-warning/15",
    text: "text-warning",
    border: "border-warning/40",
  },
  low: {
    bg: "bg-danger/15",
    text: "text-danger",
    border: "border-danger/40",
  },
  none: {
    bg: "bg-surface-2",
    text: "text-muted",
    border: "border-border",
  },
};

interface Props {
  score: number;
  label: string;
  onClick?: () => void;
  compact?: boolean;
}

export function ConfidenceBadge({ score, label, onClick, compact }: Props) {
  const level: ConfidenceLevel =
    score >= 72 ? "high" : score >= 42 ? "medium" : score > 0 ? "low" : "none";
  const styles = LEVEL_STYLES[level];

  const Tag = onClick ? "button" : "span";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles.bg} ${styles.text} ${styles.border} ${
        onClick ? "hover:opacity-90 cursor-pointer transition-opacity" : ""
      }`}
      title={onClick ? "View evidence and logic" : undefined}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.text} bg-current`} />
      {!compact && <span>{label}</span>}
      <span className="tabular-nums">{score}%</span>
    </Tag>
  );
}
