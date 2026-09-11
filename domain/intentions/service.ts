import { serverSecret } from "@/lib/config/env";
import { deriveAccessToken, newUuid, sha256, stableHash } from "@/lib/security/crypto";
import { rpc } from "@/lib/supabase/rest";
import { normalizeContact, type ContactInput } from "@/lib/validation/public";

export async function createIntention(input: { productionId: string; productId: string; idempotencyKey: string; contact: ContactInput }) {
  const id = newUuid();
  const token = deriveAccessToken("intention", id);
  const contact = normalizeContact(input.contact);
  const canonical = { productionId: input.productionId, productId: input.productId, contact };
  const result = await rpc<{ id?: string; reused?: boolean; already_active?: boolean }>("la_create_intention", {
    p_secret: serverSecret(), p_id: id, p_key: input.idempotencyKey, p_hash: stableHash(canonical), p_token_hash: sha256(token),
    p_production: input.productionId, p_product: input.productId, p_contact: contact,
  });
  if (!result.id) return result;
  return { ...result, token: deriveAccessToken("intention", result.id) };
}

export async function getIntention(id: string, token: string, withdraw = false) {
  return rpc<Record<string, unknown> | null>("la_get_intention", { p_secret: serverSecret(), p_id: id, p_token_hash: sha256(token), p_withdraw: withdraw });
}
