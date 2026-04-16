import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getAppUrl, getStripe } from "@/lib/stripe";

export async function POST() {
  const { userId } = await requireSession();
  const stripe = getStripe();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return Response.json({ ok: false, error: "User not found" }, { status: 404 });
  if (!user.stripeCustomerId) {
    return Response.json({ ok: false, error: "No Stripe customer" }, { status: 400 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${getAppUrl()}/account`,
  });

  return Response.json({ ok: true, url: portal.url });
}

