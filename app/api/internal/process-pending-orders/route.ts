import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverSecret } from "@/lib/config/env";
import { rpc } from "@/lib/supabase/rest";
import { sendEntityEmail } from "@/lib/email/transactional";

export const dynamic = "force-dynamic";

function matchesSecret(candidate: string, expected: string) {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = serverSecret();
  const auth = request.headers.get("authorization") || "";
  const candidate = auth.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-cron-secret") || "";
  if (!candidate || !matchesSecret(candidate, expected)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await rpc<{ expired: string[]; reminders: string[] }>("la_process_pending", { p_secret: expected });
  const expired = result.expired || [];
  const reminders = result.reminders || [];
  const expiredResults = await Promise.allSettled(expired.map((id) => sendEntityEmail(id, "closed")));
  const reminderResults = await Promise.allSettled(reminders.map((id) => sendEntityEmail(id, "reminder")));
  const sent = [...expiredResults, ...reminderResults].filter((entry) => entry.status === "fulfilled" && entry.value === "sent").length;
  const failed = [...expiredResults, ...reminderResults].filter((entry) => entry.status === "rejected" || (entry.status === "fulfilled" && entry.value === "failed")).length;
  return NextResponse.json({ expired: expired.length, reminders: reminders.length, emailSent: sent, emailFailed: failed });
}
