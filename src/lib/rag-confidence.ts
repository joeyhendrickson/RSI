import type { RetrievedChunk } from "./rag";
import { classifyQueryStrategy, isPeopleOrgQuery } from "./rag-query";
import { env } from "./env";

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export interface RagEvidenceChunk extends RetrievedChunk {
  rank: number;
}

export interface RagConfidence {
  level: ConfidenceLevel;
  /** Composite confidence score 0–100 derived from vector match quality. */
  score: number;
  label: string;
  summary: string;
  topScore: number;
  averageScore: number;
  matchCount: number;
}

export interface RagTurnMetadata {
  confidence: RagConfidence;
  evidence: RagEvidenceChunk[];
  logic: string;
  query: string;
}

export function computeRagConfidence(
  chunks: RetrievedChunk[],
  query?: string
): RagConfidence {
  if (chunks.length === 0) {
    return {
      level: "none",
      score: 0,
      label: "No match",
      summary: "No relevant passages were retrieved from the knowledge base.",
      topScore: 0,
      averageScore: 0,
      matchCount: 0,
    };
  }

  const orgNamed = chunks.filter(
    (c) =>
      c.filename.includes("Org Chart") &&
      (/\b[A-Z][A-Za-z.'-]+ [A-Z][A-Za-z.'-]+\b/.test(c.text) ||
        /\b[A-Z]\.\s+[A-Z][A-Za-z.'-]+\b/.test(c.text))
  );

  const strategy = query ? classifyQueryStrategy(query) : "general";
  const peopleQuery = strategy === "people_org";
  const specializedQuery =
    strategy === "people_org" ||
    strategy === "implementation_partner" ||
    strategy === "bc_setup";

  const specializedChunks =
    strategy === "people_org" && orgNamed.length >= 1
      ? orgNamed
      : strategy === "implementation_partner"
        ? chunks.filter(
            (c) =>
              c.filename.includes("Implementation Plan") || /dexpro/i.test(c.text)
          )
        : strategy === "bc_setup"
          ? chunks.filter((c) => c.filename.endsWith(".xlsx"))
          : chunks;

  const scoreChunks =
    specializedQuery && specializedChunks.length >= 1 ? specializedChunks : chunks;

  const scores = scoreChunks.map((c) => c.score);
  const topScore = Math.max(...scores);
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  let composite = topScore * 0.55 + averageScore * 0.45;

  if (peopleQuery && orgNamed.length >= 1) {
    composite = Math.min(1, composite + 0.08);
  } else if (strategy === "implementation_partner" && specializedChunks.length >= 1) {
    composite = Math.min(1, composite + 0.06);
  } else if (strategy === "bc_setup" && specializedChunks.length >= 1) {
    composite = Math.min(1, composite + 0.05);
  }

  const score = Math.round(Math.min(1, Math.max(0, composite)) * 100);

  let level: ConfidenceLevel;
  let label: string;
  let summary: string;

  if (score >= 72 && topScore >= 0.62) {
    level = "high";
    label = "High confidence";
    summary = peopleQuery && orgNamed.length >= 1
      ? "Strong org chart matches with named RSI leaders support this answer."
      : strategy === "implementation_partner" && specializedChunks.length >= 1
        ? "Strong matches from the BC Implementation Plan support this answer."
        : strategy === "bc_setup" && specializedChunks.length >= 1
          ? "Strong matches from BC table exports support this answer."
          : "Strong semantic matches in the knowledge base support this answer. Retrieved passages closely align with your question.";
  } else if (score >= 42 && topScore >= 0.42) {
    level = "medium";
    label = "Medium confidence";
    summary =
      "Moderate matches were found. The answer uses relevant knowledge base context, but some details may be inferred or partially covered.";
  } else {
    level = "low";
    label = "Low confidence";
    summary =
      "Weak matches only. The advisor may rely more on general Business Central knowledge than on your uploaded documents.";
  }

  return {
    level,
    score,
    label,
    summary,
    topScore,
    averageScore,
    matchCount: chunks.length,
  };
}

export function buildRagTurnMetadata(
  query: string,
  chunks: RetrievedChunk[]
): RagTurnMetadata {
  const evidence: RagEvidenceChunk[] = chunks.map((chunk, index) => ({
    ...chunk,
    rank: index + 1,
  }));
  const confidence = computeRagConfidence(chunks, query);
  const logic = buildEvidenceLogic(query, confidence, evidence);

  return { confidence, evidence, logic, query };
}

function buildEvidenceLogic(
  query: string,
  confidence: RagConfidence,
  evidence: RagEvidenceChunk[]
): string {
  if (evidence.length === 0) {
    return [
      "## Retrieval result",
      "No vector matches were returned from Pinecone for this question.",
      "",
      "## What this means",
      "The advisor answered using general Business Central expertise only — not passages from your uploaded knowledge base.",
      "",
      "## Recommendation",
      "Try rephrasing with terms from your documents (process names, persona titles, module names), or vectorize additional files in the Knowledge Base tab.",
    ].join("\n");
  }

  const sourceList = evidence
    .map(
      (e) =>
        `- **${e.filename}** — match ${(e.score * 100).toFixed(1)}% (rank #${e.rank})`
    )
    .join("\n");

  return [
    "## How this answer was grounded",
    `Your question was embedded and searched against the Pinecone \`${env.pineconeIndexName()}\` index. **${evidence.length}** passage(s) were retrieved and injected into the advisor's system context before the response was generated.`,
    "",
    "## Confidence assessment",
    `- **Level:** ${confidence.label} (${confidence.score}/100)`,
    `- **Best match:** ${(confidence.topScore * 100).toFixed(1)}% semantic similarity`,
    `- **Average match:** ${(confidence.averageScore * 100).toFixed(1)}% across retrieved passages`,
    "",
    confidence.summary,
    "",
    "## Sources used (ranked by relevance)",
    sourceList,
    "",
    "## Interpretation guide",
    "- **≥ 72/100 (High):** Answer is strongly supported by your documents.",
    "- **42–71 (Medium):** Partial support — verify specifics against source excerpts below.",
    "- **< 42 (Low):** Treat as advisory; confirm against original files.",
    "",
    `## Query analyzed`,
    `"${query}"`,
  ].join("\n");
}

/** Prefix line sent before streamed assistant text in /api/chat. */
export const RAG_METADATA_PREFIX = "__RAG_METADATA__";

export function encodeRagMetadataLine(metadata: RagTurnMetadata): string {
  return `${RAG_METADATA_PREFIX}${JSON.stringify(metadata)}\n`;
}

export function parseRagMetadataLine(
  line: string
): RagTurnMetadata | null {
  if (!line.startsWith(RAG_METADATA_PREFIX)) return null;
  try {
    return JSON.parse(line.slice(RAG_METADATA_PREFIX.length)) as RagTurnMetadata;
  } catch {
    return null;
  }
}
