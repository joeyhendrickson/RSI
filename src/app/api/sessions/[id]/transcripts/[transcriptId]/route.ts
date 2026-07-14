import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; transcriptId: string }> }
) {
  const { id: sessionId, transcriptId } = await params;

  const { error } = await supabaseAdmin()
    .from("persona_live_transcripts")
    .delete()
    .eq("id", transcriptId)
    .eq("session_id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
