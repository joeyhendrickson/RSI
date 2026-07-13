import { generateText } from "ai";
import { visionModel } from "./ai";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const VISION_PROMPT = `You are extracting content from a screenshot or image document for a searchable knowledge base about Microsoft Dynamics 365 Business Central and related enterprise processes.

Extract ALL readable text exactly as shown (UI labels, menu items, headings, table cells, form fields, button text, error messages, annotations, etc.). Preserve structure using markdown headings or bullet lists where helpful.

Then add a short description of what the image depicts (application, screen, workflow step, persona context).

Use this format:

## Visible text
(all extracted text)

## Description
(1–3 sentences describing the screenshot)`;

export function isImageFile(filename: string, mimeType?: string): boolean {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return (
    IMAGE_EXTENSIONS.has(ext) || Boolean(mimeType?.startsWith("image/"))
  );
}

function resolveImageMimeType(filename: string, mimeType?: string): string {
  if (mimeType?.startsWith("image/")) return mimeType;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return EXT_TO_MIME[ext] ?? "image/png";
}

export async function extractImageText(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<string> {
  const mediaType = resolveImageMimeType(filename, mimeType);

  const { text } = await generateText({
    model: visionModel(),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image", image: buffer, mediaType },
        ],
      },
    ],
  });

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("No text could be extracted from image");
  }

  return `[Image: ${filename}]\n\n${trimmed}`;
}
