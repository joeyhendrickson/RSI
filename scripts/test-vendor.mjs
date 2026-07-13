import { Pinecone } from "@pinecone-database/pinecone";
import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { retrieveContext } from "../src/lib/rag.ts";

const queries = [
  "What vendor did RSI hire?",
  "Who is RSI's ERP implementation partner?",
  "Who did Renaissance Services hire for Business Central?",
];

for (const q of queries) {
  console.log("\n===", q, "===");
  const chunks = await retrieveContext(q);
  for (const c of chunks.slice(0, 8)) {
    const tag = /dexpro/i.test(c.text) ? " [DEXPRO]" : "";
    console.log(
      c.score.toFixed(3),
      c.filename + tag,
      c.text.slice(0, 140).replace(/\n/g, " ")
    );
  }
}

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index("rsi", process.env.PINECONE_HOST);

const { embedding } = await embed({
  model: openai.embedding("text-embedding-3-large"),
  value: "Dexpro ERP implementation vendor partner Renaissance Services BC",
  providerOptions: { openai: { dimensions: 1024 } },
});

const res = await index.query({
  vector: embedding,
  topK: 15,
  includeMetadata: true,
});

console.log("\n=== Pinecone: dexpro/implementation partner ===");
for (const m of res.matches ?? []) {
  const t = String(m.metadata?.text || "");
  if (/dexpro|implementation plan|implementation partner|consulting firm/i.test(t)) {
    console.log(
      m.score?.toFixed(3),
      m.metadata?.filename,
      t.slice(0, 180).replace(/\n/g, " ")
    );
  }
}
