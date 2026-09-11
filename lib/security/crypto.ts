import { createHash, createHmac, randomUUID } from "node:crypto";
import { serverSecret } from "@/lib/config/env";

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const newUuid = () => randomUUID();

export function deriveAccessToken(kind: "order" | "intention", id: string): string {
  return createHmac("sha256", serverSecret())
    .update(`${kind}:${id}`)
    .digest("base64url");
}

export function rateLimitBucket(action: string, identity: string): string {
  return createHmac("sha256", serverSecret())
    .update(`${action}:${identity}`)
    .digest("hex");
}

export function stableHash(value: unknown): string {
  return sha256(JSON.stringify(value));
}
