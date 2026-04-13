"use server";

import { prisma } from "@/lib/prisma";
import { generateLinkedInDraft } from "@/lib/draftGenerator";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

export async function captureOpinionAndGenerateDraft(formData: FormData) {
  const topicId = formData.get("topicId");
  const stance = formData.get("stance");
  const opinionContent = formData.get("opinionContent");
  const extraSourcesRaw = formData.get("extraSources");

  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");
  if (typeof opinionContent !== "string" || opinionContent.trim().length < 20) {
    throw new Error("Opinion must be at least 20 characters");
  }
  if (opinionContent.length > 4000) {
    throw new Error("Opinion is too long");
  }

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      id: true,
      title: true,
      inboxStatus: true,
      summary: true,
      whyItMatters: true,
      opinionPitch: true,
      sources: { select: { url: true, title: true, sourceType: true } },
    },
  });

  if (!topic) throw new Error("Topic not found");
  if (topic.inboxStatus !== "APPROVED") throw new Error("Topic is not approved");

  const extraUrls = parseUrls(typeof extraSourcesRaw === "string" ? extraSourcesRaw : null);

  const result = await prisma.$transaction(async (tx) => {
    const opinion = await tx.opinion.create({
      data: {
        topicId: topic.id,
        stance: typeof stance === "string" && stance.trim().length > 0 ? stance.trim() : null,
        content: opinionContent.trim(),
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

    const draftContent = generateLinkedInDraft({
      topicTitle: topic.title,
      topicSummary: topic.summary,
      whyItMatters: topic.whyItMatters,
      opinionPitch: topic.opinionPitch,
      stance: typeof stance === "string" ? stance.trim() : null,
      opinionContent: opinionContent.trim(),
      sources: allSources,
    });

    await tx.researchRun.create({
      data: {
        topicId: topic.id,
        status: "SUCCEEDED",
        input: { opinionId: opinion.id, extraUrls },
        output: { sources: allSources },
        finishedAt: new Date(),
      },
      select: { id: true },
    });

    const draft = await tx.draft.create({
      data: { topicId: topic.id, content: draftContent },
      select: { id: true },
    });

    return { draftId: draft.id };
  });

  revalidatePath("/topics");
  redirect(`/topics/${topicId}/draft?draftId=${encodeURIComponent(result.draftId)}`);
}

export async function regenerateDraft(formData: FormData) {
  const topicId = formData.get("topicId");

  if (typeof topicId !== "string" || topicId.length === 0) throw new Error("Missing topicId");

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      id: true,
      title: true,
      inboxStatus: true,
      summary: true,
      whyItMatters: true,
      opinionPitch: true,
      sources: { select: { url: true, title: true, sourceType: true } },
      opinions: { orderBy: { createdAt: "desc" }, take: 1, select: { stance: true, content: true } },
    },
  });

  if (!topic) throw new Error("Topic not found");
  if (topic.inboxStatus !== "APPROVED") throw new Error("Topic is not approved");
  const latestOpinion = topic.opinions[0];
  if (!latestOpinion) throw new Error("No opinion captured yet");

  const allSources = await prisma.topicSource.findMany({
    where: { topicId: topic.id },
    select: { url: true, title: true, sourceType: true },
    orderBy: { createdAt: "asc" },
  });

  const draftContent = generateLinkedInDraft({
    topicTitle: topic.title,
    topicSummary: topic.summary,
    whyItMatters: topic.whyItMatters,
    opinionPitch: topic.opinionPitch,
    stance: latestOpinion.stance,
    opinionContent: latestOpinion.content,
    sources: allSources,
  });

  const draft = await prisma.draft.create({
    data: { topicId: topic.id, content: draftContent },
    select: { id: true },
  });

  revalidatePath(`/topics/${topicId}/draft`);
  redirect(`/topics/${topicId}/draft?draftId=${encodeURIComponent(draft.id)}`);
}
