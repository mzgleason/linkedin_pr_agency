import { responsesJson } from "./openaiResponses";

export type GeneratedTopic = {
  title: string;
  summary: string;
  opinionPitch: string;
  whyItMatters: string;
  sources: string[];
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function coerceString(value: unknown, maxLen: number) {
  if (!isNonEmptyString(value)) return "";
  const trimmed = value.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function extractUrls(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  const urls = raw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => /^https?:\/\/\S+$/i.test(value));
  return Array.from(new Set(urls)).slice(0, 10);
}

function normalizeGeneratedTopic(value: unknown): GeneratedTopic | null {
  if (!value || typeof value !== "object") return null;
  const topic = value as Record<string, unknown>;

  const title = coerceString(topic.title, 160);
  const summary = coerceString(topic.summary, 2000);
  const opinionPitch = coerceString(topic.opinionPitch, 2000);
  const whyItMatters = coerceString(topic.whyItMatters, 2000);
  const sources = extractUrls(topic.sources);

  if (!title || title.length < 6) return null;
  if (!summary) return null;
  if (!opinionPitch) return null;
  if (!whyItMatters) return null;

  return { title, summary, opinionPitch, whyItMatters, sources };
}

export async function generateTrendingTopicsAI(args: {
  count: number;
  model?: string;
}): Promise<GeneratedTopic[]> {
  const count = args.count;
  if (!Number.isInteger(count) || count <= 0 || count > 10) throw new Error("Invalid count");

  const result = await responsesJson<{ topics?: unknown }>({
    model: args.model,
    system:
      "You generate LinkedIn post topic candidates for a solo creator. Target: global tech + business trends. " +
      "Return ONLY JSON.",
    user: [
      "Generate a batch of topic candidates.",
      `Count: ${count}.`,
      "Each topic must include:",
      "- title (6-160 chars)",
      "- summary (1-3 sentences)",
      "- opinionPitch (a suggested contrarian/practical angle)",
      "- whyItMatters (impact/why now)",
      "- sources (0-10 URLs; best-effort; prefer 2-5 when possible)",
      "",
      "JSON schema:",
      "{",
      '  "topics": [',
      "    {",
      '      "title": "…",',
      '      "summary": "…",',
      '      "opinionPitch": "…",',
      '      "whyItMatters": "…",',
      '      "sources": ["https://…"]',
      "    }",
      "  ]",
      "}",
    ].join("\n"),
    timeoutMs: 35_000,
  });

  const rawTopics = (result && typeof result === "object" ? (result as { topics?: unknown }).topics : null) ?? null;
  if (!Array.isArray(rawTopics)) throw new Error("AI output missing topics[]");

  const normalized = rawTopics.map(normalizeGeneratedTopic).filter(Boolean) as GeneratedTopic[];
  if (normalized.length !== count) throw new Error(`AI output invalid: expected ${count} topics, got ${normalized.length}`);

  return normalized;
}

