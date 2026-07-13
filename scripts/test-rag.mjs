import { retrieveContext, formatContextForPrompt } from "../src/lib/rag.ts";

const queries = [
  "Who leads accounting at RSI?",
  "Who is in finance on the org chart?",
  "Who is the controller at Renaissance Services?",
];

for (const q of queries) {
  console.log("\n===", q, "===");
  const chunks = await retrieveContext(q);
  for (const c of chunks.slice(0, 6)) {
    const hasBob = c.text.includes("Bob Fugazzi") ? " [Bob Fugazzi]" : "";
    const hasDex = c.filename.includes("Implementation") ? " [IMPL PLAN]" : "";
    console.log(
      `${c.score.toFixed(3)} ${c.filename}${hasBob}${hasDex}`,
      c.text.slice(0, 80).replace(/\n/g, " ")
    );
  }
}
