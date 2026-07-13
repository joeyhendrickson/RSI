import { retrieveContext, formatContextForPrompt } from "../src/lib/rag.ts";
import { classifyQueryStrategy } from "../src/lib/rag-query.ts";

const BROAD = /RSI Internal ERP Intro|RSI Overview and ERP Needs Summary|RSI Business Overview/i;

const cases = [
  {
    q: "What vendor did RSI hire?",
    expect: { strategy: "implementation_partner", files: [/Implementation Plan/i], noBroad: true },
  },
  {
    q: "Who leads accounting at RSI?",
    expect: { strategy: "people_org", files: [/Org Chart/i], names: ["Bob Fugazzi"], noBroad: true },
  },
  {
    q: "Who leads Operations at RSI?",
    expect: { strategy: "people_org", files: [/Org Chart/i], names: ["Deptowicz"], noBroad: true },
  },
  {
    q: "What posting groups are in the chart of accounts?",
    expect: { strategy: "bc_setup", files: [/Chart of Accounts/i], noBroad: true },
  },
];

let passed = 0;
for (const { q, expect } of cases) {
  const strategy = classifyQueryStrategy(q);
  const chunks = await retrieveContext(q);
  const files = chunks.map((c) => c.filename);
  const broadCount = files.filter((f) => BROAD.test(f)).length;

  const ok =
    strategy === expect.strategy &&
    expect.files.every((re) => files.some((f) => re.test(f))) &&
    (!expect.names || expect.names.every((n) => chunks.some((c) => c.text.includes(n)))) &&
    (!expect.noBroad || broadCount === 0);

  console.log(`\n${ok ? "PASS" : "FAIL"} — ${q}`);
  console.log(`  strategy: ${strategy} (expected ${expect.strategy})`);
  console.log(`  top files: ${files.slice(0, 5).join(", ")}`);
  console.log(`  broad narrative chunks: ${broadCount}`);
  if (expect.names) {
    for (const n of expect.names) {
      console.log(`  has ${n}: ${chunks.some((c) => c.text.includes(n))}`);
    }
  }
  console.log(`  answer focus: ${formatContextForPrompt(chunks, q).split("\n")[1]?.slice(0, 80)}`);
  if (ok) passed++;
}

console.log(`\n${passed}/${cases.length} passed`);
process.exit(passed === cases.length ? 0 : 1);
