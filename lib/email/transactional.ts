import { emailConfig, paymentConfig, publicConfig, serverSecret } from "@/lib/config/env";
import { deriveAccessToken } from "@/lib/security/crypto";
import { rpc } from "@/lib/supabase/rest";
import { formatDateTime } from "@/lib/config/datetime";
import { sendEmail } from "@/lib/email/brevo";

type Kind = "received" | "reminder" | "confirmed" | "closed" | "intention";
type OrderContext = {
  id: string; status: string; total_cents: number; expires_at?: string; fulfillment_at?: string;
  items: Array<{ name: string; quantity: number; unit_price_cents: number }>;
  customer: { name: string; email: string };
};
type IntentionContext = { id: string; status: string; name: string; customer: { name: string; email: string } };

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]!));

function pixHtml() {
  const pix = paymentConfig();
  if (!pix.pixKey) return "<p><strong>Pix:</strong> configuração pendente. Aguarde orientação da confeiteira.</p>";
  return `<p><strong>Pix para ${esc(pix.recipientName || "LA Confeitaria Artesanal")}:</strong><br><code>${esc(pix.pixKey)}</code></p>${pix.instructions ? `<p>${esc(pix.instructions)}</p>` : ""}`;
}

function orderMessage(kind: Kind, context: OrderContext) {
  const token = deriveAccessToken("order", context.id);
  const link = `${publicConfig().appUrl}/pedido/${context.id}?token=${encodeURIComponent(token)}`;
  const items = context.items.map((item) => `<li>${esc(item.quantity)}× ${esc(item.name)} — ${esc(money(item.quantity * item.unit_price_cents))}</li>`).join("");
  const common = `<p>Olá, ${esc(context.customer.name)}.</p><ul>${items}</ul><p><strong>Total:</strong> ${esc(money(context.total_cents))}</p>`;
  if (kind === "received") return { subject: "Recebemos seu pedido — LA Confeitaria", html: `${common}${pixHtml()}<p>Pagamento até ${esc(formatDateTime(context.expires_at))}.</p><p><a href="${esc(link)}">Acompanhar pedido</a></p>` };
  if (kind === "reminder") return { subject: "Lembrete do seu pedido — LA Confeitaria", html: `${common}<p>Seu prazo de pagamento termina em ${esc(formatDateTime(context.expires_at))}.</p>${pixHtml()}<p><a href="${esc(link)}">Ver pedido</a></p>` };
  if (kind === "confirmed") return { subject: "Pagamento confirmado — LA Confeitaria", html: `${common}<p>Pagamento confirmado. Seu pedido entrou na produção.</p><p>Retirada/entrega: ${esc(formatDateTime(context.fulfillment_at))}.</p><p><a href="${esc(link)}">Ver pedido</a></p>` };
  return { subject: "Atualização do seu pedido — LA Confeitaria", html: `${common}<p>Este pedido não está mais reservado. Status: ${esc(context.status)}.</p><p><a href="${esc(link)}">Ver pedido</a></p>` };
}

function intentionMessage(context: IntentionContext) {
  const token = deriveAccessToken("intention", context.id);
  const link = `${publicConfig().appUrl}/interesse/${context.id}?token=${encodeURIComponent(token)}`;
  return { subject: "Interesse registrado — LA Confeitaria", html: `<p>Olá, ${esc(context.customer.name)}.</p><p>Seu interesse em <strong>${esc(context.name)}</strong> foi registrado. Isso não é uma reserva e não garante produção.</p><p><a href="${esc(link)}">Consultar ou retirar interesse</a></p>` };
}

export async function sendEntityEmail(id: string, kind: Kind): Promise<"sent" | "skipped" | "failed"> {
  if (!emailConfig().apiKey) {
    console.info("transactional_email_deferred", { kind, entity: id.slice(0, 8) });
    return "skipped";
  }
  const secret = serverSecret();
  const claim = await rpc<{ key: string } | null>("la_claim_email", { p_secret: secret, p_id: id, p_kind: kind });
  if (!claim?.key) return "skipped";
  try {
    const context = await rpc<OrderContext | IntentionContext | null>("la_email_context", { p_secret: secret, p_id: id, p_kind: kind });
    if (!context) {
      await rpc("la_finish_email", { p_secret: secret, p_id: id, p_kind: kind, p_key: claim.key, p_status: "FAILED", p_error: "NO_CONTEXT" });
      return "failed";
    }
    const message = kind === "intention" ? intentionMessage(context as IntentionContext) : orderMessage(kind, context as OrderContext);
    const result = await sendEmail({ to: context.customer.email, ...message });
    if (result.status === "skipped") {
      await rpc("la_finish_email", { p_secret: secret, p_id: id, p_kind: kind, p_key: claim.key, p_status: "FAILED", p_error: "NOT_CONFIGURED" });
      return "skipped";
    }
    await rpc("la_finish_email", { p_secret: secret, p_id: id, p_kind: kind, p_key: claim.key, p_status: "SENT", p_provider_id: result.providerId || null, p_error: null });
    return "sent";
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 70) : "EMAIL_ERROR";
    await rpc("la_finish_email", { p_secret: secret, p_id: id, p_kind: kind, p_key: claim.key, p_status: "UNKNOWN", p_error: code }).catch(() => undefined);
    console.error("transactional_email_failed", { kind, entity: id.slice(0, 8), code });
    return "failed";
  }
}
