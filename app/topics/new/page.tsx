import { createTopic } from "../actions";

export const dynamic = "force-dynamic";

export default function NewTopicPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New topic</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Add a candidate topic from your phone. It lands in the inbox as{" "}
          <span className="font-semibold">NEW</span>.
        </p>
      </div>

      <form action={createTopic} className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Title (required)
          </label>
          <input
            name="title"
            placeholder='e.g., The hidden cost of "AI everywhere"'
            className="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            required
            minLength={6}
            maxLength={160}
          />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Summary (optional)
          </label>
          <textarea
            name="summary"
            placeholder="1-2 sentences. What happened / what is this about?"
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            maxLength={2000}
          />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Opinion pitch (optional)
          </label>
          <textarea
            name="opinionPitch"
            placeholder="What angle should you take?"
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            maxLength={2000}
          />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Why it matters (optional)
          </label>
          <textarea
            name="whyItMatters"
            placeholder="So what? Who should care, and why now?"
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            maxLength={2000}
          />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Sources (optional)
          </label>
          <textarea
            name="sources"
            placeholder="Paste links (one per line)."
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
          <div className="mt-2 text-xs text-neutral-500">We will store up to 10 unique URLs.</div>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Create topic
        </button>
      </form>
    </div>
  );
}
