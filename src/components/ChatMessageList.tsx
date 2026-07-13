"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessageRow } from "@/lib/types";
import type { RagTurnMetadata } from "@/lib/rag-confidence";
import { ConfidenceBadge } from "./ConfidenceBadge";

interface Props {
  messages: ChatMessageRow[];
  emptyHint: string;
  evidenceByMessageId?: Record<string, RagTurnMetadata>;
  onViewEvidence?: (messageId: string) => void;
}

export function ChatMessageList({
  messages,
  emptyHint,
  evidenceByMessageId,
  onViewEvidence,
}: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-center px-8">
        <p className="text-muted text-sm max-w-md">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      {messages.map((m) => {
        const evidence = evidenceByMessageId?.[m.id] ?? m.rag_metadata ?? null;

        return (
          <div
            key={m.id}
            className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} w-full`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed prose-chat ${
                  m.role === "user"
                    ? "bg-accent text-bg rounded-br-sm"
                    : "bg-surface-2 text-text rounded-bl-sm border border-border"
                }`}
              >
                {m.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                ) : (
                  <span className="inline-flex gap-1 items-center text-muted">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse delay-150">●</span>
                    <span className="animate-pulse delay-300">●</span>
                  </span>
                )}
              </div>
            </div>
            {m.role === "assistant" && evidence && onViewEvidence && m.content && (
              <button
                type="button"
                onClick={() => onViewEvidence(m.id)}
                className="ml-1"
              >
                <ConfidenceBadge
                  score={evidence.confidence.score}
                  label={evidence.confidence.label}
                  compact
                />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
