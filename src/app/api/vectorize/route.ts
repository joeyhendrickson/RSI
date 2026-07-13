import { NextRequest, NextResponse } from "next/server";
import { vectorizeFile } from "@/lib/vectorize";

export async function POST(request: NextRequest) {
  const { fileId } = await request.json();
  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const result = await vectorizeFile(fileId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ file: result.file });
}
