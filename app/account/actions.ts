"use server";

import { prisma } from "@/lib/prisma";
import { clearSession, requireSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function deleteMyAccount() {
  const { userId } = await requireSession();

  await prisma.user.delete({ where: { id: userId } });
  await clearSession();
  redirect("/signup");
}

