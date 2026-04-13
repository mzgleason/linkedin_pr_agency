import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type TopicsPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

const allowedStatuses = ["APPROVED", "IN_PROGRESS", "SAVED", "REJECTED", "NEW"] as const;
type AllowedStatus = (typeof allowedStatuses)[number];

function coerceStatus(raw: string | undefined): AllowedStatus | null {
  if (!raw) return null;
  const normalized = raw.toUpperCase().trim();
  return (allowedStatuses as readonly string[]).includes(normalized) ? (normalized as AllowedStatus) : null;
}

export default async function TopicsPage({ searchParams }: TopicsPageProps) {
  const params = (await searchParams) ?? {};
  const status = coerceStatus(params.status);

  const where =
    status === null
      ? { status: { in: ["APPROVED", "IN_PROGRESS"] as const } }
      : { status };

  const topics = await prisma.topic.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      status: true,
      opinions: { select: { id: true }, take: 1, orderBy: { createdAt: "desc" } },
      drafts: { select: { id: true, createdAt: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  const heading = status ? `${status.toLowerCase().replace("_", " ")} topics` : "Active topics";
  const subheading = status
    ? "Filtered by status."
    : "Approved or in-progress topics ready for drafting.";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {subheading}
          </p>
        </div>
        <div className="text-sm text-neutral-600">{topics.length} total</div>
      </div>

      {topics.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          No topics match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => {
            const hasOpinion = topic.opinions.length > 0;
            const hasDraft = topic.drafts.length > 0;
            return (
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
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/topics/${topic.id}/opinion`}
                        className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
                      >
                        {hasOpinion ? "Update opinion" : "Capture opinion"}
                      </Link>
                      {hasDraft ? (
                        <Link
                          href={`/topics/${topic.id}/draft`}
                          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                        >
                          View draft
                        </Link>
                      ) : (
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-500">
                          No draft yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 text-xs text-neutral-600">
                  <div className="rounded-full bg-neutral-100 px-2 py-1">
                    Status: {topic.status.toLowerCase().replace("_", " ")}
                  </div>
                  <div className="rounded-full bg-neutral-100 px-2 py-1">
                    Opinion: {hasOpinion ? "Captured" : "Missing"}
                  </div>
                  <div className="rounded-full bg-neutral-100 px-2 py-1">
                    Draft:{" "}
                    {hasDraft ? new Date(topic.drafts[0]!.createdAt).toLocaleDateString() : "Missing"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
