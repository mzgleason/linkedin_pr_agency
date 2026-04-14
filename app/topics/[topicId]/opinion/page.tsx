import { prisma } from "@/lib/prisma";
import { captureOpinionAndGenerateDraft } from "../../actions";

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
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Opinion pitch
            </div>
            <div className="mt-1 text-neutral-800">{topic.opinionPitch?.trim() || "—"}</div>
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

      <form action={captureOpinionAndGenerateDraft} className="space-y-4">
        <input type="hidden" name="topicId" value={topic.id} />

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Core take (required)
          </label>
          <textarea
            name="coreTake"
            defaultValue={latestOpinion?.coreTake ?? ""}
            placeholder="Write your opinion in 3–6 sentences. What do you believe, and why?"
            className="mt-2 min-h-36 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            required
          />
          <div className="mt-2 text-xs text-neutral-500">
            Tip: include a concrete example + a tradeoff.
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            What people miss (optional)
          </label>
          <textarea
            name="whatPeopleMiss"
            defaultValue={latestOpinion?.whatPeopleMiss ?? ""}
            placeholder="One thing most people get wrong about this…"
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Real-world example (optional)
          </label>
          <textarea
            name="realWorldExample"
            defaultValue={latestOpinion?.realWorldExample ?? ""}
            placeholder="A specific moment, metric, or story that supports the take…"
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Extra sources (optional)
          </label>
          <textarea
            name="extraSources"
            placeholder="Paste links (one per line). We'll include them as citations."
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
          {topic.sources.length > 0 ? (
            <div className="mt-3 text-xs text-neutral-600">
              Existing sources:{" "}
              {topic.sources.map((source) => source.title?.trim() || source.url).join(" · ")}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Generate draft
        </button>
      </form>
    </div>
  );
}
