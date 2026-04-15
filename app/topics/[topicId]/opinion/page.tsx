import { prisma } from "@/lib/prisma";
import { OpinionForm } from "./OpinionForm";

export const dynamic = "force-dynamic";

export default async function TopicOpinionPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: {
      id: true,
      title: true,
      opinionPitch: true,
      whyItMatters: true,
      summary: true,
      opinions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { stance: true, coreTake: true, whatPeopleMiss: true, realWorldExample: true },
      },
      sources: { orderBy: { createdAt: "desc" }, take: 3, select: { url: true, title: true } },
    },
  });

  if (!topic) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        Topic not found.
      </div>
    );
  }

  const latestOpinion = topic.opinions[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Capture opinion</h1>
        <p className="mt-1 text-sm text-neutral-600">
          One minute input → research pass → long-form draft stored.
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">{topic.title}</div>
        <div className="mt-3 space-y-3 text-sm text-neutral-800">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Opinion pitch</div>
            <div className="mt-1 text-neutral-800">{topic.opinionPitch?.trim() || "—"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Why it matters</div>
            <div className="mt-1 text-neutral-800">{(topic.whyItMatters ?? topic.summary)?.trim() || "—"}</div>
          </div>
        </div>
      </div>

      <OpinionForm
        topicId={topic.id}
        latestOpinion={
          latestOpinion
            ? {
                coreTake: latestOpinion.coreTake ?? null,
                whatPeopleMiss: latestOpinion.whatPeopleMiss ?? null,
                realWorldExample: latestOpinion.realWorldExample ?? null,
              }
            : undefined
        }
        sourcesSummary={
          topic.sources.length > 0
            ? topic.sources.map((source) => source.title?.trim() || source.url).join(" · ")
            : null
        }
      />
    </div>
  );
}

