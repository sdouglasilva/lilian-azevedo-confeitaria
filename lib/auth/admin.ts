import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAllowlist, requireSupabaseConfig } from "@/lib/config/env";

const ACCESS = "la_admin_access";
const REFRESH = "la_admin_refresh";

export type AdminSession = { accessToken: string; email: string; id: string };

export async function signInAdmin(email: string, password: string) {
  const config = requireSupabaseConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: config.supabaseKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token || !body.user?.email) throw new Error("INVALID_LOGIN");
  const normalized = String(body.user.email).toLowerCase();
  if (!adminAllowlist().has(normalized)) throw new Error("FORBIDDEN");
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  store.set(ACCESS, body.access_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: body.expires_in || 3600 });
  if (body.refresh_token) store.set(REFRESH, body.refresh_token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return { email: normalized };
}

export async function signOutAdmin() {
  const store = await cookies();
  store.delete(ACCESS);
  store.delete(REFRESH);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS)?.value;
  if (!accessToken) return null;
  const config = requireSupabaseConfig();
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: config.supabaseKey, Authorization: `Bearer ${accessToken}` }, cache: "no-store",
  });
  if (!response.ok) return null;
  const user = await response.json();
  const email = String(user.email || "").toLowerCase();
  if (!user.id || !email || !adminAllowlist().has(email)) return null;
  return { accessToken, email, id: user.id };
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) return redirect("/admin/login");
  return session;
}
