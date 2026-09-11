"use server";

import { redirect } from "next/navigation";
import { signInAdmin, signOutAdmin } from "@/lib/auth/admin";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) redirect("/admin/login?error=missing");
  try {
    await signInAdmin(email, password);
  } catch {
    redirect("/admin/login?error=invalid");
  }
  redirect("/admin");
}

export async function logoutAction() {
  await signOutAdmin();
  redirect("/admin/login");
}
