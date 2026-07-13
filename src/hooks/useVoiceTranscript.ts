"use client";

import { useCallback, useRef, useState } from "react";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useVoiceTranscript(onAppend: (text: string) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const transcribeBlob = useCallback(
    async (blob: Blob) => {
      setTranscribing(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");

        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Transcription failed");
        }
        if (data.text) {
          onAppend(data.text);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transcription failed");
      } finally {
        setTranscribing(false);
      }
    },
    [onAppend]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopStream();
        const blob = new Blob(chunksRef.current, {
          type: mimeType ?? "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size > 0) {
          void transcribeBlob(blob);
        }
      };

      recorder.onerror = () => {
        setError("Recording failed");
        setRecording(false);
        stopStream();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      stopStream();
      setError(
        err instanceof Error
          ? err.message.includes("Permission")
            ? "Microphone permission denied"
            : err.message
          : "Could not access microphone"
      );
    }
  }, [stopStream, transcribeBlob]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (transcribing) return;
    if (recording) {
      stopRecording();
    } else {
      void startRecording();
    }
  }, [recording, transcribing, startRecording, stopRecording]);

  return {
    recording,
    transcribing,
    error,
    toggleRecording,
    supported: typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
  };
}
