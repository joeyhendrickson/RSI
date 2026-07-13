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

const MIN_VISION_IMAGE_BYTES = 4_000;

const VISION_PROMPT = `You are extracting content from a screenshot or image document for a searchable knowledge base about Microsoft Dynamics 365 Business Central and related enterprise processes.

Extract ALL readable text exactly as shown (UI labels, menu items, headings, table cells, form fields, button text, error messages, annotations, etc.). Preserve structure using markdown headings or bullet lists where helpful.

Then add a short description of what the image depicts (application, screen, workflow step, persona context).

Use this format:

## Visible text
(all extracted text)

## Description
(1–3 sentences describing the screenshot)`;

const DIAGRAM_VISION_PROMPT = `You are extracting content from a PowerPoint slide diagram for a searchable knowledge base about Renaissance Services (RSI) and Microsoft Dynamics 365 Business Central.

The image may be an org chart, process flow, swim lane diagram, ERP workflow map, or similar graphic where structure matters as much as labels.

Extract:
- ALL visible names, titles, roles, departments, and teams
- ALL process steps, lanes, arrows, handoffs, approvals, and decision points
- Relationships such as "reports to", "owns", "approves", "creates", "ships", "invoices"

Preserve hierarchy and flow using markdown headings, bullet lists, or indented lists.

Use this format:

## Visible text and labels
(all text you can read)

## Structure and relationships
(describe hierarchy, process order, swim lanes, or ownership)

## Description
(1-2 sentences describing the diagram type)`;

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

export function isVisionEligibleImage(buffer: Buffer): boolean {
  return buffer.length >= MIN_VISION_IMAGE_BYTES;
}

export { resolveImageMimeType };

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

export async function extractDiagramImageText(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
  slideTextContext?: string
): Promise<string> {
  const mediaType = resolveImageMimeType(filename, mimeType);
  const contextBlock = slideTextContext?.trim()
    ? `Text already extracted from this slide's text boxes (may be incomplete):\n"""\n${slideTextContext.trim()}\n"""\n\nUse the image to fill gaps — especially hierarchy, arrows, swim lanes, and labels missing from the text boxes.`
    : "No reliable text boxes were found on this slide — rely on the image.";

  const { text } = await generateText({
    model: visionModel(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${DIAGRAM_VISION_PROMPT}\n\nSlide context:\n${contextBlock}`,
          },
          { type: "image", image: buffer, mediaType },
        ],
      },
    ],
  });

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("No diagram text could be extracted from image");
  }

  return trimmed;
}
