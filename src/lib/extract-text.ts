import path from "path";
import { extractImageText, isImageFile } from "./extract-image";
import { extractPptx } from "./extract-pptx";

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

async function extractXlsx(buffer: Buffer, filename: string): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet).trim();
    if (!csv) continue;

    const lines = csv.split("\n");
    const headerRow = lines[0] ?? "";
    const rowCount = Math.max(lines.length - 1, 0);

    parts.push(
      [
        `--- Business Central table export: ${sheetName} ---`,
        `File: ${filename}`,
        `Type: Direct Business Central table export from the RSI environment`,
        `Table/Sheet: ${sheetName}`,
        `Columns: ${headerRow}`,
        `Record count: ${rowCount}`,
        "",
        csv,
      ].join("\n")
    );
  }

  return parts.join("\n\n");
}

export function isSpreadsheetFile(filename: string, mimeType?: string): boolean {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return (
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "xlsm" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel.sheet.macroEnabled.12" ||
    mimeType === "application/vnd.ms-excel"
  );
}

export function isPresentationFile(filename: string, mimeType?: string): boolean {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return (
    ext === "pptx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
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
    return extractXlsx(buffer, filename);
  }

  if (isPresentationFile(filename, mimeType)) {
    return extractPptx(buffer, filename);
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
