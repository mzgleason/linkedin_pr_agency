import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import InboxTopicList from "./topic-list";

export const dynamic = "force-dynamic";

export default async function TopicInboxPage() {
  const { userId } = await requireSession();
  const topics = await prisma.topic.findMany({
    where: { status: "NEW", userId },
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
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
          <div className="font-medium text-neutral-900">No new topics yet.</div>
          <div className="mt-1 text-neutral-600">Create your next batch (AI) or start from your own topic.</div>
          <Link
            href="/topics/new"
            className="mt-3 inline-flex items-center justify-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
          >
            Create topic
          </Link>
        </div>
      ) : (
        <InboxTopicList initialTopics={topics} />
      )}
    </div>
  );
}
