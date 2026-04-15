"use server";

import { prisma } from "@/lib/prisma";
import { generateLinkedInDraftVariants } from "@/lib/draftGenerator";
import { generateEvidencePack } from "@/lib/secondPassResearchEngine";
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
  const title = formString(formData, "title");
  if (!title || title.trim().length < 6) throw new Error("Title is required (min 6 characters)");

  const summary = optionalTrimmed(formString(formData, "summary"), 2000);
  const opinionPitch = optionalTrimmed(formString(formData, "opinionPitch"), 2000);
  const whyItMatters = optionalTrimmed(formString(formData, "whyItMatters"), 2000);
  const sources = parseUrls(formString(formData, "sources"));

  await prisma.topic.create({
    data: {
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

export async function captureOpinionAndGenerateDraft(formData: FormData) {
  const topicId = formData.get("topicId");
  const stance = formData.get("stance");
  const coreTake = formData.get("coreTake");
  const whatPeopleMiss = formData.get("whatPeopleMiss");
  const realWorldExample = formData.get("realWorldExample");
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

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
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

    const draftVariants = generateLinkedInDraftVariants({
      topicTitle: topic.title,
      topicSummary: topic.summary,
      whyItMatters: topic.whyItMatters,
      opinionPitch: topic.opinionPitch,
      stance: typeof stance === "string" ? stance.trim() : null,
      opinionContent: stitchedOpinionContent,
      sources: allSources,
    });

    const createdDrafts = [];
    for (const variant of draftVariants) {
      const draft = await tx.draft.create({
        data: {
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
        topicId: topic.id,
        status: "SUCCEEDED",
        input: { opinionId: result.opinionId, extraUrls },
        output: { sources: result.sources, evidencePack },
        finishedAt: new Date(),
      },
      select: { id: true },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.researchRun.create({
      data: {
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
  const topicId = formData.get("topicId");

  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
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

export async function setPrimaryDraftVersion(formData: FormData) {
  const topicId = formData.get("topicId");
  const draftId = formData.get("draftId");

  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");
  if (typeof draftId !== "string" || draftId.length === 0) throw new Error("Missing draftId");

  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    select: { id: true, topicId: true },
  });

  if (!draft || draft.topicId !== topicId) {
    throw new Error("Draft not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.draft.updateMany({
      where: {
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
      topicId,
      content: content.trim(),
      status: "REVIEW",
    },
    select: { id: true },
  });

  if (typeof sourceDraftId === "string" && sourceDraftId.length > 0) {
    await prisma.draft.updateMany({
      where: { id: sourceDraftId, topicId, status: { in: ["DRAFT", "REVIEW"] as DraftStatus[] } },
      data: { status: "ARCHIVED" },
    });
  }

  revalidatePath(`/topics/${topicId}/draft`);
  redirect(`/topics/${topicId}/draft?draftId=${encodeURIComponent(next.id)}`);
}

export async function setDraftStatus(formData: FormData) {
  const draftId = formData.get("draftId");
  const topicId = formData.get("topicId");
  const status = formData.get("status");

  if (typeof draftId !== "string" || draftId.length === 0) throw new Error("Missing draftId");
  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");
  if (status !== "READY" && status !== "PUBLISHED" && status !== "ARCHIVED") throw new Error("Invalid status");

  await prisma.draft.updateMany({
    where: { id: draftId, topicId },
    data: { status },
  });

  revalidatePath(`/topics/${topicId}/draft`);
  revalidatePath("/topics");
  redirect(`/topics/${topicId}/draft?draftId=${encodeURIComponent(draftId)}`);
}
