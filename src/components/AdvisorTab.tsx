"use client";

import { useState } from "react";
import { useAdvisorChat } from "@/hooks/useAdvisorChat";
import { SessionSidebar } from "@/components/SessionSidebar";
import { PanelHeader } from "@/components/PanelHeader";
import { ChatMessageList } from "@/components/ChatMessageList";
import { ChatComposer } from "@/components/ChatComposer";
import { EvidencePanel } from "@/components/EvidencePanel";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { exportTranscript } from "@/lib/export";
import type { ChatMessageRow } from "@/lib/types";

type AdvisorView = "chat" | "evidence";

export function AdvisorTab() {
  const {
    sessions,
    currentSessionId,
    messages,
    setMessages,
    activeEvidence,
    evidenceByMessageId,
    selectEvidenceForMessage,
    loadingSessions,
    sending,
    error,
    createSession,
    selectSession,
    renameSession,
    send,
  } = useAdvisorChat();

  const [view, setView] = useState<AdvisorView>("chat");
  const [flowChartOpen, setFlowChartOpen] = useState(false);
  const [flowChartPrompt, setFlowChartPrompt] = useState("");
  const [generatingChart, setGeneratingChart] = useState(false);

  const currentTitle = sessions.find((s) => s.id === currentSessionId)?.title ?? "New advisor session";

  const generateFlowChart = async () => {
    if (!flowChartPrompt.trim()) return;
    setGeneratingChart(true);
    let sessionId = currentSessionId;
    if (!sessionId) {
      const session = await createSession();
      sessionId = session?.id ?? null;
    }
    try {
      const res = await fetch("/api/flowchart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, prompt: flowChartPrompt }),
      });
      const data = await res.json();
      if (data.imageUrl && sessionId) {
        const now = new Date().toISOString();
        const userMsg: ChatMessageRow = {
          id: `local-${Date.now()}-u`,
          session_id: sessionId,
          role: "user",
          content: `🧩 Generate flow chart: ${flowChartPrompt}`,
          created_at: now,
        };
        const assistantMsg: ChatMessageRow = {
          id: `local-${Date.now()}-a`,
          session_id: sessionId,
          role: "assistant",
          content: `![Generated flow chart: ${flowChartPrompt}](${data.imageUrl})`,
          created_at: now,
        };
        setMessages((prev) => [...prev, userMsg, assistantMsg]);
      }
      setFlowChartPrompt("");
      setFlowChartOpen(false);
    } finally {
      setGeneratingChart(false);
    }
  };

  const openEvidence = () => setView("evidence");

  return (
    <div className="flex h-full">
      <SessionSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        loading={loadingSessions}
        onSelect={selectSession}
        onCreate={createSession}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <PanelHeader
          title={currentTitle}
          subtitle="Sing Creative Advisor — Business Central process guidance"
          onSave={currentSessionId ? renameSession : undefined}
          onExport={
            currentSessionId
              ? () => exportTranscript(currentTitle, messages)
              : undefined
          }
          disabled={!currentSessionId}
        />

        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 gap-3">
          <nav className="flex gap-1 bg-surface-2 rounded-lg p-0.5">
            <button
              onClick={() => setView("chat")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "chat"
                  ? "bg-accent text-bg"
                  : "text-muted hover:text-text"
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setView("evidence")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "evidence"
                  ? "bg-accent text-bg"
                  : "text-muted hover:text-text"
              }`}
            >
              Evidence &amp; Logic
            </button>
          </nav>

          {activeEvidence && (
            <ConfidenceBadge
              score={activeEvidence.confidence.score}
              label={activeEvidence.confidence.label}
              onClick={openEvidence}
            />
          )}
        </div>

        {flowChartOpen && view === "chat" && (
          <div className="border-b border-border bg-surface-2 px-4 py-3 flex gap-2 items-center">
            <input
              value={flowChartPrompt}
              onChange={(e) => setFlowChartPrompt(e.target.value)}
              placeholder="Describe the process to diagram, e.g. 'Purchase order approval workflow for the AP clerk persona'"
              className="flex-1 rounded-md bg-surface border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              onKeyDown={(e) => e.key === "Enter" && generateFlowChart()}
            />
            <button
              onClick={generateFlowChart}
              disabled={generatingChart || !flowChartPrompt.trim()}
              className="rounded-md bg-accent hover:bg-accent-hover disabled:opacity-40 transition-colors text-xs font-medium px-3 py-1.5 text-bg whitespace-nowrap"
            >
              {generatingChart ? "Generating…" : "Generate"}
            </button>
            <button
              onClick={() => setFlowChartOpen(false)}
              className="text-xs text-muted hover:text-text px-2"
            >
              Cancel
            </button>
          </div>
        )}

        {view === "chat" ? (
          <>
            <ChatMessageList
              messages={messages}
              emptyHint="Ask about Business Central processes, personas, or request a process flow chart diagram. Answers are grounded in your vectorized knowledge base."
              evidenceByMessageId={evidenceByMessageId}
              onViewEvidence={(messageId) => {
                selectEvidenceForMessage(messageId);
                setView("evidence");
              }}
            />
            {error && <p className="px-4 py-1 text-xs text-danger">{error}</p>}
            <ChatComposer
              onSend={(text) => send(text)}
              disabled={sending}
              placeholder="Ask the advisor…"
              secondaryAction={{
                label: "🧩 Flow chart",
                onClick: () => setFlowChartOpen((v) => !v),
              }}
            />
          </>
        ) : (
          <EvidencePanel metadata={activeEvidence} />
        )}
      </div>
    </div>
  );
}
