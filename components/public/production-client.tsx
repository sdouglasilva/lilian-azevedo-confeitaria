"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { submitIntention, submitOrder } from "@/app/actions/public";
import type { PublicProduction } from "@/domain/productions/service";
import { ArrowRight, Check, Minus, Plus, X } from "@phosphor-icons/react";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const newKey = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

type Contact = { name: string; phone: string; email: string; website: string };
const emptyContact: Contact = { name: "", phone: "", email: "", website: "" };

function ContactFields({ value, onChange }: { value: Contact; onChange: (next: Contact) => void }) {
  const set = (key: keyof Contact) => (event: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: event.target.value });
  return <div className="form-grid">
    <label>Nome<input required autoComplete="name" value={value.name} onChange={set("name")} /></label>
    <label>Telefone<input required inputMode="tel" autoComplete="tel" placeholder="(31) 99999-9999" value={value.phone} onChange={set("phone")} /></label>
    <label>E-mail<input required type="email" autoComplete="email" value={value.email} onChange={set("email")} /></label>
    <label className="honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={value.website} onChange={set("website")} /></label>
    <p className="privacy-note">Usamos nome, telefone e e-mail somente para comunicação operacional sobre esta ação.</p>
  </div>;
}

export function ProductionClient({ production }: { production: PublicProduction }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [contact, setContact] = useState<Contact>(emptyContact);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const idempotencyKey = useRef<string>(newKey());
  const selectedItems = useMemo(() => production.items.filter((item) => (quantities[item.id] || 0) > 0), [production.items, quantities]);
  const total = selectedItems.reduce((sum, item) => sum + (item.price_cents || 0) * (quantities[item.id] || 0), 0);
  const itemCount = selectedItems.reduce((sum, item) => sum + (quantities[item.id] || 0), 0);

  const changeQuantity = (id: string, delta: number, remaining?: number | null) => {
    setQuantities((current) => {
      const max = remaining == null ? 99 : remaining;
      const next = Math.max(0, Math.min(max, (current[id] || 0) + delta));
      return { ...current, [id]: next };
    });
  };

  function reserve(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    startTransition(async () => {
      const result = await submitOrder({
        productionId: production.id, idempotencyKey: idempotencyKey.current,
        contact: { name: contact.name, phone: contact.phone, email: contact.email }, website: contact.website,
        items: selectedItems.map((item) => ({ id: item.id, quantity: quantities[item.id] || 0 })),
      });
      if (!result.ok) { setError(result.error); return; }
      if (result.id && result.token) window.location.assign(`/pedido/${result.id}?token=${encodeURIComponent(result.token)}`);
    });
  }

  function interest(event: React.FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!selectedSurvey) return;
    startTransition(async () => {
      const result = await submitIntention({
        productionId: production.id, productId: selectedSurvey, idempotencyKey: idempotencyKey.current,
        contact: { name: contact.name, phone: contact.phone, email: contact.email }, website: contact.website,
      });
      if (!result.ok) { setError(result.error); return; }
      if (result.alreadyActive) { setNotice("Seu interesse neste produto já estava registrado. O link original continua válido."); return; }
      if (result.id && result.token) window.location.assign(`/interesse/${result.id}?token=${encodeURIComponent(result.token)}`);
    });
  }

  return <>
    <div className="product-list">
      {production.items.map((item, index) => {
        const soldOut = production.mode === "RESERVATION" && item.remaining === 0;
        const fallbackImages = ["/assets/brigadeiro-tradicional.png", "/assets/beijinho-coco.png", "/assets/brigadeiro-pistache.png"];
        return <article className={`product-card ${quantities[item.id] ? "is-selected" : ""}`} key={item.id} style={{ animationDelay: `${index * 70}ms` }}>
          <div className="photo-frame"><img src={item.image_url || fallbackImages[index % fallbackImages.length]} alt={`Foto de ${item.name}`} /></div>
          <div className="product-body">
            <div className="product-heading"><div><span className="product-kicker">{index === 0 ? "O queridinho" : index === 1 ? "Receita afetiva" : "Edição especial"}</span><h2>{item.name}</h2></div>{soldOut && <span className="status status-sold">Esgotado</span>}</div>
            {item.short_description && <p>{item.short_description}</p>}
            {production.mode === "RESERVATION" && <div className="product-action-row">
              <strong>{item.price_cents == null ? "Preço pendente" : <>{money(item.price_cents)} <small>a unidade</small></>}</strong>
              <div className="stepper" aria-label={`Quantidade de ${item.name}`}>
                <button type="button" aria-label={`Diminuir ${item.name}`} onClick={() => changeQuantity(item.id, -1, item.remaining)} disabled={(quantities[item.id] || 0) === 0}><Minus size={18} weight="bold" /></button>
                <span aria-live="polite">{quantities[item.id] || 0}</span>
                <button type="button" aria-label={`Adicionar ${item.name}`} onClick={() => changeQuantity(item.id, 1, item.remaining)} disabled={soldOut || (item.remaining != null && (quantities[item.id] || 0) >= item.remaining)}><Plus size={18} weight="bold" /></button>
              </div>
            </div>}
            {production.mode === "SURVEY" && <button type="button" className={`button ${selectedSurvey === item.product_id ? "button-primary" : "button-secondary"}`} onClick={() => { setSelectedSurvey(item.product_id); setCheckoutOpen(true); setError(""); setNotice(""); idempotencyKey.current = newKey(); }}>{selectedSurvey === item.product_id ? <><Check size={18} weight="bold" /> Escolhido</> : "Tenho interesse"}</button>}
          </div>
        </article>;
      })}
    </div>

    {production.mode === "RESERVATION" && selectedItems.length > 0 && <div className="order-dock" role="region" aria-label="Resumo do pedido"><div><span>{itemCount} {itemCount === 1 ? "doce" : "doces"}</span><strong>{money(total)}</strong></div><button type="button" className="button dock-button" onClick={() => setCheckoutOpen(true)}>Reservar meus doces <ArrowRight size={22} weight="bold" /></button></div>}

    {production.mode === "RESERVATION" && selectedItems.length > 0 && checkoutOpen && <form className="checkout-panel checkout-sheet" onSubmit={reserve}>
      <button className="sheet-close" type="button" aria-label="Fechar resumo" onClick={() => setCheckoutOpen(false)}><X size={22} /></button>
      <div><span className="eyebrow">Seu pedido</span><h2>Quase lá!</h2><p>{itemCount} {itemCount === 1 ? "doce escolhido" : "doces escolhidos"} · <strong>{money(total)}</strong></p></div>
      <ContactFields value={contact} onChange={setContact} />
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <button className="button button-primary checkout-submit" disabled={pending}>{pending ? "Confirmando…" : <>Confirmar pedido <ArrowRight size={20} weight="bold" /></>}</button>
    </form>}

    {production.mode === "SURVEY" && selectedSurvey && checkoutOpen && <form className="checkout-panel checkout-sheet" onSubmit={interest}>
      <button className="sheet-close" type="button" aria-label="Fechar formulário" onClick={() => setCheckoutOpen(false)}><X size={22} /></button>
      <div><span className="eyebrow">Sondagem</span><h2>Conte pra Lilian</h2><p>Seu interesse ajuda a escolher a próxima fornada. Ainda não é uma reserva.</p></div>
      <ContactFields value={contact} onChange={setContact} />
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {notice && <p className="alert alert-success" role="status">{notice}</p>}
      <button className="button button-primary checkout-submit" disabled={pending}>{pending ? "Registrando…" : <>Registrar interesse <ArrowRight size={20} weight="bold" /></>}</button>
    </form>}
  </>;
}
