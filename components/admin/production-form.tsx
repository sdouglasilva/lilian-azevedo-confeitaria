import { saveProductionAction } from "@/app/actions/admin";
import type { ProductRow, ProductionItemRow, ProductionRow } from "@/lib/supabase/admin-data";
import { isoToLocalInput } from "@/lib/config/datetime";

const reais = (cents: number | null | undefined) => cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");

export function ProductionForm({ products, production, productionItems = [] }: { products: ProductRow[]; production?: ProductionRow | null; productionItems?: ProductionItemRow[] }) {
  const byProduct = new Map(productionItems.map((item) => [item.product_id, item]));
  const activeLocked = production?.status === "ACTIVE";
  return <form action={saveProductionAction} className="form-grid production-form">
    {production && <input type="hidden" name="id" value={production.id} />}
    <label>Slug público<input name="public_slug" required pattern="[a-z0-9][a-z0-9-]{2,79}" placeholder="brigadeiro-sabado" defaultValue={production?.public_slug || ""} disabled={Boolean(production)} /></label>
    {production && <input type="hidden" name="public_slug" value={production.public_slug} />}
    <label>Modo<select name="mode" defaultValue={production?.mode || "RESERVATION"} disabled={activeLocked}><option value="RESERVATION">Reservas</option><option value="SURVEY">Sondagem</option></select></label>
    {activeLocked && <input type="hidden" name="mode" value={production!.mode} />}
    <div className="two-col"><label>Retirada/entrega<input type="datetime-local" name="fulfillment_at" defaultValue={isoToLocalInput(production?.fulfillment_at)} /></label><label>Pedidos/interesses até<input type="datetime-local" name="order_cutoff_at" required defaultValue={isoToLocalInput(production?.order_cutoff_at)} /></label></div>
    <div className="two-col"><label>Janela de pagamento (min)<input type="number" min="1" max="10080" name="payment_window_minutes" defaultValue={production?.payment_window_minutes || 360} /></label><label>Lembrete antes (min)<input type="number" min="0" max="10080" name="reminder_before_minutes" defaultValue={production?.reminder_before_minutes ?? 120} /></label></div>
    <fieldset className="items-fieldset"><legend>Itens da produção</legend>{products.length === 0 ? <p className="muted">Crie um produto antes de montar a produção.</p> : products.map((product) => { const item = byProduct.get(product.id); const checked = Boolean(item?.offer_enabled); return <div className="production-item-editor" key={product.id}><label className="check-label"><input type="checkbox" name="product_id" value={product.id} defaultChecked={production ? checked : false} /><span><strong>{product.name}</strong><small>{product.status === "INACTIVE" ? "Inativo" : product.base_price_cents == null ? "Sem preço-base" : `Base R$ ${reais(product.base_price_cents)}`}</small></span></label><label>Preço nesta produção<input name={`price_${product.id}`} inputMode="decimal" placeholder="usar preço-base" defaultValue={reais(item?.price_cents)} /></label><label>Capacidade<input name={`capacity_${product.id}`} type="number" min="1" placeholder="sem limite" defaultValue={item?.capacity ?? ""} /></label></div>; })}</fieldset>
    <button className="button button-primary" type="submit">{production ? "Salvar produção" : "Criar produção"}</button>
  </form>;
}
