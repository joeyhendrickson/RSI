import path from "path";
import { extractImageText, isImageFile } from "./extract-image";

const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json"]);

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdf-parse/dist/pdf-parse/esm/pdf.worker.mjs"
  );
  PDFParse.setWorker(`file://${workerPath}`);

  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet).trim();
    if (csv) {
      parts.push(`Sheet: ${sheetName}\n${csv}`);
    }
  }

  return parts.join("\n\n");
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTextFromSlideXml(xml: string): string {
  const runs = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) =>
    decodeXmlEntities(m[1])
  );
  return runs.join("").trim();
}

async function extractPptx(buffer: Buffer): Promise<string> {
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

  for (const slidePath of slidePaths) {
    const xml = await zip.files[slidePath].async("text");
    const slideNum = slidePath.match(/slide(\d+)/)?.[1] ?? "?";
    const text = extractTextFromSlideXml(xml);
    if (text) {
      parts.push(`Slide ${slideNum}:\n${text}`);
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
      parts.push(`Speaker notes (slide ${slideNum}):\n${text}`);
    }
  }

  return parts.join("\n\n");
}

export async function extractText(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf" || mimeType === "application/pdf") {
    return extractPdf(buffer);
  }

  if (
    ext === "docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocx(buffer);
  }

  if (
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "xlsm" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType ===
      "application/vnd.ms-excel.sheet.macroEnabled.12" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return extractXlsx(buffer);
  }

  if (
    ext === "pptx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return extractPptx(buffer);
  }

  if (isImageFile(filename, mimeType)) {
    return extractImageText(buffer, filename, mimeType);
  }

  if (TEXT_EXTENSIONS.has(ext) || mimeType?.startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  throw new Error(
    `Unsupported file type for "${filename}". Supported: PDF, DOCX, PPTX, XLSX, XLSM, PNG, JPG, WEBP, GIF, TXT, MD, CSV, JSON.`
  );
}

export function isSupportedFile(filename: string, mimeType?: string): boolean {
  if (isImageFile(filename, mimeType)) return true;

  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const supportedExtensions = [
    "pdf",
    "docx",
    "pptx",
    "xlsx",
    "xlsm",
    "xls",
    "txt",
    "md",
    "csv",
    "json",
  ];
  return (
    supportedExtensions.includes(ext) ||
    Boolean(mimeType?.startsWith("text/"))
  );
}
