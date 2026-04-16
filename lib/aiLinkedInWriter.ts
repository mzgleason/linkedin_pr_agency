import type { TopicSource } from "@prisma/client";
import { responsesJson } from "./openaiResponses";

export type TakeSuggestion = {
  title: string;
  oneLiner: string;
  stance?: string | null;
};

export async function generateTakeSuggestionsAI(input: {
  topicTitle: string;
  topicSummary?: string | null;
  whyItMatters?: string | null;
  opinionPitch?: string | null;
  sources: Array<Pick<TopicSource, "url" | "title" | "sourceType">>;
  count?: number;
}): Promise<TakeSuggestion[]> {
  const sourcesText = input.sources
    .slice(0, 8)
    .map((s) => `- ${s.title?.trim() || s.url} (${s.sourceType ?? "unknown"}): ${s.url}`)
    .join("\n");

  const data = await responsesJson<{ takes: TakeSuggestion[] }>({
    system:
      "You help draft LinkedIn posts. Generate crisp, specific post angles (takes) with minimal fluff. " +
      "Avoid generic claims. Prefer concrete, falsifiable statements and tradeoffs.",
    user: [
      `Topic: ${input.topicTitle}`,
      input.topicSummary ? `Summary: ${input.topicSummary}` : null,
      input.opinionPitch ? `Opinion pitch: ${input.opinionPitch}` : null,
      input.whyItMatters ? `Why it matters: ${input.whyItMatters}` : null,
      sourcesText ? `Sources:\n${sourcesText}` : null,
      "",
      `Return JSON only: {"takes":[{"title":"...","oneLiner":"...","stance":null}]}`,
      `Generate exactly ${Math.max(3, Math.min(8, input.count ?? 5))} takes.`,
    ]
      .filter(Boolean)
      .join("\n"),
    timeoutMs: 20_000,
  });

  const takes = Array.isArray(data.takes) ? data.takes : [];
  return takes
    .filter((t) => t && typeof t.title === "string" && typeof t.oneLiner === "string")
    .slice(0, 8)
    .map((t) => ({
      title: t.title.trim().slice(0, 120),
      oneLiner: t.oneLiner.trim().slice(0, 240),
      stance: typeof t.stance === "string" ? t.stance.trim().slice(0, 40) : null,
    }));
}

export type DraftVariant = {
  key: string;
  label: string;
  content: string;
};

export async function generateDraftVariantsAI(input: {
  topicTitle: string;
  topicSummary?: string | null;
  whyItMatters?: string | null;
  opinionPitch?: string | null;
  selectedTakeTitle?: string | null;
  selectedTakeOneLiner?: string | null;
  personalAngle: string;
  sources: Array<Pick<TopicSource, "url" | "title" | "sourceType">>;
}): Promise<DraftVariant[]> {
  const sourcesText = input.sources
    .slice(0, 8)
    .map((s, i) => `${i + 1}. ${s.title?.trim() || s.url} — ${s.url}`)
    .join("\n");

  const data = await responsesJson<{ variants: DraftVariant[] }>({
    system:
      "You write LinkedIn posts for operators. Produce structured drafts with strong hooks, evidence, and practical takeaways. " +
      "No hashtags. Keep it skimmable. Use short paragraphs. Avoid hype. If citing sources, add a 'Sources' section at end.",
    user: [
      `Topic: ${input.topicTitle}`,
      input.topicSummary ? `Summary: ${input.topicSummary}` : null,
      input.opinionPitch ? `Opinion pitch: ${input.opinionPitch}` : null,
      input.whyItMatters ? `Why it matters: ${input.whyItMatters}` : null,
      input.selectedTakeTitle ? `Selected take title: ${input.selectedTakeTitle}` : null,
      input.selectedTakeOneLiner ? `Selected take one-liner: ${input.selectedTakeOneLiner}` : null,
      "",
      "My personal angle (verbatim, incorporate it, don't rewrite its meaning):",
      input.personalAngle,
      "",
      sourcesText ? `Optional sources:\n${sourcesText}` : null,
      "",
      `Return JSON only: {"variants":[{"key":"operator-brief","label":"Operator brief","content":"..."}]}`,
      "Generate exactly 3 variants with keys: operator-brief, contrarian-take, story-forward.",
      "Each content must be plain text.",
    ]
      .filter(Boolean)
      .join("\n"),
    timeoutMs: 30_000,
  });

  const variants = Array.isArray(data.variants) ? data.variants : [];
  const normalized = variants
    .filter((v) => v && typeof v.key === "string" && typeof v.label === "string" && typeof v.content === "string")
    .slice(0, 3)
    .map((v) => ({
      key: v.key.trim().slice(0, 40),
      label: v.label.trim().slice(0, 60),
      content: v.content.trim().slice(0, 50_000),
    }));

  if (normalized.length !== 3) throw new Error("AI draft generation returned invalid variants");
  return normalized;
}

