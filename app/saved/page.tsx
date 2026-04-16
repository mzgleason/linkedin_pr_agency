import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import SavedTopicList from "./topic-list";

export const dynamic = "force-dynamic";

export default async function SavedTopicsPage() {
  const { userId } = await requireSession();
  const topics = await prisma.topic.findMany({
    where: { status: "SAVED", userId },
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
          <h1 className="text-2xl font-semibold tracking-tight">Saved topics</h1>
          <p className="mt-1 text-sm text-neutral-600">Topics you saved to review later.</p>
        </div>
        <div className="text-sm text-neutral-600">{topics.length} saved</div>
      </div>

      {topics.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          No saved topics.
        </div>
      ) : (
        <SavedTopicList initialTopics={topics} />
      )}
    </div>
  );
}

