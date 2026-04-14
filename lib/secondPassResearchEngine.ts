import type { TopicSource } from "@prisma/client";

export type EvidencePack = {
  version: 1;
  generatedAt: string;
  topicTitle: string;
  opinion: {
    stance: string | null;
    content: string;
  };
  sources: Array<{
    url: string;
    sourceType: string | null;
    title: string | null;
    fetchedAt: string | null;
    ok: boolean;
    httpStatus: number | null;
    resolvedUrl: string | null;
    extractedTitle: string | null;
    extractedDescription: string | null;
    keyExcerpts: string[];
    stats: Array<{ value: string; context: string }>;
    companySignals: string[];
    counterpoints: string[];
    error: string | null;
  }>;
  summary: {
    supportingExamples: string[];
    stats: Array<{ value: string; context: string; sourceUrl: string }>;
    companySignals: Array<{ signal: string; sourceUrl: string }>;
    counterpoints: string[];
  };
};

type SourceInput = Pick<TopicSource, "url" | "title" | "sourceType">;

function stripTags(html: string) {
  const withoutScripts = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  return withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function clampLines(value: string, maxChars: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, Math.max(0, maxChars - 1))}…`;
}

function extractMeta(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const ogTitleMatch = html.match(/<meta\s+[^>]*property=[\"']og:title[\"'][^>]*content=[\"']([^\"']+)[\"'][^>]*>/i);
  const descMatch = html.match(/<meta\s+[^>]*name=[\"']description[\"'][^>]*content=[\"']([^\"']+)[\"'][^>]*>/i);
  const ogDescMatch = html.match(
    /<meta\s+[^>]*property=[\"']og:description[\"'][^>]*content=[\"']([^\"']+)[\"'][^>]*>/i,
  );
  const extractedTitle = (ogTitleMatch?.[1] || titleMatch?.[1] || "").trim();
  const extractedDescription = (ogDescMatch?.[1] || descMatch?.[1] || "").trim();
  return {
    title: extractedTitle.length > 0 ? clampLines(extractedTitle, 140) : null,
    description: extractedDescription.length > 0 ? clampLines(extractedDescription, 240) : null,
  };
}

function findStatSnippets(text: string) {
  const results: Array<{ value: string; context: string }> = [];
  const pattern =
    /\b(?:(?:USD|US\$|\$)\s?)?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s?(?:%|bps|bp|x|×|m|bn|billion|million|k|K))?\b/g;

  for (const match of text.matchAll(pattern)) {
    const value = match[0];
    const start = Math.max(0, match.index! - 80);
    const end = Math.min(text.length, match.index! + value.length + 80);
    const context = text.slice(start, end).trim();
    if (value.length < 2) continue;
    if (results.some((r) => r.value === value && r.context === context)) continue;
    results.push({ value, context: clampLines(context, 220) });
    if (results.length >= 6) break;
  }
  return results;
}

function findCompanySignals(text: string) {
  const signals: string[] = [];
  const patterns: Array<{ label: string; re: RegExp }> = [
    { label: "Funding/financing", re: /\b(raised|funding|series\s+[a-z]|seed\s+round|debt\s+financing)\b/i },
    { label: "M&A", re: /\b(acquired|acquisition|merger)\b/i },
    { label: "Launch/product", re: /\b(launched|launches|released|rollout|generally\s+available|GA)\b/i },
    { label: "Hiring/layoffs", re: /\b(hiring|headcount|layoffs?|restructuring)\b/i },
    { label: "Guidance/earnings", re: /\b(guidance|earnings|revenue|ARR|profit|margin)\b/i },
    { label: "Regulatory", re: /\b(regulator|regulation|compliance|antitrust|SEC|FTC|EU)\b/i },
  ];
  for (const p of patterns) {
    if (p.re.test(text)) signals.push(p.label);
  }
  return Array.from(new Set(signals));
}

function deriveCounterpoints(opinionContent: string) {
  const text = opinionContent.toLowerCase();
  const counterpoints: string[] = [];

  counterpoints.push("The strongest counterpoint is that the causal link may be weaker than it sounds — correlation ≠ mechanism.");
  counterpoints.push("Even if the take is directionally right, timelines are often longer and implementation costs are higher than expected.");

  if (text.includes("ai") || text.includes("llm")) {
    counterpoints.push("For AI/LLM claims: capability gains don’t automatically translate into reliable, governed workflows in production.");
  }
  if (text.includes("remote") || text.includes("hybrid")) {
    counterpoints.push("For remote/hybrid claims: outcomes vary heavily by role type and management systems, so broad generalizations break.");
  }
  if (text.includes("startup") || text.includes("venture") || text.includes("funding")) {
    counterpoints.push("For startup/VC claims: market cycles can swamp strategy — the same playbook works in one regime and fails in another.");
  }
  if (text.includes("pricing") || text.includes("subscription") || text.includes("saas")) {
    counterpoints.push("For pricing/SaaS claims: revenue quality matters; growth can hide churn and poor payback periods.");
  }

  return Array.from(new Set(counterpoints)).slice(0, 8);
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Some sites block empty UA; keep it generic.
        "user-agent": "linkedin_pr_agency/second-pass-research",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
      },
    });
    const contentType = res.headers.get("content-type") || "";
    const bodyText = await res.text();
    return { res, contentType, bodyText };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateEvidencePack(input: {
  topicTitle: string;
  stance: string | null;
  opinionContent: string;
  sources: SourceInput[];
  maxSources?: number;
}): Promise<EvidencePack> {
  const maxSources = Math.max(1, Math.min(10, input.maxSources ?? 6));
  const unique = new Map<string, SourceInput>();
  for (const source of input.sources) {
    const url = source.url.trim();
    if (!url) continue;
    if (!unique.has(url)) unique.set(url, source);
  }
  const sources = Array.from(unique.values()).slice(0, maxSources);

  const perSource = await Promise.all(
    sources.map(async (source) => {
      const startedAt = new Date();
      try {
        const { res, contentType, bodyText } = await fetchWithTimeout(source.url, 6500);
        const resolvedUrl = res.url || null;
        const httpStatus = res.status;
        const ok = res.ok;

        const { title, description } = contentType.toLowerCase().includes("html") ? extractMeta(bodyText) : { title: null, description: null };
        const rawText = contentType.toLowerCase().includes("html") ? stripTags(bodyText) : bodyText.trim();
        const text = clampLines(rawText, 24_000);

        const stats = findStatSnippets(text);
        const companySignals = findCompanySignals(text);
        const counterpoints = deriveCounterpoints(input.opinionContent).slice(0, 3);
        const keyExcerpts = [
          description,
          text.length > 0 ? clampLines(text, 260) : null,
          stats[0]?.context ?? null,
        ].filter(Boolean) as string[];

        return {
          url: source.url,
          sourceType: source.sourceType ?? null,
          title: source.title ?? null,
          fetchedAt: startedAt.toISOString(),
          ok,
          httpStatus,
          resolvedUrl,
          extractedTitle: title,
          extractedDescription: description,
          keyExcerpts,
          stats,
          companySignals,
          counterpoints,
          error: null,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
          url: source.url,
          sourceType: source.sourceType ?? null,
          title: source.title ?? null,
          fetchedAt: startedAt.toISOString(),
          ok: false,
          httpStatus: null,
          resolvedUrl: null,
          extractedTitle: null,
          extractedDescription: null,
          keyExcerpts: [],
          stats: [],
          companySignals: [],
          counterpoints: deriveCounterpoints(input.opinionContent).slice(0, 3),
          error: message,
        };
      }
    }),
  );

  const supportingExamples: string[] = [];
  const allStats: Array<{ value: string; context: string; sourceUrl: string }> = [];
  const allSignals: Array<{ signal: string; sourceUrl: string }> = [];

  for (const src of perSource) {
    const primary = src.extractedDescription || src.keyExcerpts[0] || null;
    if (primary) supportingExamples.push(`${clampLines(primary, 220)} (${src.url})`);
    for (const stat of src.stats) {
      allStats.push({ value: stat.value, context: stat.context, sourceUrl: src.url });
    }
    for (const signal of src.companySignals) {
      allSignals.push({ signal, sourceUrl: src.url });
    }
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    topicTitle: input.topicTitle,
    opinion: { stance: input.stance, content: input.opinionContent },
    sources: perSource,
    summary: {
      supportingExamples: supportingExamples.slice(0, 8),
      stats: allStats.slice(0, 12),
      companySignals: allSignals.slice(0, 10),
      counterpoints: deriveCounterpoints(input.opinionContent),
    },
  };
}

