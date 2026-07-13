import { retrieveContext } from "../src/lib/rag.ts";
import { buildRagTurnMetadata } from "../src/lib/rag-confidence.ts";
import { classifyQueryStrategy } from "../src/lib/rag-query.ts";

const queries = [
  "What vendor did RSI hire?",
  "Who leads accounting at RSI?",
  "Who leads Operations at RSI?",
  "What posting groups are in the chart of accounts?",
  "How does procure to pay work at RSI?",
  "What modules are in Business Central?",
];

for (const q of queries) {
  const strategy = classifyQueryStrategy(q);
  const chunks = await retrieveContext(q);
  const meta = buildRagTurnMetadata(q, chunks);
  console.log(
    `\n${q}\n  strategy=${strategy} chunks=${chunks.length} files=${[...new Set(chunks.map((c) => c.filename))].join(", ")}\n  confidence=${meta.confidence.score} (${meta.confidence.label}) top=${(meta.confidence.topScore * 100).toFixed(1)}% avg=${(meta.confidence.averageScore * 100).toFixed(1)}%`
  );
}
