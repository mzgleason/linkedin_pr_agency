import { prisma } from "@/lib/prisma";

export type AiAction = "generate_topics" | "generate_takes" | "generate_drafts" | "generate_evidence_pack";

type PlanLimits = {
  daily: Partial<Record<AiAction, number>>;
  perMinute: Partial<Record<AiAction, number>>;
};

const FREE_LIMITS: PlanLimits = {
  daily: {
    generate_topics: 5,
    generate_takes: 20,
    generate_drafts: 5,
    generate_evidence_pack: 10,
  },
  perMinute: {
    generate_topics: 2,
    generate_takes: 10,
    generate_drafts: 2,
    generate_evidence_pack: 4,
  },
};

const PRO_LIMITS: PlanLimits = {
  daily: {
    generate_topics: 50,
    generate_takes: 200,
    generate_drafts: 50,
    generate_evidence_pack: 100,
  },
  perMinute: {
    generate_topics: 10,
    generate_takes: 60,
    generate_drafts: 10,
    generate_evidence_pack: 30,
  },
};

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function getUserPlan(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return (user?.plan ?? "free").toLowerCase();
}

export async function assertWithinLimits(userId: string, action: AiAction) {
  const plan = await getUserPlan(userId);
  const limits = plan === "pro" ? PRO_LIMITS : FREE_LIMITS;

  const now = new Date();
  const dailyLimit = limits.daily[action];
  if (typeof dailyLimit === "number") {
    const since = startOfUtcDay(now);
    const count = await prisma.aiActionLog.count({
      where: { userId, action, createdAt: { gte: since } },
    });
    if (count >= dailyLimit) {
      throw new Error(`Limit reached: ${action.replace(/_/g, " ")} daily quota (${dailyLimit}/day).`);
    }
  }

  const perMinute = limits.perMinute[action];
  if (typeof perMinute === "number") {
    const since = new Date(now.getTime() - 60_000);
    const count = await prisma.aiActionLog.count({
      where: { userId, action, createdAt: { gte: since } },
    });
    if (count >= perMinute) {
      throw new Error(`Slow down: ${action.replace(/_/g, " ")} rate limit (${perMinute}/min).`);
    }
  }
}

export async function logAiAction(userId: string, action: AiAction, topicId?: string, meta?: unknown) {
  await prisma.aiActionLog.create({
    data: {
      userId,
      action,
      topicId: topicId ?? null,
      meta: meta ? (meta as object) : undefined,
    },
    select: { id: true },
  });
}

