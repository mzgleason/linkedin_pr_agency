import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getAppUrl, getStripe } from "@/lib/stripe";

export async function POST() {
  const { userId, email } = await requireSession();
  const stripe = getStripe();

  const priceId = process.env.STRIPE_PRICE_ID_PRO;
  if (!priceId) {
    return Response.json({ ok: false, error: "Missing STRIPE_PRICE_ID_PRO" }, { status: 500 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return Response.json({ ok: false, error: "User not found" }, { status: 404 });

  let customerId = user.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ email });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const baseUrl = getAppUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${baseUrl}/account?stripe=success`,
    cancel_url: `${baseUrl}/account?stripe=cancel`,
  });

  return Response.json({ ok: true, url: session.url });
}

