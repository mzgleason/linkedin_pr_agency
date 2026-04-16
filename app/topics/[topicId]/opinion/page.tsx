import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { OpinionForm } from "./OpinionForm";
import { generateTakeSuggestions } from "../../actions";

export const dynamic = "force-dynamic";

export default async function TopicOpinionPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const { userId } = await requireSession();

  const topic = await prisma.topic.findFirst({
    where: { id: topicId, userId },
    select: {
      id: true,
      title: true,
      opinionPitch: true,
      whyItMatters: true,
      summary: true,
      researchRun: {
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { status: true, createdAt: true, output: true },
      },
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
  const latestTakesRun = topic.researchRun.find((run) => {
    const output = run.output as { kind?: string; takes?: unknown } | null;
    return run.status === "SUCCEEDED" && output?.kind === "TAKES" && Array.isArray(output?.takes);
  });

  const takes =
    (latestTakesRun?.output as { takes?: Array<{ title: string; oneLiner: string; stance?: string | null }> } | null)
      ?.takes ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Capture opinion</h1>
        <p className="mt-1 text-sm text-neutral-600">Pick a take â†’ add your angle â†’ AI generates the full draft.</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold">{topic.title}</div>
        <div className="mt-3 space-y-3 text-sm text-neutral-800">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Opinion pitch</div>
            <div className="mt-1 text-neutral-800">{topic.opinionPitch?.trim() || "â€”"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Why it matters</div>
            <div className="mt-1 text-neutral-800">{(topic.whyItMatters ?? topic.summary)?.trim() || "â€”"}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Suggested takes</div>
            <div className="mt-1 text-sm text-neutral-700">Choose one as a starting point.</div>
          </div>
          <form action={generateTakeSuggestions}>
            <input type="hidden" name="topicId" value={topic.id} />
            <button
              type="submit"
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              {takes.length > 0 ? "Regenerate takes" : "Generate takes"}
            </button>
          </form>
        </div>

        {takes.length > 0 ? (
          <div className="mt-4 space-y-3">
            {takes.slice(0, 6).map((take) => (
              <div key={take.title} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-sm font-semibold text-neutral-900">{take.title}</div>
                <div className="mt-1 text-sm text-neutral-700">{take.oneLiner}</div>
              </div>
            ))}
            <div className="text-xs text-neutral-500">Tip: pick the closest one and add your specific example.</div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-neutral-600">No takes generated yet. Click &quot;Generate takes&quot;.</div>
        )}
      </div>

      <OpinionForm
        topicId={topic.id}
        takes={takes}
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
          topic.sources.length > 0 ? topic.sources.map((source) => source.title?.trim() || source.url).join(" Â· ") : null
        }
      />
    </div>
  );
}

