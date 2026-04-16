import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteMyAccount } from "./actions";
import { BillingCard } from "./BillingCard";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { plan: true, stripeSubStatus: true, stripeCustomerId: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-neutral-600">Manage your account settings.</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-neutral-900">Signed in as</div>
        <div className="mt-1 text-sm text-neutral-700">{session.email}</div>
      </div>

      <BillingCard plan={user?.plan ?? "free"} stripeSubStatus={user?.stripeSubStatus ?? null} hasCustomer={Boolean(user?.stripeCustomerId)} />

      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="text-sm font-semibold text-red-900">Delete account</div>
        <p className="mt-1 text-sm text-red-800">
          This permanently deletes your user-owned records (topics, opinions, drafts, and research runs).
        </p>
        <form action={deleteMyAccount} className="mt-3">
          <button
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            type="submit"
          >
            Delete my account
          </button>
        </form>
      </div>
    </div>
  );
}
