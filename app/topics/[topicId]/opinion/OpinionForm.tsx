"use client";

import { useMemo, useState, useActionState } from "react";
import { captureOpinionAndGenerateDraftAction } from "../../actions";

function SubmitButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
    >
      Generate draft
    </button>
  );
}

export type TakeSuggestion = { title: string; oneLiner: string; stance?: string | null };

export function OpinionForm({
  topicId,
  takes,
  latestOpinion,
  sourcesSummary,
}: {
  topicId: string;
  takes: TakeSuggestion[];
  latestOpinion?: { coreTake: string | null; whatPeopleMiss: string | null; realWorldExample: string | null };
  sourcesSummary?: string | null;
}) {
  const [state, action] = useActionState(captureOpinionAndGenerateDraftAction, { error: null });
  const takeOptions = useMemo(
    () =>
      (takes ?? []).slice(0, 6).map((take) => ({
        label: take.title,
        value: JSON.stringify({ title: take.title, oneLiner: take.oneLiner, stance: take.stance ?? null }),
        helper: take.oneLiner,
      })),
    [takes],
  );

  const [selected, setSelected] = useState<string>(takeOptions[0]?.value ?? "");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="topicId" value={topicId} />
      <input type="hidden" name="selectedTake" value={selected} />

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">Starting take</label>
        {takeOptions.length > 0 ? (
          <>
            <select
              className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {takeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="mt-2 text-sm text-neutral-700">
              {takeOptions.find((opt) => opt.value === selected)?.helper ?? ""}
            </div>
          </>
        ) : (
          <div className="mt-2 text-sm text-neutral-600">Generate takes above to unlock this dropdown.</div>
        )}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Your angle (required)
        </label>
        <textarea
          name="coreTake"
          defaultValue={latestOpinion?.coreTake ?? ""}
          placeholder="2â€“4 sentences. Add your opinion + one concrete detail (a mistake, metric, story, or tradeoff)."
          className="mt-2 min-h-32 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          required
          minLength={20}
        />
        <div className="mt-2 text-xs text-neutral-500">
          You write the specific experience. Everything else is generated.
        </div>
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

      <SubmitButton disabled={takeOptions.length === 0} />
    </form>
  );
}

