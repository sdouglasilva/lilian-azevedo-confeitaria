import { notFound } from "next/navigation";
import { getPublicProduction } from "@/domain/productions/service";
import { ProductionClient } from "@/components/public/production-client";
import { ShareButton } from "@/components/public/share-button";
import { formatDateTime } from "@/lib/config/datetime";
import { productionLabel } from "@/domain/productions/rules";

export const dynamic = "force-dynamic";

export default async function ProductionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const production = await getPublicProduction(slug);
  if (!production) return notFound();
  const active = production.accepting && production.status === "ACTIVE";
  return <main className="public-shell">
    <header className="brand-header"><div><span className="brand-mark">LA</span><div><strong>Lilian Azevedo</strong><small>Confeitaria Artesanal</small></div></div><ShareButton /></header>
    <section className="production-hero">
      <span className="eyebrow">{productionLabel(production.mode, production.status)}</span>
      <h1>{production.mode === "SURVEY" ? "O que você gostaria de ver na próxima produção?" : "Produção artesanal aberta"}</h1>
      <p>{production.mode === "SURVEY" ? "Sinalize seu interesse. Não é reserva e não garante produção." : "Escolha seus doces, confirme uma única vez e faça o Pix fora do sistema."}</p>
      <dl className="hero-meta"><div><dt>Retirada</dt><dd>{formatDateTime(production.fulfillment_at)}</dd></div><div><dt>Pedidos até</dt><dd>{formatDateTime(production.order_cutoff_at)}</dd></div></dl>
    </section>
    {!active ? <section className={`state-card ${production.status === "CANCELLED" ? "state-cancelled" : ""}`}><h2>{production.status === "CANCELLED" ? "Produção cancelada" : "Produção encerrada"}</h2><p>Esta produção não está aceitando novas ações.</p></section> : production.items.length === 0 ? <section className="state-card"><h2>Nenhum item disponível agora</h2><p>Volte em breve.</p></section> : <ProductionClient production={production} />}
  </main>;
}
