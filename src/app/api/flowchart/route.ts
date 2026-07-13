import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "ai";
import { imageModel } from "@/lib/ai";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { sessionId, prompt } = await request.json();

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const flowChartPrompt = `Clean, professional process flow chart diagram, white background, clear labeled boxes and arrows, business-process style (not artistic/photographic). Depicts: ${prompt}`;

  try {
    const { image } = await generateImage({
      model: imageModel(),
      prompt: flowChartPrompt,
      size: "1024x1024",
    });

    const dataUrl = `data:${image.mediaType ?? "image/png"};base64,${image.base64}`;

    if (sessionId) {
      const db = supabaseAdmin();
      await db.from("chat_messages").insert({
        session_id: sessionId,
        role: "user",
        content: `🧩 Generate flow chart: ${prompt}`,
      });
      await Promise.all([
        db.from("flow_charts").insert({ session_id: sessionId, prompt, image_url: dataUrl }),
        db.from("chat_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: `![Generated flow chart: ${prompt}](${dataUrl})`,
        }),
      ]);
    }

    return NextResponse.json({ imageUrl: dataUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
