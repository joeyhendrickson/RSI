import { retrieveContext, formatContextForPrompt } from "../src/lib/rag.ts";
import { buildRagTurnMetadata } from "../src/lib/rag-confidence.ts";

const q = "Who leads Operations at RSI?";
const chunks = await retrieveContext(q);
console.log(formatContextForPrompt(chunks, q).split("\n").slice(0, 18).join("\n"));
const meta = buildRagTurnMetadata(q, chunks);
console.log("\nconfidence:", meta.confidence.score, meta.confidence.label);
