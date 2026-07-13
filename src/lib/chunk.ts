export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

/** Pull slide/notes label from a presentation section header, if present. */
export function parseSlideSectionLabel(section: string): string | null {
  const header = section.split("\n")[0]?.trim() ?? "";
  const slideMatch = header.match(/^--- Slide (\d+) ---$/);
  if (slideMatch) return `Slide ${slideMatch[1]}`;

  const notesMatch = header.match(/^--- Speaker notes \(slide (\d+)\) ---$/);
  if (notesMatch) return `Speaker notes ${notesMatch[1]}`;

  return null;
}

/** Pull BC table export label from a spreadsheet section header, if present. */
export function parseSpreadsheetSectionLabel(section: string): string | null {
  const header = section.split("\n")[0]?.trim() ?? "";
  const match = header.match(/^--- Business Central table export: (.+) ---$/);
  return match ? `BC export: ${match[1]}` : null;
}

export function parseSectionLabel(section: string): string | null {
  return parseSlideSectionLabel(section) ?? parseSpreadsheetSectionLabel(section);
}

function chunkSpreadsheetSection(
  section: string,
  { chunkSize = 1400, overlap = 100 }: ChunkOptions = {}
): string[] {
  const lines = section.trim().split("\n");
  let dataStart = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("Record count:")) {
      dataStart = i + 1;
      while (dataStart < lines.length && !lines[dataStart].trim()) {
        dataStart++;
      }
      break;
    }
  }

  if (dataStart === 0 || dataStart >= lines.length) {
    return section.length <= chunkSize ? [section] : chunkText(section, { chunkSize, overlap });
  }

  const preamble = lines.slice(0, dataStart).join("\n");
  const tableLines = lines.slice(dataStart);
  const headerRow = tableLines[0] ?? "";
  const dataRows = tableLines.slice(1);

  if (section.length <= chunkSize) {
    return [section];
  }

  const chunks: string[] = [];
  let batch: string[] = [];
  let currentLen = preamble.length + headerRow.length + 2;

  for (const row of dataRows) {
    const rowLen = row.length + 1;
    if (batch.length > 0 && currentLen + rowLen > chunkSize) {
      chunks.push([preamble, headerRow, ...batch].join("\n"));
      batch = overlap > 0 ? batch.slice(-Math.max(1, Math.floor(overlap / 40))) : [];
      currentLen = preamble.length + headerRow.length + 2 + batch.reduce((n, r) => n + r.length + 1, 0);
    }
    batch.push(row);
    currentLen += rowLen;
  }

  if (batch.length > 0) {
    chunks.push([preamble, headerRow, ...batch].join("\n"));
  }

  return chunks;
}

/**
 * Chunk BC spreadsheet exports without splitting across sheets.
 * Each chunk repeats column headers for large tables.
 */
export function chunkSpreadsheetText(
  text: string,
  options: ChunkOptions = {}
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const sections = normalized
    .split(/\n\n(?=--- Business Central table export:)/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length === 0) {
    return chunkText(normalized, options);
  }

  return sections.flatMap((section) => chunkSpreadsheetSection(section, options));
}

/**
 * Chunk presentation exports without splitting across slide boundaries.
 * Large slides are sub-chunked, but never merged with adjacent slides.
 */
export function chunkPresentationText(
  text: string,
  { chunkSize = 1400, overlap = 150 }: ChunkOptions = {}
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const sections = normalized
    .split(/\n\n(?=--- (?:Slide \d+|Speaker notes \(slide \d+\)) ---)/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length === 0) {
    return chunkText(normalized, { chunkSize, overlap });
  }

  const chunks: string[] = [];
  for (const section of sections) {
    if (section.length <= chunkSize) {
      chunks.push(section);
      continue;
    }
    chunks.push(...chunkText(section, { chunkSize, overlap }));
  }
  return chunks;
}

/**
 * Splits text into overlapping chunks, preferring paragraph/sentence
 * boundaries near the target size so embeddings aren't cut mid-thought.
 */
export function chunkText(
  text: string,
  { chunkSize = 1200, overlap = 200 }: ChunkOptions = {}
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      const window = normalized.slice(start, end);
      const boundary = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("\n")
      );
      if (boundary > chunkSize * 0.5) {
        end = start + boundary + 1;
      }
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

/** Prefix filename (and slide when known) so embeddings capture document context. */
export function enrichChunkForEmbedding(
  chunk: string,
  filename: string
): string {
  const sectionLabel = parseSectionLabel(chunk);
  const header = sectionLabel
    ? `[Document: ${filename} | ${sectionLabel}]`
    : `[Document: ${filename}]`;
  return `${header}\n${chunk}`;
}

export function chunkFileText(
  text: string,
  filename: string,
  mimeType?: string
): string[] {
  const lower = filename.toLowerCase();

  if (
    lower.endsWith(".pptx") ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return chunkPresentationText(text);
  }

  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsm") ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel.sheet.macroEnabled.12" ||
    mimeType === "application/vnd.ms-excel"
  ) {
    return chunkSpreadsheetText(text);
  }

  return chunkText(text);
}
