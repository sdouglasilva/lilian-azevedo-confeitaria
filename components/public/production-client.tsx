"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { submitIntention, submitOrder } from "@/app/actions/public";
import type { PublicProduction } from "@/domain/productions/service";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const newKey = () => crypto.randomUUID();

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
  const [pending, startTransition] = useTransition();
  const idempotencyKey = useRef<string>(newKey());
  const selectedItems = useMemo(() => production.items.filter((item) => (quantities[item.id] || 0) > 0), [production.items, quantities]);
  const total = selectedItems.reduce((sum, item) => sum + (item.price_cents || 0) * (quantities[item.id] || 0), 0);

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
      {production.items.map((item) => {
        const soldOut = production.mode === "RESERVATION" && item.remaining === 0;
        return <article className="product-card" key={item.id}>
          {item.image_url ? <div className="photo-frame"><img src={item.image_url} alt={`Foto de ${item.name}`} /></div> : <div className="photo-frame photo-placeholder" aria-hidden="true">LA</div>}
          <div className="product-body">
            <div className="product-heading"><h2>{item.name}</h2>{soldOut && <span className="status status-sold">Esgotado</span>}</div>
            {item.short_description && <p>{item.short_description}</p>}
            {production.mode === "RESERVATION" && <div className="product-action-row">
              <strong>{item.price_cents == null ? "Preço pendente" : money(item.price_cents)}</strong>
              <div className="stepper" aria-label={`Quantidade de ${item.name}`}>
                <button type="button" onClick={() => changeQuantity(item.id, -1, item.remaining)} disabled={(quantities[item.id] || 0) === 0}>−</button>
                <span>{quantities[item.id] || 0}</span>
                <button type="button" onClick={() => changeQuantity(item.id, 1, item.remaining)} disabled={soldOut || (item.remaining != null && (quantities[item.id] || 0) >= item.remaining)}>+</button>
              </div>
            </div>}
            {production.mode === "SURVEY" && <button type="button" className="button button-secondary" onClick={() => { setSelectedSurvey(item.product_id); setError(""); setNotice(""); idempotencyKey.current = newKey(); }}>Tenho interesse</button>}
          </div>
        </article>;
      })}
    </div>

    {production.mode === "RESERVATION" && selectedItems.length > 0 && <form className="checkout-panel" onSubmit={reserve}>
      <div><span className="eyebrow">Seu pedido</span><h2>{selectedItems.length} {selectedItems.length === 1 ? "item" : "itens"}</h2><strong className="total">{money(total)}</strong></div>
      <ContactFields value={contact} onChange={setContact} />
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={pending}>{pending ? "Confirmando…" : "Confirmar pedido"}</button>
    </form>}

    {production.mode === "SURVEY" && selectedSurvey && <form className="checkout-panel" onSubmit={interest}>
      <div><span className="eyebrow">Sondagem</span><h2>Registrar interesse</h2><p>Isto não é uma reserva, não garante produção e não consome capacidade.</p></div>
      <ContactFields value={contact} onChange={setContact} />
      {error && <p className="alert alert-error" role="alert">{error}</p>}
      {notice && <p className="alert alert-success" role="status">{notice}</p>}
      <button className="button button-primary" disabled={pending}>{pending ? "Registrando…" : "Registrar interesse"}</button>
    </form>}
  </>;
}
