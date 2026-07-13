"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UploadedFileRow } from "@/lib/types";

const STATUS_STYLES: Record<UploadedFileRow["status"], string> = {
  uploaded: "bg-warning/15 text-warning border-warning/30",
  chunking: "bg-accent-soft text-accent-hover border-accent/30",
  embedding: "bg-accent-soft text-accent-hover border-accent/30",
  vectorized: "bg-success/15 text-success border-success/30",
  error: "bg-danger/15 text-danger border-danger/30",
};

const STATUS_LABELS: Record<UploadedFileRow["status"], string> = {
  uploaded: "Uploaded — ready to vectorize",
  chunking: "Chunking…",
  embedding: "Embedding…",
  vectorized: "Vectorized ✓",
  error: "Error",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export function VectorizeTab() {
  const [files, setFiles] = useState<UploadedFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [vectorizingIds, setVectorizingIds] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/files");
    const data = await res.json();
    setFiles(data.files ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount
    refresh();
  }, [refresh]);

  useEffect(() => {
    const hasActive = files.some((f) => f.status === "chunking" || f.status === "embedding");
    if (!hasActive) return;
    const interval = setInterval(refresh, 2500);
    return () => clearInterval(interval);
  }, [files, refresh]);

  const uploadFiles = async (fileList: FileList | File[]) => {
    const formData = new FormData();
    Array.from(fileList).forEach((f) => formData.append("files", f));
    setUploading(true);
    try {
      await fetch("/api/upload", { method: "POST", body: formData });
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const vectorize = async (id: string) => {
    setVectorizingIds((prev) => new Set(prev).add(id));
    try {
      await fetch("/api/vectorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id }),
      });
      await refresh();
    } finally {
      setVectorizingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const pendingCount = files.filter((f) => f.status === "uploaded" || f.status === "error").length;

  const syncFromBucket = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/files/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncMessage(data.error ?? "Sync failed");
      } else if (data.added === 0) {
        setSyncMessage("Bucket is already in sync — no new files found.");
      } else {
        const parts = [`Found ${data.added} new file${data.added === 1 ? "" : "s"} in the bucket.`];
        if (data.vectorized > 0) parts.push(`${data.vectorized} vectorized into Pinecone.`);
        if (data.failed > 0) parts.push(`${data.failed} failed — see status below.`);
        setSyncMessage(parts.join(" "));
        await refresh();
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-surface px-4 py-3">
        <h2 className="text-sm font-semibold">Knowledge Base — Upload & Vectorize</h2>
        <p className="text-xs text-muted">
          Upload files below to send them to Google Cloud Storage, then click{" "}
          <span className="text-text font-medium">Vectorize</span> to embed them into Pinecone. Already
          have files sitting in the bucket? Use{" "}
          <span className="text-text font-medium">Sync bucket → knowledge base</span> to pull them in
          and vectorize them in one step.
        </p>
      </div>

      <div className="p-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragOver ? "border-accent bg-accent-soft" : "border-border hover:border-accent/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            accept=".pdf,.docx,.pptx,.xlsx,.xlsm,.xls,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.json"
          />
          <p className="text-sm text-text font-medium">
            {uploading ? "Uploading…" : "Click or drag files here to upload"}
          </p>
          <p className="text-xs text-muted mt-1">
            PDF, DOCX, PPTX, XLSX, XLSM, PNG/JPG/WEBP/GIF screenshots, TXT, MD, CSV, JSON
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex items-center justify-between mb-2 gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Files ({files.length})
          </h3>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <span className="text-xs text-warning">{pendingCount} pending vectorization</span>
            )}
            <button
              onClick={syncFromBucket}
              disabled={syncing}
              className="rounded-md border border-border hover:border-accent hover:text-accent-hover disabled:opacity-40 transition-colors text-xs font-medium px-3 py-1.5 whitespace-nowrap"
            >
              {syncing ? "Syncing & vectorizing…" : "🔄 Sync bucket → knowledge base"}
            </button>
          </div>
        </div>
        {syncMessage && <p className="text-xs text-muted mb-2">{syncMessage}</p>}

        {loading && <p className="text-sm text-muted">Loading files…</p>}
        {!loading && files.length === 0 && (
          <p className="text-sm text-muted">No files uploaded yet.</p>
        )}

        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{f.filename}</p>
                <p className="text-xs text-muted">
                  {formatBytes(f.size_bytes)}
                  {f.chunk_count ? ` · ${f.chunk_count} chunks` : ""} ·{" "}
                  {new Date(f.uploaded_at).toLocaleString()}
                </p>
                {f.status === "error" && f.error_message && (
                  <p className="text-xs text-danger mt-0.5">{f.error_message}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${STATUS_STYLES[f.status]}`}
                >
                  {STATUS_LABELS[f.status]}
                </span>
                {(f.status === "uploaded" || f.status === "error") && (
                  <button
                    onClick={() => vectorize(f.id)}
                    disabled={vectorizingIds.has(f.id)}
                    className="rounded-md bg-accent hover:bg-accent-hover disabled:opacity-40 transition-colors text-xs font-medium px-3 py-1.5 text-bg whitespace-nowrap"
                  >
                    {vectorizingIds.has(f.id) ? "Starting…" : "Vectorize"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
