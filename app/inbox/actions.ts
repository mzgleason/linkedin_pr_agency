"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { TopicStatus } from "@prisma/client";

export async function decideTopicStatus(formData: FormData) {
  const topicId = formData.get("topicId");
  const decision = formData.get("decision");

  if (typeof topicId !== "string" || topicId.length === 0) {
    throw new Error("Missing topicId");
  }

  if (decision !== "APPROVED" && decision !== "REJECTED" && decision !== "SAVED") {
    throw new Error("Invalid decision");
  }

  const nextStatus = decision as TopicStatus;

  const result = await prisma.topic.updateMany({
    where: { id: topicId, status: "NEW" },
    data: { status: nextStatus },
  });

  if (result.count === 0) {
    const current = await prisma.topic.findUnique({
      where: { id: topicId },
      select: { status: true },
    });
    if (!current) throw new Error("Topic not found");
    throw new Error(`Invalid status transition from ${current.status} to ${nextStatus}`);
  }

  revalidatePath("/inbox");
}
