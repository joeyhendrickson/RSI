"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RagTurnMetadata } from "@/lib/rag-confidence";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface Props {
  metadata: RagTurnMetadata | null;
  emptyHint?: string;
}

export function EvidencePanel({ metadata, emptyHint }: Props) {
  if (!metadata) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 text-center">
        <p className="text-sm text-muted max-w-md">
          {emptyHint ??
            "Send a message in Chat, then open this tab to see Pinecone match scores, source excerpts, and the reasoning behind the advisor's confidence level."}
        </p>
      </div>
    );
  }

  const { confidence, evidence, logic, query } = metadata;

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <ConfidenceBadge score={confidence.score} label={confidence.label} />
        <span className="text-xs text-muted">
          {confidence.matchCount} source{confidence.matchCount === 1 ? "" : "s"} · grounding{" "}
          {confidence.groundingScore}/100 · vector best{" "}
          {(confidence.topScore * 100).toFixed(1)}%
        </span>
      </div>

      <p className="text-sm text-text leading-relaxed">{confidence.summary}</p>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
          Evidential logic
        </h3>
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm prose-chat">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{logic}</ReactMarkdown>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
          Retrieved passages
        </h3>
        {evidence.length === 0 ? (
          <p className="text-sm text-muted">No passages were retrieved for: &quot;{query}&quot;</p>
        ) : (
          <div className="space-y-3">
            {evidence.map((chunk) => (
              <article
                key={chunk.rank}
                className="rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-accent-hover truncate">
                    #{chunk.rank} — {chunk.filename}
                  </p>
                  <span className="text-xs tabular-nums text-muted shrink-0">
                    {(chunk.score * 100).toFixed(1)}% match
                  </span>
                </div>
                <p className="text-sm text-text leading-relaxed whitespace-pre-wrap line-clamp-6">
                  {chunk.text}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
