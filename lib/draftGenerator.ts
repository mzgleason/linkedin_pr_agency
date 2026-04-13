import type { TopicSource } from "@prisma/client";

type DraftInput = {
  topicTitle: string;
  topicSummary?: string | null;
  whyItMatters?: string | null;
  opinionPitch?: string | null;
  stance: string | null;
  opinionContent: string;
  sources: Array<Pick<TopicSource, "url" | "title" | "sourceType">>;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function makeHook(topicTitle: string, stance: string | null, opinionContent: string) {
  const cleanOpinion = normalizeWhitespace(opinionContent);
  const stancePrefix = stance ? `${stance}: ` : "";
  const firstSentence = cleanOpinion.split(/(?<=[.!?])\s+/)[0] ?? cleanOpinion;
  return `${stancePrefix}${firstSentence || topicTitle}`.trim();
}

function formatSources(
  sources: Array<Pick<TopicSource, "url" | "title" | "sourceType">>,
): { citationsInline: string; sourcesList: string } {
  const unique = new Map<string, Pick<TopicSource, "url" | "title" | "sourceType">>();
  for (const source of sources) {
    const url = source.url.trim();
    if (!url) continue;
    if (!unique.has(url)) unique.set(url, source);
  }

  const items = Array.from(unique.values()).slice(0, 8);
  if (items.length === 0) return { citationsInline: "", sourcesList: "" };

  const citationsInline = items.map((_, index) => `[${index + 1}]`).join(" ");
  const sourcesList = items
    .map((source, index) => {
      const title = source.title?.trim();
      const label = title ? `${title} — ${source.url}` : source.url;
      const meta = source.sourceType ? ` (${source.sourceType})` : "";
      return `${index + 1}. ${label}${meta}`;
    })
    .join("\n");

  return { citationsInline, sourcesList };
}

export function generateLinkedInDraft(input: DraftInput) {
  const hook = makeHook(input.topicTitle, input.stance, input.opinionContent);
  const framing =
    input.whyItMatters?.trim() ||
    input.topicSummary?.trim() ||
    input.opinionPitch?.trim() ||
    `Here’s what I’m seeing on ${input.topicTitle}.`;

  const { citationsInline, sourcesList } = formatSources(input.sources);

  const evidenceLines: string[] = [];
  if (citationsInline) {
    evidenceLines.push(`A few quick anchors to sanity-check the take ${citationsInline}:`);
  } else {
    evidenceLines.push("A few quick anchors to sanity-check the take:");
  }
  evidenceLines.push("- What changed recently?");
  evidenceLines.push("- What stays true across cycles?");
  evidenceLines.push("- Where does the narrative break in practice?");

  const operatorInsight = `Operator insight: the goal isn’t to be “right” on the internet — it’s to make the next decision cheaper.\n\nIf you can name the tradeoff, you can design the system.`;

  const ending = `If you’re building in this space, what’s the one constraint you wish more people understood?`;

  const opinionBlock = normalizeWhitespace(input.opinionContent);

  const sections = [
    hook,
    "",
    framing,
    "",
    "—",
    "",
    "Evidence",
    evidenceLines.join("\n"),
    "",
    "Operator insight",
    operatorInsight,
    "",
    "Ending",
    ending,
    "",
    "My take",
    opinionBlock,
  ];

  if (sourcesList) {
    sections.push("", "Sources", sourcesList);
  }

  return sections.join("\n");
}
