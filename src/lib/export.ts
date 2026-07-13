import type { ChatMessageRow, GeneratedQuestionRow } from "@/lib/types";

function download(filename: string, content: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportTranscript(
  title: string,
  messages: ChatMessageRow[],
  questions?: GeneratedQuestionRow[]
) {
  const lines: string[] = [`# ${title}`, ""];

  if (questions && questions.length > 0) {
    lines.push("## Generated Questions", "");
    questions.forEach((q, i) => {
      lines.push(`### Batch ${i + 1} — ${new Date(q.created_at).toLocaleString()}`, "");
      lines.push(q.content, "");
    });
    lines.push("## Full Discussion", "");
  }

  messages.forEach((m) => {
    const label = m.role === "user" ? "**You**" : m.role === "assistant" ? "**Advisor**" : "**System**";
    lines.push(`${label} _(${new Date(m.created_at).toLocaleString()})_`, "");
    lines.push(m.content, "");
  });

  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  download(`${safeName || "session"}-${Date.now()}.md`, lines.join("\n"));
}

export function exportJson(title: string, data: unknown) {
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  download(`${safeName || "session"}-${Date.now()}.json`, JSON.stringify(data, null, 2), "application/json");
}
