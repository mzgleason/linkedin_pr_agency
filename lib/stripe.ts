import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  return new Stripe(key, {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });
}

export function getAppUrl() {
  const url = process.env.APP_URL;
  if (!url) throw new Error("APP_URL is required (e.g. http://localhost:3000)");
  return url.replace(/\/$/, "");
}
