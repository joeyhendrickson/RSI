"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ChatMessageRow, ChatSessionRow } from "@/lib/types";
import {
  parseRagMetadataLine,
  type RagTurnMetadata,
} from "@/lib/rag-confidence";

let tempIdCounter = 0;
function tempId() {
  tempIdCounter += 1;
  return `temp-${Date.now()}-${tempIdCounter}`;
}

function indexEvidenceFromMessages(messages: ChatMessageRow[]) {
  const map: Record<string, RagTurnMetadata> = {};
  for (const m of messages) {
    if (m.role === "assistant" && m.rag_metadata) {
      map[m.id] = m.rag_metadata;
    }
  }
  return map;
}

function latestAssistantEvidence(
  messages: ChatMessageRow[],
  evidenceMap: Record<string, RagTurnMetadata>
): RagTurnMetadata | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "assistant" && evidenceMap[m.id]) {
      return evidenceMap[m.id];
    }
  }
  return null;
}

export function useAdvisorChat() {
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [evidenceByMessageId, setEvidenceByMessageId] = useState<
    Record<string, RagTurnMetadata>
  >({});
  const [selectedEvidenceMessageId, setSelectedEvidenceMessageId] = useState<
    string | null
  >(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeEvidence = useMemo(() => {
    if (selectedEvidenceMessageId && evidenceByMessageId[selectedEvidenceMessageId]) {
      return evidenceByMessageId[selectedEvidenceMessageId];
    }
    return latestAssistantEvidence(messages, evidenceByMessageId);
  }, [selectedEvidenceMessageId, evidenceByMessageId, messages]);

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/sessions?tab=advisor");
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      setError("Failed to load sessions");
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount
    refreshSessions();
  }, [refreshSessions]);

  const createSession = useCallback(async () => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab: "advisor" }),
    });
    const data = await res.json();
    if (data.session) {
      setSessions((prev) => [data.session, ...prev]);
      setCurrentSessionId(data.session.id);
      setMessages([]);
      setEvidenceByMessageId({});
      setSelectedEvidenceMessageId(null);
    }
    return data.session as ChatSessionRow | undefined;
  }, []);

  const selectSession = useCallback(async (id: string) => {
    setCurrentSessionId(id);
    setLoadingMessages(true);
    setSelectedEvidenceMessageId(null);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      const loaded = (data.messages ?? []) as ChatMessageRow[];
      setMessages(loaded);
      setEvidenceByMessageId(indexEvidenceFromMessages(loaded));
    } catch {
      setError("Failed to load session history");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const renameSession = useCallback(
    async (title: string, sessionId?: string) => {
      const id = sessionId ?? currentSessionId;
      if (!id) return;
      const res = await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (data.session) {
        setSessions((prev) =>
          prev.map((s) => (s.id === data.session.id ? data.session : s))
        );
      }
    },
    [currentSessionId]
  );

  const send = useCallback(
    async (text: string) => {
      let sessionId = currentSessionId;
      if (!sessionId) {
        const session = await createSession();
        sessionId = session?.id ?? null;
      }
      if (!sessionId || !text.trim()) return;

      setSending(true);
      setError(null);

      const userMsg: ChatMessageRow = {
        id: tempId(),
        session_id: sessionId,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      const assistantMsgId = tempId();
      const assistantMsg: ChatMessageRow = {
        id: assistantMsgId,
        session_id: sessionId,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setSelectedEvidenceMessageId(assistantMsgId);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        let metadataParsed = false;
        let accumulated = "";
        let turnMetadata: RagTurnMetadata | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });

          if (!metadataParsed) {
            const newline = pending.indexOf("\n");
            if (newline === -1) continue;
            turnMetadata = parseRagMetadataLine(pending.slice(0, newline));
            pending = pending.slice(newline + 1);
            metadataParsed = true;
            if (turnMetadata) {
              setEvidenceByMessageId((prev) => ({
                ...prev,
                [assistantMsgId]: turnMetadata!,
              }));
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, rag_metadata: turnMetadata! }
                    : m
                )
              );
            }
          }

          if (pending) {
            accumulated += pending;
            pending = "";
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: accumulated } : m
              )
            );
          }
        }

        if (pending) {
          accumulated += pending;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: accumulated } : m
            )
          );
        }

        if (!accumulated.trim()) {
          throw new Error(
            "The advisor returned an empty response. Check OPENAI_CHAT_MODEL and your OpenAI API key.",
          );
        }

        refreshSessions();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSending(false);
      }
    },
    [createSession, currentSessionId, refreshSessions]
  );

  const selectEvidenceForMessage = useCallback((messageId: string) => {
    setSelectedEvidenceMessageId(messageId);
  }, []);

  return {
    sessions,
    currentSessionId,
    messages,
    setMessages,
    evidenceByMessageId,
    activeEvidence,
    selectedEvidenceMessageId,
    selectEvidenceForMessage,
    loadingSessions,
    loadingMessages,
    sending,
    error,
    createSession,
    selectSession,
    renameSession,
    send,
  };
}
