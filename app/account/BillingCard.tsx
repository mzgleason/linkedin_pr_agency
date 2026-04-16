"use client";

import { useState } from "react";

async function postAndRedirect(path: string) {
  const res = await fetch(path, { method: "POST" });
  const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
  if (!data.ok || !data.url) throw new Error(data.error || "Request failed");
  window.location.href = data.url;
}

export function BillingCard({
  plan,
  stripeSubStatus,
  hasCustomer,
}: {
  plan: string;
  stripeSubStatus: string | null;
  hasCustomer: boolean;
}) {
  const [busy, setBusy] = useState<null | "checkout" | "portal">(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-neutral-900">Billing</div>
          <div className="mt-1 text-sm text-neutral-700">
            Plan: <span className="font-semibold">{plan}</span>
            {stripeSubStatus ? <span className="text-neutral-500"> ({stripeSubStatus})</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("checkout");
              setError(null);
              try {
                await postAndRedirect("/api/stripe/checkout");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed");
                setBusy(null);
              }
            }}
          >
            {busy === "checkout" ? "Starting…" : "Upgrade to Pro"}
          </button>
          <button
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            disabled={busy !== null || !hasCustomer}
            onClick={async () => {
              setBusy("portal");
              setError(null);
              try {
                await postAndRedirect("/api/stripe/portal");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed");
                setBusy(null);
              }
            }}
          >
            {busy === "portal" ? "Opening…" : "Manage"}
          </button>
        </div>
      </div>
      {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}
      <div className="mt-3 text-xs text-neutral-500">
        Billing is optional in local dev. Configure Stripe env vars to enable checkout and portal.
      </div>
    </div>
  );
}

