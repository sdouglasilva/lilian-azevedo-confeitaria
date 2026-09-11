"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOrderAction, withdrawIntentionAction } from "@/app/actions/public";

export function CancelOrderButton({ id, token }: { id: string; token: string }) {
  const [pending, startTransition] = useTransition(); const [error, setError] = useState(""); const router = useRouter();
  return <><button className="button button-danger" disabled={pending} onClick={() => startTransition(async () => { const result = await cancelOrderAction(id, token); if (!result.ok) setError(result.error || "Não foi possível cancelar."); else router.refresh(); })}>{pending ? "Cancelando…" : "Cancelar pedido"}</button>{error && <p className="alert alert-error">{error}</p>}</>;
}
export function WithdrawIntentionButton({ id, token }: { id: string; token: string }) {
  const [pending, startTransition] = useTransition(); const [error, setError] = useState(""); const router = useRouter();
  return <><button className="button button-danger" disabled={pending} onClick={() => startTransition(async () => { const result = await withdrawIntentionAction(id, token); if (!result.ok) setError(result.error || "Não foi possível retirar."); else router.refresh(); })}>{pending ? "Retirando…" : "Retirar meu interesse"}</button>{error && <p className="alert alert-error">{error}</p>}</>;
}
