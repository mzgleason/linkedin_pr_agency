"use client";

import { useActionState } from "react";
import { captureOpinionAndGenerateDraftAction } from "../../actions";

function SubmitButton() {
  return (
    <button
      type="submit"
      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
    >
      Generate draft
    </button>
  );
}

export function OpinionForm({
  topicId,
  latestOpinion,
  sourcesSummary,
}: {
  topicId: string;
  latestOpinion?: { coreTake: string | null; whatPeopleMiss: string | null; realWorldExample: string | null };
  sourcesSummary?: string | null;
}) {
  const [state, action] = useActionState(captureOpinionAndGenerateDraftAction, { error: null });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="topicId" value={topicId} />

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
          minLength={20}
        />
        <div className="mt-2 text-xs text-neutral-500">Tip: include a concrete example + a tradeoff.</div>
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
        {sourcesSummary ? <div className="mt-3 text-xs text-neutral-600">Existing sources: {sourcesSummary}</div> : null}
      </div>

      {state.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.error}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}

