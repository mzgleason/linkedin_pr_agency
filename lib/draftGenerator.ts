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

export type DraftVariant = {
  key: string;
  label: string;
  content: string;
};

type VariantTone = {
  key: string;
  label: string;
  evidencePrompts: string[];
  operatorInsight: string;
  ending: string;
};

const VARIANT_TONES: VariantTone[] = [
  {
    key: "operator-brief",
    label: "Operator brief",
    evidencePrompts: [
      "- Which assumption breaks first when usage grows?",
      "- What metric improves only after behavior changes?",
      "- Where are teams paying invisible operational tax?",
    ],
    operatorInsight:
      "Operator insight: optimize for repeatability, not novelty. If a workflow can survive handoffs, it can survive scale.",
    ending: "If you run this inside a team, what operational constraint shows up first?",
  },
  {
    key: "contrarian-take",
    label: "Contrarian take",
    evidencePrompts: [
      "- Which popular claim ignores implementation costs?",
      "- What tradeoff gets hidden in the success stories?",
      "- What happens if this trend compounds for 12 months?",
    ],
    operatorInsight:
      "Operator insight: contrarian does not mean cynical. It means tracing second-order effects before making a public bet.",
    ending: "What part of this narrative feels most overrated from your seat?",
  },
  {
    key: "story-forward",
    label: "Story forward",
    evidencePrompts: [
      "- What happened in the first real deployment?",
      "- Where did the process bend instead of break?",
      "- Which decision unlocked momentum?",
    ],
    operatorInsight:
      "Operator insight: stories make systems memorable. If people can retell the sequence, they can repeat the playbook.",
    ending: "Have you seen a moment where a small workflow decision changed the outcome?",
  },
];

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

function buildDraftContent(input: DraftInput, tone: VariantTone) {
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
  evidenceLines.push(...tone.evidencePrompts);

  const opinionBlock = normalizeWhitespace(input.opinionContent);

  const sections = [
    `Version: ${tone.label}`,
    "",
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
    tone.operatorInsight,
    "",
    "Ending",
    tone.ending,
    "",
    "My take",
    opinionBlock,
  ];

  if (sourcesList) {
    sections.push("", "Sources", sourcesList);
  }

  return sections.join("\n");
}

export function generateLinkedInDraftVariants(input: DraftInput): DraftVariant[] {
  return VARIANT_TONES.map((tone) => ({
    key: tone.key,
    label: tone.label,
    content: buildDraftContent(input, tone),
  }));
}
