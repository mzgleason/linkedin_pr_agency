"use server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { generateLinkedInDraftVariants } from "@/lib/draftGenerator";
import { generateEvidencePack } from "@/lib/secondPassResearchEngine";
import { generateDraftVariantsAI, generateTakeSuggestionsAI } from "@/lib/aiLinkedInWriter";
import { generateTrendingTopicsAI } from "@/lib/topicGenerator";
import { assertWithinLimits, logAiAction } from "@/lib/limits";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DraftStatus } from "@prisma/client";

function parseUrls(raw: string | null) {
  if (!raw) return [];
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const urls: string[] = [];
  for (const line of lines) {
    const match = line.match(/https?:\/\/\S+/);
    if (match) urls.push(match[0]);
  }
  return Array.from(new Set(urls)).slice(0, 10);
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function optionalTrimmed(value: string | null, maxLen: number) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLen) throw new Error(`${maxLen} character limit exceeded`);
  return trimmed;
}

export async function createTopic(formData: FormData) {
  const { userId } = await requireSession();
  const title = formString(formData, "title");
  if (!title || title.trim().length < 6) throw new Error("Title is required (min 6 characters)");

  const summary = optionalTrimmed(formString(formData, "summary"), 2000);
  const opinionPitch = optionalTrimmed(formString(formData, "opinionPitch"), 2000);
  const whyItMatters = optionalTrimmed(formString(formData, "whyItMatters"), 2000);
  const sources = parseUrls(formString(formData, "sources"));

  await prisma.topic.create({
    data: {
      userId,
      title: title.trim(),
      summary,
      opinionPitch,
      whyItMatters,
      status: "NEW",
      sources: sources.length
        ? {
            createMany: {
              data: sources.map((url) => ({ url, sourceType: "user" as const })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
  });

  revalidatePath("/inbox");
  revalidatePath("/topics");
  redirect("/inbox");
}

export type GenerateTopicsResult = { ok: true } | { ok: false; error: string };

export async function generateTopics(): Promise<GenerateTopicsResult> {
  const { userId } = await requireSession();
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: "Missing OPENAI_API_KEY. Add it to .env to enable AI topic generation." };
  }

  await assertWithinLimits(userId, "generate_topics");
  const topics = await generateTrendingTopicsAI({ count: 5 });

  try {
    await prisma.$transaction(async (tx) => {
      for (const topic of topics) {
        await tx.topic.create({
          data: {
            userId,
            title: topic.title,
            summary: topic.summary,
            opinionPitch: topic.opinionPitch,
            whyItMatters: topic.whyItMatters,
            status: "NEW",
            sources: topic.sources.length
              ? {
                  createMany: {
                    data: topic.sources.map((url) => ({ url, sourceType: "ai" as const })),
                    skipDuplicates: true,
                  },
                }
              : undefined,
          },
          select: { id: true },
        });
      }
    });
  } catch {
    return { ok: false, error: "Failed to save generated topics. Please try again." };
  }

  revalidatePath("/inbox");
  revalidatePath("/topics");
  await logAiAction(userId, "generate_topics", undefined, { count: topics.length });
  redirect("/inbox");
}

export async function captureOpinionAndGenerateDraft(formData: FormData) {
  const { userId } = await requireSession();
  const topicId = formData.get("topicId");
  const stance = formData.get("stance");
  const coreTake = formData.get("coreTake");
  const whatPeopleMiss = formData.get("whatPeopleMiss");
  const realWorldExample = formData.get("realWorldExample");
  const selectedTakeRaw = formData.get("selectedTake");
  const extraSourcesRaw = formData.get("extraSources");

  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");
  if (typeof coreTake !== "string" || coreTake.trim().length < 20) {
    throw new Error("Core take must be at least 20 characters");
  }
  if (coreTake.length > 4000) {
    throw new Error("Core take is too long");
  }
  if (typeof whatPeopleMiss === "string" && whatPeopleMiss.length > 2000) {
    throw new Error("What people miss is too long");
  }
  if (typeof realWorldExample === "string" && realWorldExample.length > 2000) {
    throw new Error("Real-world example is too long");
  }

  await assertWithinLimits(userId, "generate_drafts");
  await assertWithinLimits(userId, "generate_evidence_pack");

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, userId },
    select: {
      id: true,
      title: true,
      status: true,
      summary: true,
      whyItMatters: true,
      opinionPitch: true,
      sources: { select: { url: true, title: true, sourceType: true } },
    },
  });

  if (!topic) throw new Error("Topic not found");
  if (topic.status !== "APPROVED" && topic.status !== "IN_PROGRESS") {
    throw new Error("Topic is not approved");
  }

  const extraUrls = parseUrls(typeof extraSourcesRaw === "string" ? extraSourcesRaw : null);
  const cleanCoreTake = coreTake.trim();
  const cleanWhatPeopleMiss =
    typeof whatPeopleMiss === "string" && whatPeopleMiss.trim().length > 0 ? whatPeopleMiss.trim() : null;
  const cleanRealWorldExample =
    typeof realWorldExample === "string" && realWorldExample.trim().length > 0 ? realWorldExample.trim() : null;

  const stitchedOpinionContent = [
    typeof selectedTakeRaw === "string" && selectedTakeRaw.trim().length > 0 ? `Selected take: ${selectedTakeRaw.trim()}` : null,
    cleanCoreTake,
    cleanWhatPeopleMiss ? `What people miss: ${cleanWhatPeopleMiss}` : null,
    cleanRealWorldExample ? `Example: ${cleanRealWorldExample}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await prisma.$transaction(async (tx) => {
    await tx.topic.update({
      where: { id: topic.id },
      data: { status: "IN_PROGRESS" },
      select: { id: true },
    });

    const opinion = await tx.opinion.create({
      data: {
        userId,
        topicId: topic.id,
        stance: typeof stance === "string" && stance.trim().length > 0 ? stance.trim() : null,
        coreTake: cleanCoreTake,
        whatPeopleMiss: cleanWhatPeopleMiss,
        realWorldExample: cleanRealWorldExample,
        content: stitchedOpinionContent,
      },
      select: { id: true },
    });

    if (extraUrls.length > 0) {
      await tx.topicSource.createMany({
        data: extraUrls.map((url) => ({
          topicId: topic.id,
          url,
          sourceType: "user",
        })),
        skipDuplicates: true,
      });
    }

    const allSources = await tx.topicSource.findMany({
      where: { topicId: topic.id },
      select: { url: true, title: true, sourceType: true },
      orderBy: { createdAt: "asc" },
    });

    const cleanStance = typeof stance === "string" && stance.trim().length > 0 ? stance.trim() : null;

    let draftVariants = generateLinkedInDraftVariants({
      topicTitle: topic.title,
      topicSummary: topic.summary,
      whyItMatters: topic.whyItMatters,
      opinionPitch: topic.opinionPitch,
      stance: cleanStance,
      opinionContent: stitchedOpinionContent,
      sources: allSources,
    });

    if (process.env.OPENAI_API_KEY) {
      try {
        const parsedSelected =
          typeof selectedTakeRaw === "string" && selectedTakeRaw.trim().length > 0
            ? (() => {
                try {
                  return JSON.parse(selectedTakeRaw) as { title?: string; oneLiner?: string };
                } catch {
                  return { title: selectedTakeRaw.trim(), oneLiner: null };
                }
              })()
            : null;

        draftVariants = await generateDraftVariantsAI({
          topicTitle: topic.title,
          topicSummary: topic.summary,
          whyItMatters: topic.whyItMatters,
          opinionPitch: topic.opinionPitch,
          selectedTakeTitle: parsedSelected?.title ?? null,
          selectedTakeOneLiner: (parsedSelected as { oneLiner?: string } | null)?.oneLiner ?? null,
          personalAngle: stitchedOpinionContent,
          sources: allSources,
        });
        await logAiAction(userId, "generate_drafts", topic.id, { kind: "draft_variants_ai", count: draftVariants.length });
      } catch {
        // Fall back to deterministic generator.
      }
    }

    const createdDrafts = [];
    for (const variant of draftVariants) {
      const draft = await tx.draft.create({
        data: {
          userId,
          topicId: topic.id,
          content: variant.content,
          versionKey: variant.key,
          versionLabel: variant.label,
        },
        select: { id: true },
      });
      createdDrafts.push(draft.id);
    }

    return { draftIds: createdDrafts, opinionId: opinion.id, sources: allSources };
  });

  try {
    const evidencePack = await generateEvidencePack({
      topicTitle: topic.title,
      stance: typeof stance === "string" ? stance.trim() : null,
      opinionContent: stitchedOpinionContent,
      sources: result.sources,
    });

    await prisma.researchRun.create({
      data: {
        userId,
        topicId: topic.id,
        status: "SUCCEEDED",
        input: { opinionId: result.opinionId, extraUrls },
        output: { sources: result.sources, evidencePack },
        finishedAt: new Date(),
      },
      select: { id: true },
    });

    await logAiAction(userId, "generate_evidence_pack", topic.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.researchRun.create({
      data: {
        userId,
        topicId: topic.id,
        status: "FAILED",
        input: { opinionId: result.opinionId, extraUrls },
        output: { sources: result.sources, error: message },
        finishedAt: new Date(),
      },
      select: { id: true },
    });
  }

  const primaryDraftId = result.draftIds[0];
  if (!primaryDraftId) throw new Error("Draft generation failed");

  revalidatePath("/topics");
  revalidatePath("/opinion-queue");
  redirect(`/topics/${topicId}/draft?draftId=${encodeURIComponent(primaryDraftId)}`);
}

type ActionState = { error: string | null };

export async function captureOpinionAndGenerateDraftAction(
  prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await captureOpinionAndGenerateDraft(formData);
    return { error: null };
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? (error as Record<string, unknown>).digest
        : null;
    if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"))) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message || prevState.error };
  }
}

export async function regenerateDraft(formData: FormData) {
  const { userId } = await requireSession();
  const topicId = formData.get("topicId");

  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, userId },
    select: {
      id: true,
      title: true,
      status: true,
      summary: true,
      whyItMatters: true,
      opinionPitch: true,
      sources: { select: { url: true, title: true, sourceType: true } },
      opinions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { stance: true, coreTake: true, whatPeopleMiss: true, realWorldExample: true, content: true },
      },
    },
  });

  if (!topic) throw new Error("Topic not found");
  if (topic.status !== "APPROVED" && topic.status !== "IN_PROGRESS") {
    throw new Error("Topic is not approved");
  }
  const latestOpinion = topic.opinions[0];
  if (!latestOpinion) throw new Error("No opinion captured yet");

  const stitchedOpinionContent = [
    latestOpinion.coreTake ?? latestOpinion.content,
    latestOpinion.whatPeopleMiss ? `What people miss: ${latestOpinion.whatPeopleMiss}` : null,
    latestOpinion.realWorldExample ? `Example: ${latestOpinion.realWorldExample}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  await prisma.topic.update({
    where: { id: topic.id },
    data: { status: "IN_PROGRESS" },
    select: { id: true },
  });

  const allSources = await prisma.topicSource.findMany({
    where: { topicId: topic.id },
    select: { url: true, title: true, sourceType: true },
    orderBy: { createdAt: "asc" },
  });

  const draftVariants = generateLinkedInDraftVariants({
    topicTitle: topic.title,
    topicSummary: topic.summary,
    whyItMatters: topic.whyItMatters,
    opinionPitch: topic.opinionPitch,
    stance: latestOpinion.stance,
    opinionContent: stitchedOpinionContent,
    sources: allSources,
  });

  const createdDraftIds: string[] = [];
  for (const variant of draftVariants) {
    const draft = await prisma.draft.create({
      data: {
        userId,
        topicId: topic.id,
        content: variant.content,
        versionKey: variant.key,
        versionLabel: variant.label,
      },
      select: { id: true },
    });
    createdDraftIds.push(draft.id);
  }

  const primaryDraftId = createdDraftIds[0];
  if (!primaryDraftId) throw new Error("Draft regeneration failed");

  revalidatePath(`/topics/${topicId}/draft`);
  redirect(`/topics/${topicId}/draft?draftId=${encodeURIComponent(primaryDraftId)}`);
}

export async function generateTakeSuggestions(formData: FormData) {
  const { userId } = await requireSession();
  const topicId = formData.get("topicId");
  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, userId },
    select: {
      id: true,
      title: true,
      summary: true,
      whyItMatters: true,
      opinionPitch: true,
      sources: { select: { url: true, title: true, sourceType: true }, orderBy: { createdAt: "asc" }, take: 12 },
    },
  });
  if (!topic) throw new Error("Topic not found");

  let takes: Array<{ title: string; oneLiner: string; stance?: string | null }> = [];

  if (process.env.OPENAI_API_KEY) {
    try {
      await assertWithinLimits(userId, "generate_takes");
      takes = await generateTakeSuggestionsAI({
        topicTitle: topic.title,
        topicSummary: topic.summary,
        whyItMatters: topic.whyItMatters,
        opinionPitch: topic.opinionPitch,
        sources: topic.sources,
        count: 5,
      });
      await logAiAction(userId, "generate_takes", topic.id, { count: takes.length });
    } catch {
      takes = [];
    }
  }

  if (takes.length === 0) {
    takes = [
      {
        title: `Most advice about “${topic.title}” ignores the operational tax`,
        oneLiner: "The hard part isn’t the idea—it’s the handoffs, edge cases, and measurement that show up after week 2.",
      },
      {
        title: `The “best practice” on ${topic.title} is context-dependent`,
        oneLiner: "The same playbook produces opposite outcomes depending on incentives, constraints, and who owns the outcome.",
      },
      {
        title: `What people get wrong about ${topic.title}`,
        oneLiner: "They optimize for novelty and narratives instead of repeatable workflows and second-order effects.",
      },
      {
        title: `A small change beats a big rewrite for ${topic.title}`,
        oneLiner: "One constraint-driven tweak often outperforms sweeping initiatives because adoption actually happens.",
      },
      {
        title: `The real tradeoff behind ${topic.title}`,
        oneLiner: "You can usually have speed, quality, or cost—pick two—and say explicitly which one you’re paying for.",
      },
    ];
  }

  await prisma.researchRun.create({
    data: {
      userId,
      topicId: topic.id,
      status: "SUCCEEDED",
      input: { kind: "TAKES" },
      output: { kind: "TAKES", topicTitle: topic.title, takes },
      finishedAt: new Date(),
    },
    select: { id: true },
  });

  revalidatePath(`/topics/${topicId}/opinion`);
  redirect(`/topics/${topicId}/opinion`);
}

export async function setPrimaryDraftVersion(formData: FormData) {
  const { userId } = await requireSession();
  const topicId = formData.get("topicId");
  const draftId = formData.get("draftId");

  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");
  if (typeof draftId !== "string" || draftId.length === 0) throw new Error("Missing draftId");

  const draft = await prisma.draft.findFirst({
    where: { id: draftId, userId },
    select: { id: true, topicId: true },
  });

  if (!draft || draft.topicId !== topicId) {
    throw new Error("Draft not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.draft.updateMany({
      where: {
        userId,
        topicId,
        id: { not: draftId },
        status: { in: ["READY", "REVIEW", "DRAFT"] },
      },
      data: { status: "DRAFT" },
    });

    await tx.draft.update({
      where: { id: draftId },
      data: { status: "READY" },
      select: { id: true },
    });
  });

  revalidatePath("/topics");
  revalidatePath(`/topics/${topicId}/draft`);
  redirect(`/topics/${topicId}/draft?draftId=${encodeURIComponent(draftId)}`);
}

export async function saveDraftEdits(formData: FormData) {
  const { userId } = await requireSession();
  const topicId = formData.get("topicId");
  const sourceDraftId = formData.get("draftId");
  const content = formData.get("content");

  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");
  if (typeof content !== "string" || content.trim().length < 20) {
    throw new Error("Draft content must be at least 20 characters");
  }
  if (content.length > 50_000) throw new Error("Draft content is too long");

  const next = await prisma.draft.create({
    data: {
      userId,
      topicId,
      content: content.trim(),
      status: "REVIEW",
    },
    select: { id: true },
  });

  if (typeof sourceDraftId === "string" && sourceDraftId.length > 0) {
    await prisma.draft.updateMany({
      where: { id: sourceDraftId, topicId, userId, status: { in: ["DRAFT", "REVIEW"] as DraftStatus[] } },
      data: { status: "ARCHIVED" },
    });
  }

  revalidatePath(`/topics/${topicId}/draft`);
  redirect(`/topics/${topicId}/draft?draftId=${encodeURIComponent(next.id)}`);
}

export async function setDraftStatus(formData: FormData) {
  const { userId } = await requireSession();
  const draftId = formData.get("draftId");
  const topicId = formData.get("topicId");
  const status = formData.get("status");

  if (typeof draftId !== "string" || draftId.length === 0) throw new Error("Missing draftId");
  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");
  if (status !== "READY" && status !== "PUBLISHED" && status !== "ARCHIVED") throw new Error("Invalid status");

  await prisma.draft.updateMany({
    where: { id: draftId, topicId, userId },
    data: { status },
  });

  revalidatePath(`/topics/${topicId}/draft`);
  revalidatePath("/topics");
  redirect(`/topics/${topicId}/draft?draftId=${encodeURIComponent(draftId)}`);
}
