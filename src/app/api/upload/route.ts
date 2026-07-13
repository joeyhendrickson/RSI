import { NextRequest, NextResponse } from "next/server";
import { uploadFileToGcs } from "@/lib/gcs";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const results = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const gcsPath = `uploads/${timestamp}-${file.name}`;

    try {
      await uploadFileToGcs(gcsPath, buffer, file.type || undefined);

      const { data, error } = await db
        .from("uploaded_files")
        .insert({
          filename: file.name,
          gcs_path: gcsPath,
          mime_type: file.type || null,
          size_bytes: file.size,
          status: "uploaded",
        })
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      results.push(data);
    } catch (err) {
      results.push({
        filename: file.name,
        error: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  return NextResponse.json({ files: results });
}
