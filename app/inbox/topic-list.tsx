"use client";

import { useMemo, useState, useTransition } from "react";
import type { TopicDecision } from "./actions";
import { decideTopicStatusDirect } from "./actions";

type InboxTopic = {
  id: string;
  title: string;
  opinionPitch: string | null;
  whyItMatters: string | null;
  summary: string | null;
  createdAt: Date;
};

function normalizeDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export default function InboxTopicList({ initialTopics }: { initialTopics: InboxTopic[] }) {
  const normalizedInitial = useMemo(
    () => initialTopics.map((topic) => ({ ...topic, createdAt: normalizeDate(topic.createdAt) })),
    [initialTopics],
  );

  const [topics, setTopics] = useState(normalizedInitial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function decide(topicId: string, decision: TopicDecision) {
    setError(null);

    const snapshot = topics;
    setTopics((current) => current.filter((topic) => topic.id !== topicId));

    startTransition(async () => {
      try {
        await decideTopicStatusDirect({ topicId, decision });
      } catch (err) {
        setTopics(snapshot);
        setError(err instanceof Error ? err.message : "Failed to update topic status");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {topics.map((topic) => (
        <div key={topic.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-5">{topic.title}</div>
              <div className="mt-1 text-xs text-neutral-500">
                {topic.createdAt.toLocaleString()}
              </div>
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => decide(topic.id, "APPROVED")}
                  disabled={isPending}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => decide(topic.id, "SAVED")}
                  disabled={isPending}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => decide(topic.id, "REJECTED")}
                  disabled={isPending}
                  className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>

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
      ))}
    </div>
  );
}

