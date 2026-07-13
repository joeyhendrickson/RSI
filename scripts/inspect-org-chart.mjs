import { Pinecone } from "@pinecone-database/pinecone";
import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { retrieveContext } from "../src/lib/rag.ts";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index("rsi", process.env.PINECONE_HOST);

async function listOrgChunks() {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-large"),
    value: "RSI org chart all people names titles departments",
    providerOptions: { openai: { dimensions: 1024 } },
  });

  const res = await index.query({
    vector: embedding,
    topK: 20,
    includeMetadata: true,
    filter: { filename: { $eq: "RSI Org Chart 03-01-26.pptx" } },
  });

  console.log("=== ALL ORG CHART CHUNKS ===");
  for (const m of res.matches ?? []) {
    const t = String(m.metadata?.text || "");
    console.log("\n--- score", m.score?.toFixed(3), "len", t.length);
    console.log(t);
  }
}

async function testQueries() {
  const queries = [
    "Who leads Operations at RSI?",
    "show the RSI org chart operations owners",
    "Who leads manufacturing at RSI?",
  ];
  for (const q of queries) {
    console.log("\n=== retrieveContext:", q, "===");
    const chunks = await retrieveContext(q);
    for (const c of chunks) {
      console.log(c.score.toFixed(3), c.filename, c.text.slice(0, 200).replace(/\n/g, " "));
    }
  }
}

await listOrgChunks();
await testQueries();
