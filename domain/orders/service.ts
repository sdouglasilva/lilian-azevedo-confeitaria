import { serverSecret } from "@/lib/config/env";
import { deriveAccessToken, newUuid, sha256, stableHash } from "@/lib/security/crypto";
import { rpc } from "@/lib/supabase/rest";
import { normalizeContact, type ContactInput } from "@/lib/validation/public";

export type CreateOrderInput = {
  productionId: string;
  idempotencyKey: string;
  contact: ContactInput;
  items: Array<{ id: string; quantity: number }>;
};

export async function createOrder(input: CreateOrderInput) {
  const id = newUuid();
  const token = deriveAccessToken("order", id);
  const contact = normalizeContact(input.contact);
  const canonical = { productionId: input.productionId, contact, items: [...input.items].sort((a, b) => a.id.localeCompare(b.id)) };
  const result = await rpc<{ id: string; reused: boolean }>("la_create_order", {
    p_secret: serverSecret(), p_id: id, p_key: input.idempotencyKey, p_hash: stableHash(canonical), p_token_hash: sha256(token),
    p_production: input.productionId, p_contact: contact, p_items: canonical.items,
  });
  const actualId = result.id;
  return { ...result, token: deriveAccessToken("order", actualId) };
}

export async function getOrder(id: string, token: string) {
  return rpc<Record<string, unknown> | null>("la_get_order", { p_secret: serverSecret(), p_id: id, p_token_hash: sha256(token) });
}

export async function cancelOrder(id: string, token: string) {
  return rpc<Record<string, unknown>>("la_cancel_order", { p_secret: serverSecret(), p_id: id, p_token_hash: sha256(token) });
}
