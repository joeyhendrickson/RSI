import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = supabaseAdmin();

  const [{ data: session, error: sessionError }, { data: messages, error: messagesError }, { data: questions, error: questionsError }, { data: liveTranscripts, error: transcriptsError }] =
    await Promise.all([
      db.from("chat_sessions").select("*").eq("id", id).single(),
      db.from("chat_messages").select("*").eq("session_id", id).order("created_at", { ascending: true }),
      db.from("generated_questions").select("*").eq("session_id", id).order("created_at", { ascending: true }),
      db.from("persona_live_transcripts").select("*").eq("session_id", id).order("created_at", { ascending: false }),
    ]);

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 404 });
  }
  if (messagesError || questionsError || transcriptsError) {
    return NextResponse.json(
      { error: messagesError?.message ?? questionsError?.message ?? transcriptsError?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ session, messages, questions, liveTranscripts: liveTranscripts ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const { data, error } = await supabaseAdmin()
    .from("chat_sessions")
    .update({ title: body.title })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ session: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await supabaseAdmin().from("chat_sessions").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
