import {
  extractDiagramImageText,
  isVisionEligibleImage,
  resolveImageMimeType,
} from "./extract-image";

type PptxZip = {
  files: Record<
    string,
    {
      async: (type: "arraybuffer") => Promise<ArrayBuffer>;
    }
  >;
};

const MIN_TEXT_FOR_DIAGRAM_HEURISTIC = 120;
const MIN_TEXT_FOR_SCREENSHOT_HEURISTIC = 80;
const MAX_VISION_IMAGES_PER_SLIDE = 2;
const MAX_VISION_IMAGES_PER_DECK = 24;
const MAX_VISION_IMAGES_LARGE_DECK = 8;

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function extractTextFromSlideXml(xml: string): string {
  const textBodies = [...xml.matchAll(/<p:txBody>[\s\S]*?<\/p:txBody>/g)];

  if (textBodies.length > 0) {
    const shapeLines = textBodies
      .map((match) => {
        const paragraphs = [...match[0].matchAll(/<a:p[\s>][\s\S]*?<\/a:p>/g)];
        const paragraphText = paragraphs
          .map((paragraph) =>
            [...paragraph[0].matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
              .map((m) => decodeXmlEntities(m[1]))
              .join("")
              .trim()
          )
          .filter(Boolean)
          .join(" ");

        return paragraphText.trim();
      })
      .filter(Boolean);

    return shapeLines.join("\n");
  }

  const paragraphs = [...xml.matchAll(/<a:p[\s>][\s\S]*?<\/a:p>/g)];
  return paragraphs
    .map((match) =>
      [...match[0].matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
        .map((m) => decodeXmlEntities(m[1]))
        .join("")
        .trim()
    )
    .filter(Boolean)
    .join("\n");
}

function normalizeMediaPath(target: string): string {
  return target.replace(/^\.\.\//, "ppt/");
}

function getSlideEmbedIds(slideXml: string): string[] {
  return [
    ...new Set([
      ...[...slideXml.matchAll(/r:embed="(rId\d+)"/g)].map((m) => m[1]),
      ...[...slideXml.matchAll(/r:link="(rId\d+)"/g)].map((m) => m[1]),
    ]),
  ];
}

function resolveEmbedTargets(relsXml: string, embedIds: string[]): string[] {
  const targets: string[] = [];

  for (const embedId of embedIds) {
    const relationship = [
      ...relsXml.matchAll(
        new RegExp(
          `<Relationship\\s+Id="${embedId}"[^>]*Target="([^"]+)"`,
          "gi"
        )
      ),
    ][0];

    if (!relationship) continue;

    const target = relationship[1];
    if (/\.(png|jpe?g|webp|gif)$/i.test(target)) {
      targets.push(normalizeMediaPath(target));
    }
  }

  return targets;
}

function isDiagramHeavyDeck(filename: string): boolean {
  return /org chart|swim\s*lane|flow\s*chart|flowchart|process map|swimlane|erp flow|p2p|q2c/i.test(
    filename
  );
}

function getVisionBudget(filename: string, slideCount: number): number {
  if (isDiagramHeavyDeck(filename)) {
    return MAX_VISION_IMAGES_PER_DECK;
  }
  if (slideCount > 15) {
    return MAX_VISION_IMAGES_LARGE_DECK;
  }
  return 12;
}

function shouldRunVisionForSlide(
  filename: string,
  slideText: string,
  imageCount: number,
  blipCount: number,
  diagramHeavyDeck: boolean
): boolean {
  if (imageCount === 0) return false;
  if (diagramHeavyDeck) return true;
  const textThreshold = diagramHeavyDeck
    ? MIN_TEXT_FOR_DIAGRAM_HEURISTIC
    : MIN_TEXT_FOR_SCREENSHOT_HEURISTIC;
  if (blipCount > 0 && slideText.length < textThreshold) {
    return true;
  }
  if (
    /org chart|process flow|swim lane|workflow|flow chart|diagram/i.test(
      slideText
    )
  ) {
    return true;
  }
  return false;
}

async function loadImageBuffers(
  zip: PptxZip,
  mediaPaths: string[]
): Promise<{ path: string; buffer: Buffer }[]> {
  const loaded: { path: string; buffer: Buffer; size: number }[] = [];

  for (const mediaPath of mediaPaths) {
    const entry = zip.files[mediaPath];
    if (!entry) continue;

    const buffer = Buffer.from(await entry.async("arraybuffer"));
    if (!isVisionEligibleImage(buffer)) continue;

    loaded.push({ path: mediaPath, buffer, size: buffer.length });
  }

  return loaded
    .sort((a, b) => b.size - a.size)
    .slice(0, MAX_VISION_IMAGES_PER_SLIDE)
    .map(({ path, buffer }) => ({ path, buffer }));
}

async function extractSlideVisionText(
  filename: string,
  slideNum: string,
  slideText: string,
  images: { path: string; buffer: Buffer }[]
): Promise<string[]> {
  const parts: string[] = [];

  for (const image of images) {
    const imageName = image.path.split("/").pop() ?? image.path;
    const mimeType = resolveImageMimeType(imageName);
    const visionText = await extractDiagramImageText(
      image.buffer,
      `${filename} — Slide ${slideNum} — ${imageName}`,
      mimeType,
      slideText
    );
    parts.push(
      `[Vision OCR: embedded diagram/graphic — ${imageName}]\n${visionText}`
    );
  }

  return parts;
}

export async function extractPptx(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);

  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  const parts: string[] = [];
  const diagramHeavyDeck = isDiagramHeavyDeck(filename);
  const visionBudget = getVisionBudget(filename, slidePaths.length);
  let visionImagesUsed = 0;

  for (const slidePath of slidePaths) {
    if (visionImagesUsed >= visionBudget) break;

    const slideNum = slidePath.match(/slide(\d+)/)?.[1] ?? "?";
    const xml = await zip.files[slidePath].async("text");
    const text = extractTextFromSlideXml(xml);
    const blipCount = (xml.match(/<a:blip /g) ?? []).length;

    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const relsEntry = zip.files[relsPath];
    const embedIds = getSlideEmbedIds(xml);
    const mediaPaths =
      relsEntry && embedIds.length > 0
        ? resolveEmbedTargets(await relsEntry.async("text"), embedIds)
        : [];

    const slideSections: string[] = [];
    if (text) {
      slideSections.push(text);
    }

    const remainingBudget = visionBudget - visionImagesUsed;
    const images = shouldRunVisionForSlide(
      filename,
      text,
      mediaPaths.length,
      blipCount,
      diagramHeavyDeck
    )
      ? (
          await loadImageBuffers(
            zip,
            mediaPaths.slice(0, remainingBudget)
          )
        ).slice(0, Math.min(MAX_VISION_IMAGES_PER_SLIDE, remainingBudget))
      : [];

    if (images.length > 0) {
      const visionParts = await extractSlideVisionText(
        filename,
        slideNum,
        text,
        images
      );
      slideSections.push(...visionParts);
      visionImagesUsed += images.length;
    }

    if (slideSections.length > 0) {
      parts.push(`--- Slide ${slideNum} ---\n${slideSections.join("\n\n")}`);
    }
  }

  const notesPaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/notesSlide(\d+)/)?.[1] ?? 0);
      const nb = Number(b.match(/notesSlide(\d+)/)?.[1] ?? 0);
      return na - nb;
    });

  for (const notesPath of notesPaths) {
    const xml = await zip.files[notesPath].async("text");
    const slideNum = notesPath.match(/notesSlide(\d+)/)?.[1] ?? "?";
    const text = extractTextFromSlideXml(xml);
    if (text) {
      parts.push(`--- Speaker notes (slide ${slideNum}) ---\n${text}`);
    }
  }

  return parts.join("\n\n");
}
