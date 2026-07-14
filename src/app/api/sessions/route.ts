import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, ChatTab } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const tab = request.nextUrl.searchParams.get("tab") as ChatTab | null;
  if (!tab) {
    return NextResponse.json({ error: "Missing tab query param" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("chat_sessions")
    .select("*")
    .eq("tab", tab)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ sessions: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const tab = body.tab as ChatTab | undefined;
  if (!tab || !["advisor", "persona"].includes(tab)) {
    return NextResponse.json({ error: "tab must be 'advisor' or 'persona'" }, { status: 400 });
  }

  const defaultTitle =
    body.title ??
    (tab === "persona" ? "New Segment" : "New Sessions");

  const { data, error } = await supabaseAdmin()
    .from("chat_sessions")
    .insert({ tab, title: defaultTitle })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ session: data });
}
