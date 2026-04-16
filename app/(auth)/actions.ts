"use server";

import { prisma } from "@/lib/prisma";
import { createSession, hashPassword, verifyPassword } from "@/lib/auth";
import { redirect } from "next/navigation";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function signUp(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) throw new Error("Invalid email");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
  });

  await createSession({ userId: user.id, email: user.email });
  redirect("/");
}

export async function signIn(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Invalid email or password");

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new Error("Invalid email or password");

  await createSession({ userId: user.id, email: user.email });
  redirect("/");
}

