"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TopicInboxStatus } from "@prisma/client";

export async function decideTopicInboxStatus(formData: FormData) {
  const topicId = formData.get("topicId");
  const decision = formData.get("decision");

  if (typeof topicId !== "string" || topicId.length === 0) {
    throw new Error("Missing topicId");
  }

  if (decision !== "APPROVED" && decision !== "REJECTED") {
    throw new Error("Invalid decision");
  }

  await prisma.topic.update({
    where: { id: topicId },
    data: { inboxStatus: decision as TopicInboxStatus },
  });

  revalidatePath("/inbox");
}

