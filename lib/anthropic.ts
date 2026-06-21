import Anthropic from "@anthropic-ai/sdk";
import type { Analysis, ChatTurn, Paper } from "./types";

export const MODEL = "claude-opus-4-8";

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (local) or your Vercel project env vars.",
    );
  }
  return new Anthropic();
}

// Schema the analysis must conform to. Structured outputs guarantee the first
// text block is valid JSON matching this shape, so the UI renders it directly.
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    tldr: { type: "string" },
    plainLanguage: { type: "string" },
    keyContributions: { type: "array", items: { type: "string" } },
    methodology: { type: "string" },
    findings: { type: "array", items: { type: "string" } },
    limitations: { type: "array", items: { type: "string" } },
    significance: { type: "string" },
    futureWork: { type: "array", items: { type: "string" } },
    field: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
  },
  required: [
    "tldr",
    "plainLanguage",
    "keyContributions",
    "methodology",
    "findings",
    "limitations",
    "significance",
    "futureWork",
    "field",
    "keywords",
  ],
  additionalProperties: false,
} as const;

const ANALYST_SYSTEM =
  "You are ScholarLens, an expert research analyst. You read scientific papers " +
  "and explain them rigorously but accessibly. Ground every statement in the " +
  "provided text; never invent results that are not supported by it. When the " +
  "abstract is all you have, reason from it carefully and say so rather than " +
  "fabricating specifics. Write the plainLanguage field for an interested non-specialist.";

const CHAT_SYSTEM =
  "You are ScholarLens, a research assistant agent. You answer questions about " +
  "the scientific paper(s) the user is viewing. Be precise, cite the paper's own " +
  "claims, and distinguish what the paper states from your own inference. If " +
  "something isn't covered by the provided material, say so.";

function paperBlock(paper: Paper): string {
  const authors = paper.authors.join(", ") || "Unknown";
  return [
    `Title: ${paper.title}`,
    `Authors: ${authors}`,
    `Year: ${paper.year}`,
    `Category: ${paper.primaryCategory}`,
    `arXiv id: ${paper.id}`,
    "",
    "Abstract:",
    paper.summary,
  ].join("\n");
}

export async function analyzePaper(paper: Paper): Promise<Analysis> {
  const client = getClient();
  const prompt =
    "Analyse the following scientific paper and produce a structured breakdown.\n\n" +
    paperBlock(paper);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: ANALYST_SYSTEM,
    messages: [{ role: "user", content: prompt }],
    // `thinking` (adaptive) and `output_config` (structured outputs) are newer
    // than some published SDK type defs — spread untyped to stay build-safe.
    ...({
      thinking: { type: "adaptive" },
      output_config: {
        format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
      },
    } as Record<string, unknown>),
  });

  const text = message.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Model returned no analysis.");
  }
  return JSON.parse(text.text) as Analysis;
}

/** Returns a streaming Anthropic message stream for a grounded chat answer. */
export function chatStream(
  question: string,
  papers: Paper[],
  history: ChatTurn[],
) {
  const client = getClient();

  const context = papers.map(paperBlock).join("\n\n---\n\n");
  const grounding = context
    ? `You are currently discussing the following paper(s):\n\n${context}\n\n`
    : "";

  const messages: Anthropic.MessageParam[] = history.map((t) => ({
    role: t.role,
    content: t.content,
  }));
  messages.push({ role: "user", content: `${grounding}Question: ${question}` });

  return client.messages.stream({
    model: MODEL,
    max_tokens: 4000,
    system: CHAT_SYSTEM,
    messages,
    // adaptive thinking — spread untyped for SDK-version forward compatibility.
    ...({ thinking: { type: "adaptive" } } as Record<string, unknown>),
  });
}
