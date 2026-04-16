"use client";

import { useActionState } from "react";
import { generateTopics, type GenerateTopicsResult } from "../actions";

const initialState: GenerateTopicsResult = { ok: true };

export function CreateTopicClient(props: { aiEnabled: boolean }) {
  const [state, action, pending] = useActionState(generateTopics, initialState);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold">Generate 5 topics (AI)</div>
      <p className="mt-1 text-xs text-neutral-500">Global tech/business trends with best-effort sources.</p>

      {!props.aiEnabled ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          AI generation is disabled until <span className="font-semibold">OPENAI_API_KEY</span> is set.
        </div>
      ) : null}

      {"ok" in state && state.ok === false ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          {state.error}
        </div>
      ) : null}

      <form action={action} className="mt-3">
        <button
          type="submit"
          disabled={!props.aiEnabled || pending}
          className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Generating…" : "Generate 5 topics"}
        </button>
      </form>
    </div>
  );
}

