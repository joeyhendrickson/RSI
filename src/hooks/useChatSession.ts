"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessageRow, ChatSessionRow, ChatTab, GeneratedQuestionRow } from "@/lib/types";

interface SendOptions {
  transcript?: string;
  mode?: "chat" | "generate_questions" | "investigate";
}

let tempIdCounter = 0;
function tempId() {
  tempIdCounter += 1;
  return `temp-${Date.now()}-${tempIdCounter}`;
}

export function useChatSession(tab: ChatTab, endpoint: string) {
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [questions, setQuestions] = useState<GeneratedQuestionRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/sessions?tab=${tab}`);
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      setError("Failed to load sessions");
    } finally {
      setLoadingSessions(false);
    }
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount
    refreshSessions();
  }, [refreshSessions]);

  const createSession = useCallback(async () => {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab }),
    });
    const data = await res.json();
    if (data.session) {
      setSessions((prev) => [data.session, ...prev]);
      setCurrentSessionId(data.session.id);
      setMessages([]);
      setQuestions([]);
    }
    return data.session as ChatSessionRow | undefined;
  }, [tab]);

  const selectSession = useCallback(async (id: string) => {
    setCurrentSessionId(id);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setQuestions(data.questions ?? []);
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
    async (text: string, options: SendOptions = {}) => {
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

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: text,
            transcript: options.transcript,
            mode: options.mode,
          }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Request failed");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated } : m))
          );
        }

        refreshSessions();
        if (options.mode === "generate_questions") {
          const finalSessionId = sessionId;
          fetch(`/api/sessions/${finalSessionId}`)
            .then((r) => r.json())
            .then((d) => setQuestions(d.questions ?? []));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSending(false);
      }
    },
    [createSession, currentSessionId, endpoint, refreshSessions]
  );

  return {
    sessions,
    currentSessionId,
    messages,
    questions,
    setMessages,
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
