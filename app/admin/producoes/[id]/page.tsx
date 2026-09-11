import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getProduction, listIntentions, listOrders, listProductionItems, listProducts } from "@/lib/supabase/admin-data";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductionForm } from "@/components/admin/production-form";
import { StatusChip } from "@/components/ui/status-chip";
import { transitionOrderAction, transitionProductionAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/config/datetime";

export const dynamic = "force-dynamic";
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

type AdminOrder = Awaited<ReturnType<typeof listOrders>>[number];
type AdminIntention = Awaited<ReturnType<typeof listIntentions>>[number];

function orderItems(order: AdminOrder): Array<Record<string, unknown>> { return Array.isArray(order.order_items) ? order.order_items : []; }
function itemName(item: Record<string, unknown>) {
  const productionItem = item.production_items as Record<string, unknown> | null;
  const product = productionItem?.products as Record<string, unknown> | null;
  return String(product?.name || "Produto");
}
function customer(order: AdminOrder | AdminIntention) {
  const value = order.customers as Record<string, unknown> | null;
  return { name: String(value?.name || "Cliente"), email: String(value?.email || ""), phone: String(value?.phone || "") };
}
function derivedStatus(order: AdminOrder) {
  if (order.status === "AWAITING_PAYMENT" && new Date(String(order.expires_at)).getTime() <= Date.now()) return "EXPIRED";
  return String(order.status);
}
function orderTotal(order: AdminOrder) { return orderItems(order).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price_cents || 0), 0); }

export default async function ProductionDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filter?: string; error?: string; saved?: string; updated?: string }> }) {
  const { id } = await params; const query = await searchParams; const session = await requireAdmin();
  const [production, products, productionItems, orders, intentions] = await Promise.all([getProduction(id, session.accessToken), listProducts(session.accessToken), listProductionItems(id, session.accessToken), listOrders(id, session.accessToken), listIntentions(id, session.accessToken)]);
  if (!production) return notFound();

  const confirmed = orders.filter((order) => derivedStatus(order) === "PAYMENT_CONFIRMED");
  const produce = new Map<string, number>();
  for (const order of confirmed) for (const item of orderItems(order)) produce.set(itemName(item), (produce.get(itemName(item)) || 0) + Number(item.quantity || 0));
  const filter = query.filter || "all";
  const filtered = orders.filter((order) => {
    const status = derivedStatus(order);
    if (filter === "pending") return status === "AWAITING_PAYMENT";
    if (filter === "confirmed") return status === "PAYMENT_CONFIRMED";
    if (filter === "closed") return status === "EXPIRED" || status === "CANCELLED";
    if (filter === "completed") return status === "COMPLETED";
    return true;
  });

  return <AdminShell email={session.email}>
    <div className="page-heading"><div><span className="eyebrow">{production.mode === "SURVEY" ? "Sondagem" : "Reservas"}</span><h1>{production.public_slug}</h1><div className="heading-status"><StatusChip status={production.status} /><span>Retirada: {formatDateTime(production.fulfillment_at)}</span></div></div>{production.status !== "DRAFT" && <Link className="button button-ghost" target="_blank" href={`/p/${production.public_slug}`}>Abrir link público</Link>}</div>
    {(query.error || query.saved || query.updated) && <p className={`alert ${query.error ? "alert-error" : "alert-success"}`}>{query.error ? "A operação não pôde ser concluída. O banco preservou o estado anterior." : "Alterações salvas."}</p>}

    <section className="production-actions"><h2>Ações da produção</h2><div className="action-row">{production.status === "DRAFT" && <form action={transitionProductionAction.bind(null, id, "ACTIVE")}><button className="button button-primary">Publicar</button></form>}{production.status === "ACTIVE" && <><form action={transitionProductionAction.bind(null, id, "CLOSED")}><button className="button button-secondary">Encerrar</button></form><form action={transitionProductionAction.bind(null, id, "CANCELLED")}><button className="button button-danger">Cancelar produção</button></form></>}{production.status === "CLOSED" && <form action={transitionProductionAction.bind(null, id, "COMPLETED")}><button className="button button-primary">Concluir produção</button></form>}</div></section>

    {production.mode === "RESERVATION" && <section className="produce-card"><span className="eyebrow">Prioridade</span><h2>Quanto produzir</h2><p>Somente pagamentos confirmados entram nesta conta.</p>{produce.size === 0 ? <div className="empty-inline">Nenhuma quantidade confirmada ainda.</div> : <ul>{[...produce.entries()].map(([name, quantity]) => <li key={name}><span>{name}</span><strong>{quantity}</strong></li>)}</ul>}</section>}

    {production.mode === "RESERVATION" && <section className="ops-section"><div className="section-heading"><div><span className="eyebrow">Operação</span><h2>Pedidos</h2></div><span className="muted">{orders.filter((order) => derivedStatus(order) === "AWAITING_PAYMENT").length} pendente(s)</span></div><nav className="filter-tabs"><Link className={filter === "all" ? "active" : ""} href={`?filter=all`}>Todos</Link><Link className={filter === "pending" ? "active" : ""} href={`?filter=pending`}>Pendentes</Link><Link className={filter === "confirmed" ? "active" : ""} href={`?filter=confirmed`}>Confirmados</Link><Link className={filter === "closed" ? "active" : ""} href={`?filter=closed`}>Exp./Cancel.</Link><Link className={filter === "completed" ? "active" : ""} href={`?filter=completed`}>Concluídos</Link></nav>
      {filtered.length === 0 ? <div className="empty-inline">Nenhum pedido neste filtro.</div> : <div className="order-stack">{filtered.map((order) => { const status = derivedStatus(order); const person = customer(order); return <article className="order-card" key={String(order.id)}><div className="order-heading"><div><strong>{person.name}</strong><small>{person.phone} · {person.email}</small></div><StatusChip status={status} /></div><ul className="compact-items">{orderItems(order).map((item, index) => <li key={`${String(order.id)}-${index}`}><span>{Number(item.quantity)}× {itemName(item)}</span><span>{money(Number(item.quantity) * Number(item.unit_price_cents))}</span></li>)}</ul><div className="order-footer"><strong>{money(orderTotal(order))}</strong><div className="action-row">{status === "AWAITING_PAYMENT" && <><form action={transitionOrderAction.bind(null, id, String(order.id), "PAYMENT_CONFIRMED")}><button className="button button-primary button-small">Confirmar Pix</button></form><form action={transitionOrderAction.bind(null, id, String(order.id), "CANCELLED")}><button className="button button-danger button-small">Cancelar</button></form></>}{status === "PAYMENT_CONFIRMED" && <><form action={transitionOrderAction.bind(null, id, String(order.id), "COMPLETED")}><button className="button button-primary button-small">Concluir pedido</button></form><form action={transitionOrderAction.bind(null, id, String(order.id), "CANCELLED")}><button className="button button-danger button-small">Cancelar</button></form></>}</div></div></article>; })}</div>}
    </section>}

    {production.mode === "SURVEY" && <section className="ops-section"><div className="section-heading"><div><span className="eyebrow">Sinal fraco</span><h2>Intenções</h2></div></div>{intentions.length === 0 ? <div className="empty-inline">Ainda não há intenções registradas.</div> : <div className="admin-list">{intentions.map((intention) => { const person = customer(intention); const product = intention.products as Record<string, unknown> | null; return <div className="admin-list-row" key={String(intention.id)}><div><strong>{String(product?.name || "Produto")}</strong><small>{person.name} · {person.phone}</small></div><StatusChip status={String(intention.status)} /></div>; })}</div>}</section>}

    {(production.status === "DRAFT" || production.status === "ACTIVE") && <details className="editor-card" open={production.status === "DRAFT"}><summary>Editar produção</summary><ProductionForm products={products} production={production} productionItems={productionItems} /></details>}
  </AdminShell>;
}
