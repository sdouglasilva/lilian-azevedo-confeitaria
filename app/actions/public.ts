"use server";

import { createOrder, cancelOrder } from "@/domain/orders/service";
import { createIntention, getIntention } from "@/domain/intentions/service";
import { sendEntityEmail } from "@/lib/email/transactional";
import { SupabaseHttpError } from "@/lib/supabase/rest";
import { parsePositiveInt, validateContact, type ContactInput } from "@/lib/validation/public";
import { requireRateLimit } from "@/lib/security/rate-limit";

export type PublicActionResult = { ok: true; id?: string; token?: string; alreadyActive?: boolean } | { ok: false; error: string };

type OrderPayload = { productionId: string; idempotencyKey: string; contact: ContactInput; items: Array<{ id: string; quantity: number }>; website?: string };
type IntentionPayload = { productionId: string; productId: string; idempotencyKey: string; contact: ContactInput; website?: string };

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("CAPACITY_EXCEEDED")) return "Uma das quantidades acabou de esgotar. Revise seu pedido.";
  if (message.includes("PRODUCTION_UNAVAILABLE")) return "Esta produção não está mais aceitando ações.";
  if (message.includes("RATE_LIMITED")) return "Muitas tentativas em pouco tempo. Tente novamente em um minuto.";
  if (message.includes("INVALID_CONTACT")) return "Revise nome, telefone e e-mail.";
  if (message.includes("INVALID_ITEMS")) return "Revise os itens selecionados.";
  if (error instanceof SupabaseHttpError && error.status >= 500) return "Serviço temporariamente indisponível. Tente novamente.";
  return "Não foi possível concluir agora. Tente novamente.";
}

export async function submitOrder(payload: OrderPayload): Promise<PublicActionResult> {
  try {
    if (payload.website) return { ok: false, error: "Não foi possível concluir agora." };
    const contactError = validateContact(payload.contact);
    if (contactError) return { ok: false, error: contactError };
    if (!/^[0-9a-f-]{36}$/i.test(payload.productionId) || !/^[0-9a-f-]{36}$/i.test(payload.idempotencyKey)) return { ok: false, error: "Dados inválidos." };
    const items = payload.items.map((item) => ({ id: item.id, quantity: parsePositiveInt(item.quantity) || 0 })).filter((item) => item.quantity > 0);
    if (!items.length || items.length > 30 || items.some((item) => !/^[0-9a-f-]{36}$/i.test(item.id))) return { ok: false, error: "Selecione ao menos um item." };
    await requireRateLimit("create-order");
    const result = await createOrder({ ...payload, items });
    await sendEntityEmail(result.id, "received").catch(() => "failed");
    return { ok: true, id: result.id, token: result.token };
  } catch (error) {
    return { ok: false, error: publicError(error) };
  }
}

export async function submitIntention(payload: IntentionPayload): Promise<PublicActionResult> {
  try {
    if (payload.website) return { ok: false, error: "Não foi possível concluir agora." };
    const contactError = validateContact(payload.contact);
    if (contactError) return { ok: false, error: contactError };
    if (![payload.productionId, payload.productId, payload.idempotencyKey].every((value) => /^[0-9a-f-]{36}$/i.test(value))) return { ok: false, error: "Dados inválidos." };
    await requireRateLimit("create-intention");
    const result = await createIntention(payload);
    if (result.already_active && !result.id) return { ok: true, alreadyActive: true };
    if (!result.id || !("token" in result)) return { ok: false, error: "Não foi possível confirmar o interesse." };
    await sendEntityEmail(result.id, "intention").catch(() => "failed");
    return { ok: true, id: result.id, token: String(result.token) };
  } catch (error) {
    return { ok: false, error: publicError(error) };
  }
}

export async function cancelOrderAction(id: string, token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireRateLimit("cancel-order");
    await cancelOrder(id, token);
    await sendEntityEmail(id, "closed").catch(() => "failed");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: publicError(error) };
  }
}

export async function withdrawIntentionAction(id: string, token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireRateLimit("withdraw-intention");
    const result = await getIntention(id, token, true);
    if (!result) return { ok: false, error: "Link inválido ou expirado." };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: publicError(error) };
  }
}
