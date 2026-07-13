import { computeRagConfidence } from "./rag-confidence";
import {
  classifyQueryStrategy,
  extractTopicTerms,
  type QueryStrategy,
} from "./rag-query";
import { retrieveContext, type RetrievedChunk } from "./rag";

/** Grounding score at or above this → skip follow-up retrieval passes. */
const SUFFICIENT_GROUNDING = 85;
const MAX_RETRIEVAL_PASSES = 3;

export interface AgenticRetrievalResult {
  chunks: RetrievedChunk[];
  strategy: QueryStrategy;
  passes: number;
  groundingScore: number;
  /** Human-readable log of what each pass did (shown in Evidence panel). */
  passLog: string[];
}

function dedupeMergedChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Map<string, RetrievedChunk>();
  for (const chunk of chunks) {
    const key = `${chunk.filename}::${chunk.text.slice(0, 180)}`;
    const existing = seen.get(key);
    if (!existing || chunk.score > existing.score) {
      seen.set(key, chunk);
    }
  }
  return [...seen.values()].sort((a, b) => b.score - a.score);
}

function followUpQueries(strategy: QueryStrategy, query: string): string[] {
  const terms = extractTopicTerms(query).slice(0, 4).join(" ");

  switch (strategy) {
    case "people_org":
      return [
        `RSI Renaissance Services organization chart named people and department titles ${terms}: ${query}`,
        `Who is listed on the RSI org chart for ${terms || "this role"}?`,
      ];
    case "implementation_partner":
      return [
        `Dexpro Renaissance Services BC Implementation Plan implementation partner vendor responsibilities: ${query}`,
        `Renaissance Services BC Implementation Plan consulting firm hired: ${query}`,
      ];
    case "bc_setup":
      return [
        `Business Central table export setup records RSI ${terms}: ${query}`,
        `RSI BC master data configuration ${query}`,
      ];
    case "process_narrative":
      return [
        `RSI Business Central workflow process steps swim lane flow chart: ${query}`,
        `Renaissance Services ${query} procedure workflow`,
      ];
    default:
      return [
        `Renaissance Services RSI specific documentation: ${query}`,
        `RSI internal ${query} Business Central`,
      ];
  }
}

/**
 * Multi-pass retrieval: classify → retrieve → evaluate grounding → re-query if needed.
 *
 * Extra cost is mostly embedding + Pinecone calls (typically 1–3 passes), not LLM tokens.
 * Final answer still uses one streamText call with a similar-sized context window.
 */
export async function retrieveContextAgentic(
  query: string
): Promise<AgenticRetrievalResult> {
  const strategy = classifyQueryStrategy(query);
  const passLog: string[] = [];

  let chunks = await retrieveContext(query);
  let confidence = computeRagConfidence(chunks, query);
  passLog.push(
    `Pass 1 (original query, strategy **${strategy}**): ${chunks.length} chunk(s), grounding ${confidence.groundingScore}/100`
  );

  if (confidence.groundingScore >= SUFFICIENT_GROUNDING) {
    return {
      chunks,
      strategy,
      passes: 1,
      groundingScore: confidence.groundingScore,
      passLog,
    };
  }

  const followUps = followUpQueries(strategy, query);
  let passes = 1;

  for (const followUp of followUps) {
    if (passes >= MAX_RETRIEVAL_PASSES) break;

    const more = await retrieveContext(followUp);
    passes++;
    chunks = dedupeMergedChunks([...chunks, ...more]);
    confidence = computeRagConfidence(chunks, query);
    passLog.push(
      `Pass ${passes} (follow-up retrieval): +${more.length} chunk(s) merged → ${chunks.length} total, grounding ${confidence.groundingScore}/100`
    );

    if (confidence.groundingScore >= SUFFICIENT_GROUNDING) break;
  }

  return {
    chunks,
    strategy,
    passes,
    groundingScore: confidence.groundingScore,
    passLog,
  };
}
