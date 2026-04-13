import { prisma } from "@/lib/prisma";
import { decideTopicStatus } from "./actions";

export const dynamic = "force-dynamic";

export default async function TopicInboxPage() {
  const topics = await prisma.topic.findMany({
    where: { status: "NEW" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      opinionPitch: true,
      whyItMatters: true,
      summary: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Topic inbox</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Approve topics to move forward to drafting. Save to review later. Reject to drop them.
          </p>
        </div>
        <div className="text-sm text-neutral-600">{topics.length} new</div>
      </div>

      {topics.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          No new topics.
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-5">{topic.title}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {new Date(topic.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="shrink-0">
                  <form action={decideTopicStatus} className="flex items-center gap-2">
                    <input type="hidden" name="topicId" value={topic.id} />
                    <button
                      type="submit"
                      name="decision"
                      value="APPROVED"
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="SAVED"
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      Save
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="REJECTED"
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-3 space-y-3 text-sm text-neutral-800">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Opinion pitch
                  </div>
                  <div className="mt-1 text-neutral-800">
                    {topic.opinionPitch?.trim() ||
                      "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Why it matters
                  </div>
                  <div className="mt-1 text-neutral-800">
                    {(topic.whyItMatters ?? topic.summary)?.trim() || "—"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
