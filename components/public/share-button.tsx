"use client";
import { useState } from "react";

export function ShareButton() {
  const [label, setLabel] = useState("Compartilhar");
  async function share() {
    const data = { title: "LA Confeitaria Artesanal", text: "Olha esta produção da LA Confeitaria", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(window.location.href); setLabel("Link copiado"); setTimeout(() => setLabel("Compartilhar"), 1800); }
    } catch { /* cancelamento do share não exige feedback de erro */ }
  }
  return <button type="button" className="button button-ghost" onClick={share}>{label}</button>;
}
