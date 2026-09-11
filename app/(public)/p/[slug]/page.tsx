import { notFound } from "next/navigation";
import { getPublicProduction, type PublicProduction } from "@/domain/productions/service";
import { ProductionClient } from "@/components/public/production-client";
import { ShareButton } from "@/components/public/share-button";
import { formatDateTime } from "@/lib/config/datetime";
import { productionLabel } from "@/domain/productions/rules";
import { CalendarDots, Clock, ShareNetwork } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

const previewProduction: PublicProduction = {
  id: "00000000-0000-4000-8000-000000000001",
  public_slug: "preview-la",
  mode: "RESERVATION",
  status: "ACTIVE",
  accepting: true,
  order_cutoff_at: "2026-09-13T21:00:00-03:00",
  fulfillment_at: "2026-09-14T13:00:00-03:00",
  items: [
    { id: "00000000-0000-4000-8000-000000000011", product_id: "00000000-0000-4000-8000-000000000021", name: "Brigadeiro Tradicional", short_description: "Cremoso, com chocolate belga e granulado de verdade.", price_cents: 600, remaining: 24, image_url: "/assets/brigadeiro-tradicional.png" },
    { id: "00000000-0000-4000-8000-000000000012", product_id: "00000000-0000-4000-8000-000000000022", name: "Beijinho de Coco", short_description: "Delicado, com coco fresco e um toque de leite condensado.", price_cents: 600, remaining: 18, image_url: "/assets/beijinho-coco.png" },
    { id: "00000000-0000-4000-8000-000000000013", product_id: "00000000-0000-4000-8000-000000000023", name: "Brigadeiro de Pistache", short_description: "Pistache selecionado e um toque delicado de flor de sal.", price_cents: 750, remaining: 8, image_url: "/assets/brigadeiro-pistache.png" },
  ],
};

export default async function ProductionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const production = process.env.NODE_ENV === "development" && slug === "preview-la" ? previewProduction : await getPublicProduction(slug);
  if (!production) return notFound();
  const active = production.accepting && production.status === "ACTIVE";
  const heroImage = production.items.find((item) => item.image_url)?.image_url || "/assets/brigadeiro-tradicional.png";
  return <main className="public-shell">
    <header className="brand-header"><div><span className="brand-mark">LA</span><div><strong>Lilian Azevedo</strong><small>Confeitaria Artesanal</small></div></div><div className="share-wrap"><ShareNetwork size={18} weight="bold" aria-hidden="true" /><ShareButton /></div></header>
    <section className="production-hero">
      <div className="hero-copy"><span className="eyebrow">{productionLabel(production.mode, production.status)}</span><h1>{production.mode === "SURVEY" ? "Qual doce merece a próxima fornada?" : "Fornada aberta!"}</h1><p>{production.mode === "SURVEY" ? "Conte o que deu vontade. Seu interesse ajuda a Lilian a escolher a próxima produção." : "Doces artesanais, ingredientes de verdade e pequenas levas. Escolha os seus e garanta a retirada."}</p></div>
      <div className="hero-photo"><img src={heroImage} alt="Doce artesanal da fornada" /><span>Feitos que fazem bons dias</span></div>
      <dl className="hero-meta"><div><Clock size={24} weight="duotone" aria-hidden="true" /><span><dt>Pedidos até</dt><dd>{formatDateTime(production.order_cutoff_at)}</dd></span></div><div><CalendarDots size={24} weight="duotone" aria-hidden="true" /><span><dt>Retirada</dt><dd>{formatDateTime(production.fulfillment_at)}</dd></span></div></dl>
    </section>
    <div className="section-intro"><div><span className="eyebrow">Receitas afetivas</span><h2>{production.mode === "SURVEY" ? "Escolha seu favorito" : "Nossos doces"}</h2></div><p>Feitos à mão, em pequenas quantidades.</p></div>
    {!active ? <section className={`state-card ${production.status === "CANCELLED" ? "state-cancelled" : ""}`}><h2>{production.status === "CANCELLED" ? "Produção cancelada" : "Produção encerrada"}</h2><p>Esta produção não está aceitando novas ações.</p></section> : production.items.length === 0 ? <section className="state-card"><h2>Nenhum item disponível agora</h2><p>Volte em breve.</p></section> : <ProductionClient production={production} />}
  </main>;
}
