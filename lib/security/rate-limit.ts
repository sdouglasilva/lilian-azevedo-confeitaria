import { headers } from "next/headers";
import { serverSecret } from "@/lib/config/env";
import { rateLimitBucket } from "@/lib/security/crypto";
import { rpc } from "@/lib/supabase/rest";

export async function allowRequest(action: string, limit = 12, seconds = 60) {
  const h = await headers();
  const identity = h.get("x-nf-client-connection-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return rpc<boolean>("la_rate_limit", {
    p_secret: serverSecret(),
    p_bucket: rateLimitBucket(action, identity),
    p_limit: limit,
    p_seconds: seconds,
  });
}

export async function requireRateLimit(action: string, limit = 12, seconds = 60) {
  if (!(await allowRequest(action, limit, seconds))) throw new Error("RATE_LIMITED");
}
