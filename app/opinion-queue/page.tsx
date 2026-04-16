import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function OpinionQueuePage() {
  const topicsNeedingOpinion = await prisma.topic.findMany({
    where: { status: "APPROVED", opinions: { none: {} }, userId: (await requireSession()).userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true, opinionPitch: true, whyItMatters: true, summary: true },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Opinion queue</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Approved topics that still need an opinion captured.
          </p>
        </div>
        <div className="text-sm text-neutral-600">{topicsNeedingOpinion.length} queued</div>
      </div>

      {topicsNeedingOpinion.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          No approved topics are waiting for an opinion.
        </div>
      ) : (
        <div className="space-y-3">
          {topicsNeedingOpinion.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.id}/opinion`}
              className="block rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              aria-label={`Capture opinion for ${topic.title}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-5 text-neutral-900">{topic.title}</div>
                  <div className="mt-1 text-xs text-neutral-500">{new Date(topic.createdAt).toLocaleString()}</div>
                </div>
                <div className="shrink-0 rounded-full bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">
                  Capture
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm text-neutral-800">
                <div>
                  <div className="text-xs font-semibold text-neutral-600">Opinion pitch</div>
                  <div className="mt-1">{topic.opinionPitch?.trim() || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-neutral-600">Why it matters</div>
                  <div className="mt-1">{(topic.whyItMatters ?? topic.summary)?.trim() || "—"}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
