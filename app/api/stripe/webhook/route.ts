import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

async function setPlanForCustomer(customerId: string, plan: "free" | "pro", status: string | null, priceId: string | null) {
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan,
      stripeSubStatus: status,
      stripePriceId: priceId,
    },
  });
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });

  const body = await req.text();
  const signature = (await headers()).get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as { customer?: string | null; subscription?: string | null };
      if (session.customer) {
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
        let status: string | null = null;
        let priceId: string | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          status = sub.status;
          priceId = sub.items.data[0]?.price?.id ?? null;
        }
        await setPlanForCustomer(String(session.customer), "pro", status, priceId);
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      if (customerId) {
        const isActive = sub.status === "active" || sub.status === "trialing";
        const plan = isActive ? "pro" : "free";
        const priceId = sub.items.data[0]?.price?.id ?? null;
        await setPlanForCustomer(customerId, plan, sub.status, priceId);
      }
    }
  } catch {
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
