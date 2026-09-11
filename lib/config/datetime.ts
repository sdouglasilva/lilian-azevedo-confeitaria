import { publicConfig } from "./env.ts";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "A combinar";
  return new Intl.DateTimeFormat(publicConfig().locale, {
    timeZone: publicConfig().timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function offsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value || 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

export function zonedLocalToIso(local: string, timeZone = publicConfig().timezone): string | null {
  if (!local) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) throw new Error("INVALID_DATETIME");
  const [, y, m, d, hh, mm] = match;
  const naive = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, 0));
  let candidate = new Date(naive.getTime() - offsetMs(naive, timeZone));
  candidate = new Date(naive.getTime() - offsetMs(candidate, timeZone));
  return candidate.toISOString();
}

export function isoToLocalInput(value: string | null | undefined, timeZone = publicConfig().timezone): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
