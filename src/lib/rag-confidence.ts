import type { RetrievedChunk } from "./rag";
import { classifyQueryStrategy, type QueryStrategy } from "./rag-query";
import { env } from "./env";

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export interface RagEvidenceChunk extends RetrievedChunk {
  rank: number;
}

export interface RagConfidence {
  level: ConfidenceLevel;
  /** Composite confidence score 0–100 — blends vector similarity with grounding quality. */
  score: number;
  label: string;
  summary: string;
  topScore: number;
  averageScore: number;
  matchCount: number;
  /** How well retrieved sources match the question type (0–100). */
  groundingScore: number;
}

export interface RagTurnMetadata {
  confidence: RagConfidence;
  evidence: RagEvidenceChunk[];
  logic: string;
  query: string;
}

const BROAD_NARRATIVE = [
  /RSI Internal ERP Intro/i,
  /RSI Overview and ERP Needs Summary/i,
  /RSI Business Overview/i,
];

function chunkHasPersonNames(text: string): boolean {
  return (
    /\b[A-Z][A-Za-z.'-]+ [A-Z][A-Za-z.'-]+\b/.test(text) ||
    /\b[A-Z]\.\s+[A-Z][A-Za-z.'-]+\b/.test(text)
  );
}

function isBroadNarrative(filename: string): boolean {
  return BROAD_NARRATIVE.some((p) => p.test(filename));
}

/** Measures whether retrieved chunks are the *right* sources for this question type. */
function assessGroundingQuality(
  strategy: QueryStrategy,
  chunks: RetrievedChunk[]
): number {
  if (chunks.length === 0) return 0;

  const filenames = chunks.map((c) => c.filename);
  const hasBroadOnly =
    filenames.length > 0 && filenames.every((f) => isBroadNarrative(f));

  switch (strategy) {
    case "implementation_partner": {
      const impl = chunks.filter(
        (c) => c.filename.includes("Implementation Plan") || /dexpro/i.test(c.text)
      );
      if (impl.length >= 1 && /dexpro/i.test(impl.map((c) => c.text).join("\n"))) {
        return 94;
      }
      return impl.length >= 1 ? 82 : 45;
    }
    case "people_org": {
      const org = chunks.filter(
        (c) => c.filename.includes("Org Chart") && chunkHasPersonNames(c.text)
      );
      if (org.length >= 2) return 95;
      if (org.length >= 1) return 90;
      return 50;
    }
    case "bc_setup": {
      const exports = chunks.filter((c) => c.filename.endsWith(".xlsx"));
      if (exports.length >= 1 && exports.length === chunks.length) return 93;
      if (exports.length >= 1) return 88;
      return 55;
    }
    case "process_narrative": {
      const processDocs = chunks.filter(
        (c) =>
          /flow|swim|process|workflow|persona|transcript|pptx|pdf/i.test(c.filename) &&
          !isBroadNarrative(c.filename)
      );
      if (processDocs.length >= 2) return 90;
      if (processDocs.length >= 1 && !hasBroadOnly) return 85;
      return hasBroadOnly ? 55 : 70;
    }
    default:
      if (hasBroadOnly) return 52;
      return Math.min(78, 55 + chunks.length * 3);
  }
}

function levelFromScore(score: number): ConfidenceLevel {
  if (score >= 85) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function labelFromLevel(level: ConfidenceLevel): string {
  if (level === "high") return "High confidence";
  if (level === "medium") return "Medium confidence";
  if (level === "low") return "Low confidence";
  return "No match";
}

function summaryForStrategy(
  strategy: QueryStrategy,
  groundingScore: number,
  chunks: RetrievedChunk[]
): string {
  if (groundingScore >= 90) {
    switch (strategy) {
      case "people_org":
        return "Retrieved RSI org chart excerpts with named leaders — answer directly from these sources.";
      case "implementation_partner":
        return "Retrieved the BC Implementation Plan with Dexpro — answer directly from this source.";
      case "bc_setup":
        return "Retrieved BC table exports with setup/master data — quote specific values from these records.";
      case "process_narrative":
        return "Retrieved RSI process and workflow documents — describe steps from these sources.";
      default:
        return "Retrieved strong RSI-specific sources for this question.";
    }
  }
  if (groundingScore >= 75) {
    return "Relevant RSI sources were retrieved. Some details may require synthesis across passages.";
  }
  if (chunks.some((c) => isBroadNarrative(c.filename))) {
    return "Retrieval returned mostly high-level ERP overview material. The answer may be broad — try a more specific question or check source files directly.";
  }
  return "Moderate matches only. Verify specifics against the source excerpts below.";
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
      groundingScore: 0,
    };
  }

  const strategy = query ? classifyQueryStrategy(query) : "general";
  const scores = chunks.map((c) => c.score);
  const topScore = Math.max(...scores);
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const vectorComposite = topScore * 0.55 + averageScore * 0.45;

  const groundingScore = assessGroundingQuality(strategy, chunks);
  const groundingNormalized = groundingScore / 100;

  const specialized =
    strategy === "people_org" ||
    strategy === "implementation_partner" ||
    strategy === "bc_setup" ||
    strategy === "process_narrative";

  // Blend vector similarity with grounding quality; specialized queries weight grounding heavily.
  const blendWeight = specialized ? 0.65 : 0.35;
  const composite = Math.min(
    1,
    vectorComposite * (1 - blendWeight) + groundingNormalized * blendWeight
  );

  const score = Math.round(composite * 100);
  const level = levelFromScore(score);

  return {
    level,
    score,
    label: labelFromLevel(level),
    summary: summaryForStrategy(strategy, groundingScore, chunks),
    topScore,
    averageScore,
    matchCount: chunks.length,
    groundingScore,
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

  const strategy = classifyQueryStrategy(query);
  const sourceList = evidence
    .map(
      (e) =>
        `- **${e.filename}** — match ${(e.score * 100).toFixed(1)}% (rank #${e.rank})`
    )
    .join("\n");

  return [
    "## How this answer was grounded",
    `Query strategy: **${strategy}**. Your question was embedded and searched against the Pinecone \`${env.pineconeIndexName()}\` index. **${evidence.length}** passage(s) were retrieved and injected into the advisor's system context.`,
    "",
    "## Confidence assessment",
    `- **Level:** ${confidence.label} (${confidence.score}/100)`,
    `- **Grounding quality:** ${confidence.groundingScore}/100 — how well the retrieved sources match this question type`,
    `- **Vector similarity:** best ${(confidence.topScore * 100).toFixed(1)}%, average ${(confidence.averageScore * 100).toFixed(1)}%`,
    "",
    confidence.summary,
    "",
    "## Sources used (ranked by relevance)",
    sourceList,
    "",
    "## Interpretation guide",
    "- **≥ 85 (High):** Correct source type retrieved — answer should be RSI-specific and direct.",
    "- **55–84 (Medium):** Partial or mixed sources — verify specifics.",
    "- **< 55 (Low):** Weak or off-topic retrieval — treat as advisory only.",
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
