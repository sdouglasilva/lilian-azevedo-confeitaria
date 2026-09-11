import Link from "next/link";
import { getOrder } from "@/domain/orders/service";
import { paymentConfig } from "@/lib/config/env";
import { formatDateTime } from "@/lib/config/datetime";
import { allowRequest } from "@/lib/security/rate-limit";
import { StatusChip } from "@/components/ui/status-chip";
import { CancelOrderButton } from "@/components/public/secure-actions";
import { CopyButton } from "@/components/public/copy-button";

export const dynamic = "force-dynamic";
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params; const { token = "" } = await searchParams;
  const rateAllowed = token ? await allowRequest("read-order", 60, 60) : false;
  const order = rateAllowed ? await getOrder(id, token) : null;
  if (!order) return <main className="narrow-shell"><section className="state-card"><span className="eyebrow">Link seguro</span><h1>Pedido não encontrado</h1><p>O link pode estar incompleto ou inválido.</p></section></main>;
  const status = String(order.status);
  const items = Array.isArray(order.items) ? order.items as Array<{ name: string; quantity: number; unit_price_cents: number }> : [];
  const pix = paymentConfig();
  const canCancel = status === "AWAITING_PAYMENT" && new Date(String(order.expires_at)).getTime() > Date.now();
  return <main className="narrow-shell">
    <Link className="brand-link" href={`/p/${order.public_slug}`}>LA Confeitaria Artesanal</Link>
    <section className="secure-card">
      <div className="secure-heading"><div><span className="eyebrow">Pedido</span><h1>Seu pedido</h1></div><StatusChip status={status} /></div>
      <ul className="line-items">{items.map((item, index) => <li key={`${item.name}-${index}`}><span>{item.quantity}× {item.name}</span><strong>{money(item.quantity * item.unit_price_cents)}</strong></li>)}</ul>
      <div className="total-row"><span>Total</span><strong>{money(Number(order.total_cents || 0))}</strong></div>
      {status === "AWAITING_PAYMENT" && <section className="payment-box"><h2>Pagamento via Pix</h2>{pix.pixKey ? <><p>Chave de {pix.recipientName || "LA Confeitaria Artesanal"}</p><div className="copy-line"><code>{pix.pixKey}</code><CopyButton value={pix.pixKey} /></div>{pix.instructions && <p>{pix.instructions}</p>}</> : <p className="alert alert-pending">Configuração do Pix pendente. Aguarde orientação da confeiteira.</p>}<p>Prazo: <strong>{formatDateTime(String(order.expires_at))}</strong></p></section>}
      {status === "PAYMENT_CONFIRMED" && <p className="alert alert-success">Pagamento confirmado. Seu pedido entrou na produção.</p>}
      <dl className="detail-list"><div><dt>Retirada/entrega</dt><dd>{formatDateTime(String(order.fulfillment_at || ""))}</dd></div><div><dt>Criado em</dt><dd>{formatDateTime(String(order.created_at || ""))}</dd></div></dl>
      {canCancel && <div className="danger-zone"><p>Se desistir antes do vencimento, o pedido pode ser cancelado por aqui.</p><CancelOrderButton id={id} token={token} /></div>}
    </section>
  </main>;
}

