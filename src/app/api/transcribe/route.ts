import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 });
    }

    if (audio.size === 0) {
      return NextResponse.json({ error: "empty audio recording" }, { status: 400 });
    }

    const openaiForm = new FormData();
    openaiForm.append("file", audio, "recording.webm");
    openaiForm.append("model", env.openaiTranscriptionModel());
    openaiForm.append("language", "en");
    openaiForm.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openaiApiKey()}`,
      },
      body: openaiForm,
    });

    const payload = (await response.json()) as { text?: string; error?: { message?: string } };

    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error?.message ?? "Transcription failed" },
        { status: response.status }
      );
    }

    const text = payload.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "No speech detected in recording" }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
