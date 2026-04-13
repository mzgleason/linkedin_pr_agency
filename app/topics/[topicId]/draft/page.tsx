import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { regenerateDraft } from "../../actions";

export const dynamic = "force-dynamic";

export default async function TopicDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ draftId?: string }>;
}) {
  const { topicId } = await params;
  const { draftId } = await searchParams;

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      id: true,
      title: true,
      drafts: {
        where: draftId ? { id: draftId } : undefined,
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, content: true, createdAt: true },
      },
    },
  });

  if (!topic) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        Topic not found.
      </div>
    );
  }

  const draft = topic.drafts[0];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Draft</h1>
          <p className="mt-1 truncate text-sm text-neutral-600">{topic.title}</p>
        </div>
        <div className="shrink-0">
          <Link className="text-sm text-neutral-600 hover:text-neutral-900" href="/topics">
            Back
          </Link>
        </div>
      </div>

      {draft ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-neutral-500">
              Generated {new Date(draft.createdAt).toLocaleString()}
            </div>
            <form action={regenerateDraft}>
              <input type="hidden" name="topicId" value={topic.id} />
              <button
                type="submit"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
              >
                Regenerate
              </button>
            </form>
          </div>
          <pre className="whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-900 shadow-sm">
            {draft.content}
          </pre>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          No draft yet.{" "}
          <Link className="font-semibold text-neutral-900 hover:underline" href={`/topics/${topicId}/opinion`}>
            Capture an opinion
          </Link>{" "}
          to generate one.
        </div>
      )}
    </div>
  );
}
