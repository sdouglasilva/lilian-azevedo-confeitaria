"use client";
import { useState } from "react";
export function CopyButton({ value }: { value: string }) {
  const [label, setLabel] = useState("Copiar chave");
  return <button className="button button-small" type="button" onClick={async () => { await navigator.clipboard.writeText(value); setLabel("Copiado"); setTimeout(() => setLabel("Copiar chave"), 1600); }}>{label}</button>;
}
