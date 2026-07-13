import { embed } from "ai";
import { embeddingModel, embeddingProviderOptions } from "./ai";
import { parseSectionLabel } from "./chunk";
import { getPineconeIndex } from "./pinecone";
import {
  classifyQueryStrategy,
  extractTopicTerms,
  isImplementationPartnerQuery,
  isPeopleOrgQuery,
  type QueryStrategy,
} from "./rag-query";

export {
  classifyQueryStrategy,
  isImplementationPartnerQuery,
  isPeopleOrgQuery,
} from "./rag-query";

export interface RetrievedChunk {
  text: string;
  filename: string;
  score: number;
  sectionLabel?: string;
}

const DEFAULT_TOP_K = 12;

const BROAD_NARRATIVE_FILE_PATTERNS = [
  /RSI Internal ERP Intro/i,
  /RSI Overview and ERP Needs Summary/i,
  /RSI Business Overview/i,
];

interface StrategyConfig {
  topK: number;
  maxFiller: number;
  excludeBroadNarrative: boolean;
  minPriorityChunks: number;
}

const STRATEGY_CONFIG: Record<QueryStrategy, StrategyConfig> = {
  people_org: {
    topK: 8,
    maxFiller: 0,
    excludeBroadNarrative: true,
    minPriorityChunks: 1,
  },
  implementation_partner: {
    topK: 8,
    maxFiller: 1,
    excludeBroadNarrative: true,
    minPriorityChunks: 1,
  },
  bc_setup: {
    topK: 8,
    maxFiller: 2,
    excludeBroadNarrative: true,
    minPriorityChunks: 1,
  },
  process_narrative: {
    topK: 12,
    maxFiller: 6,
    excludeBroadNarrative: false,
    minPriorityChunks: 2,
  },
  general: {
    topK: 12,
    maxFiller: 12,
    excludeBroadNarrative: false,
    minPriorityChunks: 0,
  },
};

const ANSWER_FOCUS: Record<QueryStrategy, string> = {
  people_org:
    "Answer directly with named people and RSI department titles from the org chart excerpts. Do not hedge with generic Business Central role descriptions.",
  implementation_partner:
    "Answer with the implementation partner named in the BC Implementation Plan (Dexpro). Do not cite Vendors.xlsx or generic ERP overview documents.",
  bc_setup:
    "Answer with specific values from the BC table exports (account numbers, posting groups, codes, records). Quote exact data — do not generalize.",
  process_narrative:
    "Answer from the retrieved RSI process and workflow documents. Prefer specific steps and personas named in the excerpts.",
  general:
    "Answer from the most relevant retrieved excerpts. Prefer RSI-specific sources over generic ERP summaries when both are present.",
};

const ORG_CHART_FILES = ["RSI Org Chart 03-01-26.pptx"];

const IMPLEMENTATION_PLAN_FILES = [
  "Renaissance Services BC Implementation Plan - JH.xlsx",
];

/** Map question themes to direct BC table export files in the knowledge base. */
const BC_EXPORT_FILE_HINTS: { pattern: RegExp; files: string[] }[] = [
  {
    pattern:
      /chart of accounts|g\/l account|gl account|posting group|account categor|gen\.\s*posting|coa\b/i,
    files: ["Chart of Accounts.xlsx", "G_L Account Categories.xlsx"],
  },
  {
    pattern: /dimension|project code|project filter/i,
    files: ["Dimensions.xlsx"],
  },
  {
    pattern:
      /accounts payable|vendor master|vendor record|purchase invoice|purchase order|procure|supplier master|\bvendors?\s+(?:master|record|setup|list|table|export|number|posting|code)/i,
    files: [
      "Vendors.xlsx",
      "Purchase Orders.xlsx",
      "Purchase Invoices.xlsx",
      "Posted Purchase Invoices.xlsx",
    ],
  },
  {
    pattern:
      /implementation plan|implementation partner|consulting firm|who did.*hire|dexpro|configuration.*responsibilit/i,
    files: IMPLEMENTATION_PLAN_FILES,
  },
  {
    pattern:
      /customer|accounts receivable|sales order|sales invoice|quote.?to.?cash|order.?to.?cash/i,
    files: [
      "Customers.xlsx",
      "Sales Orders.xlsx",
      "Sales Invoices.xlsx",
      "Posted Sales Invoices.xlsx",
    ],
  },
  {
    pattern: /item|inventory|sku|stock/i,
    files: ["Items.xlsx"],
  },
  {
    pattern: /payment terms|bank account|cash receipt|journal batch|general journal/i,
    files: [
      "Payment Terms.xlsx",
      "Bank Accounts.xlsx",
      "Cash Receipt Journals.xlsx",
      "General Journal Batches.xlsx",
    ],
  },
  {
    pattern:
      /setup record|configuration|table export|business central table|bc table|master data|posting setup|security role|approval workflow|number series|extension/i,
    files: [
      "Chart of Accounts.xlsx",
      "Dimensions.xlsx",
      "Vendors.xlsx",
      "Customers.xlsx",
      "Items.xlsx",
      "BC Table Information 03-02-26.xlsx",
      "RSI BC Assisted Setup - JH.xlsx",
    ],
  },
];


function buildRetrievalQuery(query: string): string {
  return `Renaissance Services RSI Business Central knowledge base question: ${query}`;
}

function buildExportRetrievalQuery(query: string): string {
  return `Business Central table export configuration setup records master data: ${query}`;
}

function buildOrgPeopleRetrievalQuery(query: string): string {
  return `RSI Renaissance Services organization chart people names titles departments roles reporting structure: ${query}`;
}

function buildImplementationRetrievalQuery(query: string): string {
  return `RSI Renaissance Services Business Central ERP implementation partner consulting vendor Dexpro implementation plan rollout responsibilities: ${query}`;
}

function isBroadNarrativeFile(filename: string): boolean {
  return BROAD_NARRATIVE_FILE_PATTERNS.some((pattern) => pattern.test(filename));
}

function hintedFilenames(query: string): string[] {
  const files = new Set<string>();
  for (const hint of BC_EXPORT_FILE_HINTS) {
    if (hint.pattern.test(query)) {
      for (const file of hint.files) {
        files.add(file);
      }
    }
  }
  return [...files];
}

function mapMatchToChunk(match: {
  score?: number;
  metadata?: Record<string, unknown>;
}): RetrievedChunk {
  const text = (match.metadata?.text as string) ?? "";
  return {
    text,
    filename: (match.metadata?.filename as string) ?? "unknown",
    score: match.score ?? 0,
    sectionLabel:
      (match.metadata?.sectionLabel as string | undefined) ??
      parseSectionLabel(text) ??
      undefined,
  };
}

function chunkHasPersonNames(text: string): boolean {
  return (
    /\b[A-Z][A-Za-z.'-]+ [A-Z][A-Za-z.'-]+\b/.test(text) ||
    /\b[A-Z]\.\s+[A-Z][A-Za-z.'-]+\b/.test(text)
  );
}

function isOrgChartMetaChunk(chunk: RetrievedChunk): boolean {
  if (!chunk.filename.includes("Org Chart")) return false;
  const text = chunk.text.trim();
  if (text.startsWith("## Description") || text.startsWith("cription")) return true;
  if (
    /organization chart showing executive leadership, departments, functional owners/i.test(
      text
    ) &&
    !text.includes("--- Slide 1 ---") &&
    !/CEO\s*&\s*Managing Partner|Operations\s*&\s*PERFECT-3D/i.test(text)
  ) {
    return true;
  }
  return false;
}

function isUsefulOrgChartChunk(chunk: RetrievedChunk): boolean {
  if (!chunk.filename.includes("Org Chart")) return true;
  if (isOrgChartMetaChunk(chunk)) return false;
  if (chunk.text.includes("Vision OCR")) return true;
  if (chunkHasPersonNames(chunk.text)) return true;
  return chunk.text.length >= 500;
}

function dedupeChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Map<string, RetrievedChunk>();

  for (const chunk of chunks) {
    if (!isUsefulOrgChartChunk(chunk)) continue;

    const key = `${chunk.filename}::${chunk.text.slice(0, 160)}`;
    const existing = seen.get(key);
    if (!existing || chunk.score > existing.score) {
      seen.set(key, chunk);
    }
  }

  return [...seen.values()];
}

function rerankForPeopleQueries(
  query: string,
  chunks: RetrievedChunk[]
): RetrievedChunk[] {
  if (!isPeopleOrgQuery(query)) {
    return chunks.sort((a, b) => b.score - a.score);
  }

  const topicTerms = extractTopicTerms(query);

  return [...chunks].sort((a, b) => {
    const aScore = peopleChunkPriority(a, topicTerms);
    const bScore = peopleChunkPriority(b, topicTerms);
    if (aScore !== bScore) return bScore - aScore;
    return b.score - a.score;
  });
}

function peopleChunkPriority(chunk: RetrievedChunk, topicTerms: string[]): number {
  let priority = 0;
  const text = chunk.text.toLowerCase();

  if (chunk.filename.includes("Org Chart")) priority += 100;
  if (chunk.text.includes("Vision OCR")) priority += 40;
  if (chunkHasPersonNames(chunk.text)) priority += 30;

  for (const term of topicTerms) {
    if (text.includes(term)) priority += 20;
  }

  if (
    topicTerms.some((term) => ["accounting", "controller", "finance"].includes(term)) &&
    /controller\s*&\s*accounting|accounting|controller|finance/i.test(chunk.text) &&
    chunkHasPersonNames(chunk.text)
  ) {
    priority += 50;
  }

  if (
    topicTerms.some((term) =>
      ["operations", "manufacturing", "perfect-3d"].includes(term)
    ) &&
    /operations\s*&\s*perfect-3d|manufacturing\s*&\s*quality/i.test(chunk.text) &&
    chunkHasPersonNames(chunk.text)
  ) {
    priority += 50;
  }

  if (isOrgChartMetaChunk(chunk)) priority -= 80;

  return priority;
}

function selectPriorityChunks(
  strategy: QueryStrategy,
  query: string,
  ranked: RetrievedChunk[]
): RetrievedChunk[] {
  switch (strategy) {
    case "implementation_partner":
      return ranked.filter(
        (c) =>
          IMPLEMENTATION_PLAN_FILES.some((file) => c.filename === file) ||
          /dexpro/i.test(c.text)
      );
    case "people_org":
      return ranked.filter(
        (c) =>
          c.filename.includes("Org Chart") &&
          chunkHasPersonNames(c.text) &&
          !isOrgChartMetaChunk(c)
      );
    case "bc_setup": {
      const hints = hintedFilenames(query);
      return ranked.filter((c) => hints.includes(c.filename));
    }
    default:
      return [];
  }
}

function composeStrategyContext(
  strategy: QueryStrategy,
  query: string,
  ranked: RetrievedChunk[],
  topK: number
): RetrievedChunk[] {
  const config = STRATEGY_CONFIG[strategy];
  let pool = ranked;

  if (strategy === "implementation_partner") {
    pool = pool.filter((c) => c.filename !== "Vendors.xlsx");
  }

  if (config.excludeBroadNarrative) {
    const withoutBroad = pool.filter((c) => !isBroadNarrativeFile(c.filename));
    if (withoutBroad.length > 0) {
      pool = withoutBroad;
    }
  }

  const priority = selectPriorityChunks(strategy, query, pool);
  if (priority.length >= config.minPriorityChunks) {
    const filler = pool
      .filter((c) => !priority.includes(c))
      .slice(0, config.maxFiller);
    return [...priority, ...filler].slice(0, config.topK);
  }

  return pool.slice(0, topK);
}

export async function retrieveContext(
  query: string,
  topK = DEFAULT_TOP_K
): Promise<RetrievedChunk[]> {
  const strategy = classifyQueryStrategy(query);
  const strategyConfig = STRATEGY_CONFIG[strategy];
  const effectiveTopK = Math.min(topK, strategyConfig.topK);

  const exportFilenames = hintedFilenames(query);
  const peopleQuery = strategy === "people_org";
  const implementationQuery = strategy === "implementation_partner";

  type EmbedKey = "primary" | "export" | "org" | "impl";
  const embedJobs: { key: EmbedKey; promise: Promise<{ embedding: number[] }> }[] =
    [
      {
        key: "primary",
        promise: embed({
          model: embeddingModel(),
          value: buildRetrievalQuery(query),
          providerOptions: embeddingProviderOptions(),
        }),
      },
    ];

  if (exportFilenames.length > 0) {
    embedJobs.push({
      key: "export",
      promise: embed({
        model: embeddingModel(),
        value: buildExportRetrievalQuery(query),
        providerOptions: embeddingProviderOptions(),
      }),
    });
  }

  if (peopleQuery) {
    embedJobs.push({
      key: "org",
      promise: embed({
        model: embeddingModel(),
        value: buildOrgPeopleRetrievalQuery(query),
        providerOptions: embeddingProviderOptions(),
      }),
    });
  }

  if (implementationQuery) {
    embedJobs.push({
      key: "impl",
      promise: embed({
        model: embeddingModel(),
        value: buildImplementationRetrievalQuery(query),
        providerOptions: embeddingProviderOptions(),
      }),
    });
  }

  const embeddingResults = await Promise.all(embedJobs.map((job) => job.promise));
  const embeddings = Object.fromEntries(
    embedJobs.map((job, index) => [job.key, embeddingResults[index].embedding])
  ) as Record<EmbedKey, number[]>;

  const index = getPineconeIndex();

  const primaryTopK =
    strategy !== "general" && strategy !== "process_narrative"
      ? Math.min(effectiveTopK, 6)
      : topK + 4;

  const [primaryResults, exportResults, orgResults, implResults] = await Promise.all([
    index.query({
      vector: embeddings.primary,
      topK: primaryTopK,
      includeMetadata: true,
    }),
    embeddings.export
      ? index.query({
          vector: embeddings.export,
          topK: Math.min(exportFilenames.length * 3, 12),
          includeMetadata: true,
          filter: { filename: { $in: exportFilenames } },
        })
      : Promise.resolve({ matches: [] }),
    embeddings.org
      ? index.query({
          vector: embeddings.org,
          topK: 8,
          includeMetadata: true,
          filter: { filename: { $in: ORG_CHART_FILES } },
        })
      : Promise.resolve({ matches: [] }),
    embeddings.impl
      ? index.query({
          vector: embeddings.impl,
          topK: 10,
          includeMetadata: true,
          filter: { filename: { $in: IMPLEMENTATION_PLAN_FILES } },
        })
      : Promise.resolve({ matches: [] }),
  ]);

  const primary = (primaryResults.matches ?? []).map(mapMatchToChunk);
  const exports = (exportResults.matches ?? []).map((match) => ({
    ...mapMatchToChunk(match),
    score: Math.max(match.score ?? 0, 0.72),
  }));
  const orgPeople = (orgResults.matches ?? []).map((match) => ({
    ...mapMatchToChunk(match),
    score: Math.max(match.score ?? 0, 0.8),
  }));
  const implementation = (implResults.matches ?? []).map((match) => ({
    ...mapMatchToChunk(match),
    score: Math.max(match.score ?? 0, 0.85),
  }));

  const merged = dedupeChunks([...implementation, ...orgPeople, ...exports, ...primary]);
  const ranked = rerankForPeopleQueries(query, merged);

  return composeStrategyContext(strategy, query, ranked, effectiveTopK);
}

const ORG_DEPARTMENTS: { dept: RegExp; label: string }[] = [
  { dept: /CEO\s*&\s*Managing Partner/i, label: "CEO & Managing Partner" },
  { dept: /Operations\s*&\s*PERFECT-3D/i, label: "Operations & PERFECT-3D" },
  { dept: /Manufacturing\s*&\s*Quality Engineering/i, label: "Manufacturing & Quality Engineering" },
  { dept: /Business Development\s*&\s*Supply Chain/i, label: "Business Development & Supply Chain" },
  { dept: /Controller\s*&\s*Accounting/i, label: "Controller & Accounting" },
  { dept: /Sales\s*&\s*Programs/i, label: "Sales & Programs" },
  { dept: /Strategic Initiatives/i, label: "Strategic Initiatives" },
  { dept: /Human Resource Administration/i, label: "Human Resource Administration" },
  { dept: /Information Technology\s*&\s*ERP/i, label: "Information Technology & ERP" },
];

const PERSON_TOKEN =
  /^(?:\*\*)?((?:[A-Z][A-Za-z.'-]+\s+)+[A-Z][A-Za-z.'-]+(?:\s+\[R\])?|[A-Z]\.\s+[A-Za-z.'-]+(?:\s+\[R\])?|\[Open\])(?:\*\*)?$/;

function normalizePerson(raw: string): string {
  return raw.replace(/\*\*/g, "").replace(/\s+\[R\]/, " [R]").trim();
}

function personFromLineTail(tail: string): string | null {
  const cleaned = tail.replace(/\*\*/g, " ").replace(/\s+/g, " ").trim();
  const match = cleaned.match(
    /^((?:[A-Z][A-Za-z.'-]+\s+)+[A-Z][A-Za-z.'-]+(?:\s+\[R\])?|[A-Z]\.\s+[A-Za-z.'-]+(?:\s+\[R\])?|\[Open\])/
  );
  return match ? normalizePerson(match[1]) : null;
}

function extractOrgRoles(chunks: RetrievedChunk[]): { label: string; person: string }[] {
  const lines = chunks.flatMap((c) => c.text.split("\n"));
  const roles: { label: string; person: string }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\*\*/g, "").trim();
    if (!line) continue;

    for (const { dept, label } of ORG_DEPARTMENTS) {
      if (seen.has(label) || !dept.test(line)) continue;

      const inlineTail = line.replace(dept, "").replace(/^[\s—–\-:]+/, "").trim();
      let person = personFromLineTail(inlineTail);

      if (!person) {
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const next = lines[j].trim().replace(/^[-*]\s*/, "");
          if (PERSON_TOKEN.test(next)) {
            person = normalizePerson(next);
            break;
          }
          if (next && !next.startsWith("-") && ORG_DEPARTMENTS.some((d) => d.dept.test(next))) {
            break;
          }
        }
      }

      if (person) {
        seen.add(label);
        roles.push({ label, person });
      }
    }
  }

  return roles;
}

export function formatContextForPrompt(
  chunks: RetrievedChunk[],
  query?: string
): string {
  if (chunks.length === 0) {
    return "No relevant knowledge base context was found for this query.";
  }

  const strategy = query ? classifyQueryStrategy(query) : "general";
  let header = `## Answer focus\n${ANSWER_FOCUS[strategy]}\n\n`;

  if (query && isImplementationPartnerQuery(query)) {
    const implText = chunks.map((c) => c.text).join("\n");
    if (/dexpro/i.test(implText)) {
      header +=
        "## RSI BC implementation partner (from retrieved excerpts)\n" +
        "**Dexpro** is named in the BC Implementation Plan as the implementation/configuration partner for RSI's Business Central rollout. " +
        "Do not confuse this with Vendors.xlsx (supplier master data in BC).\n\n";
    }
  }
  if (query && isPeopleOrgQuery(query)) {
    const orgChunks = chunks.filter((c) => c.filename.includes("Org Chart"));
    const roles = extractOrgRoles(orgChunks);
    if (roles.length > 0) {
      header +=
        "## RSI org chart — named functional leads (parsed from retrieved excerpts)\n" +
        roles.map((r) => `- **${r.label}:** ${r.person}`).join("\n") +
        "\n\nUse these names when answering who leads a department. RSI uses department names like \"Operations & PERFECT-3D\" rather than a standalone \"Operations\" title.\n\n";
    }
  }

  if (query && strategy === "bc_setup") {
    const exportFiles = [...new Set(chunks.map((c) => c.filename))];
    header +=
      "## BC table exports retrieved\n" +
      exportFiles.map((f) => `- ${f}`).join("\n") +
      "\n\nQuote specific rows, codes, and posting groups from these exports — not generic BC guidance.\n\n";
  }

  const body = chunks
    .map((chunk, i) => {
      const location = chunk.sectionLabel
        ? `${chunk.filename} (${chunk.sectionLabel})`
        : chunk.filename;
      return `[Source ${i + 1} — ${location} | relevance ${chunk.score.toFixed(2)}]\n${chunk.text}`;
    })
    .join("\n\n");

  return header + body;
}
