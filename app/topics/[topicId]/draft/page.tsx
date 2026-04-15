import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { regenerateDraft, saveDraftEdits, setDraftStatus } from "../../actions";
import type { EvidencePack } from "@/lib/secondPassResearchEngine";

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
      researchRun: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, createdAt: true, output: true },
      },
      drafts: {
        where: draftId ? { id: draftId } : undefined,
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, content: true, createdAt: true, status: true },
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
  const latestResearch = topic.researchRun[0] ?? null;
  const evidencePack = (latestResearch?.output as { evidencePack?: EvidencePack } | null)?.evidencePack ?? null;

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
              {draft.status.toLowerCase()} - {new Date(draft.createdAt).toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <form action={regenerateDraft}>
                <input type="hidden" name="topicId" value={topic.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                >
                  Regenerate
                </button>
              </form>
              <form action={setDraftStatus}>
                <input type="hidden" name="topicId" value={topic.id} />
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="status" value="READY" />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Approve final
                </button>
              </form>
            </div>
          </div>
          <pre className="whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-6 text-neutral-900 shadow-sm">
            {draft.content}
          </pre>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold">Feedback / edits</div>
            <p className="mt-1 text-xs text-neutral-500">
              Paste your revised version (or edit directly). Saving creates a new draft revision.
            </p>
            <form action={saveDraftEdits} className="mt-3 space-y-3">
              <input type="hidden" name="topicId" value={topic.id} />
              <input type="hidden" name="draftId" value={draft.id} />
              <textarea
                name="content"
                defaultValue={draft.content}
                className="min-h-64 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm leading-6 outline-none focus:border-neutral-400"
                required
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
              >
                Save revision
              </button>
            </form>
          </div>

          {latestResearch ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-900 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Evidence pack</div>
                <div className="text-xs text-neutral-500">
                  {latestResearch.status} · {new Date(latestResearch.createdAt).toLocaleString()}
                </div>
              </div>
              {evidencePack ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-neutral-600">Supporting examples</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800">
                      {evidencePack.summary.supportingExamples.length > 0 ? (
                        evidencePack.summary.supportingExamples.map((item) => <li key={item}>{item}</li>)
                      ) : (
                        <li>No examples extracted yet.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-600">Stats</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800">
                      {evidencePack.summary.stats.length > 0 ? (
                        evidencePack.summary.stats.slice(0, 8).map((stat) => (
                          <li key={`${stat.sourceUrl}:${stat.value}:${stat.context}`}>
                            <span className="font-semibold">{stat.value}</span> — {stat.context} ({stat.sourceUrl})
                          </li>
                        ))
                      ) : (
                        <li>No stats extracted yet.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-600">Company signals</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800">
                      {evidencePack.summary.companySignals.length > 0 ? (
                        evidencePack.summary.companySignals.map((signal) => (
                          <li key={`${signal.sourceUrl}:${signal.signal}`}>
                            {signal.signal} ({signal.sourceUrl})
                          </li>
                        ))
                      ) : (
                        <li>No signals detected yet.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-600">Counterpoints</div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800">
                      {evidencePack.summary.counterpoints.map((cp) => (
                        <li key={cp}>{cp}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-sm text-neutral-700">
                  No evidence pack available yet. (If a source blocked fetching, the run may be marked as FAILED.)
                </div>
              )}
            </div>
          ) : null}
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
