import Link from "next/link";
import { getIntention } from "@/domain/intentions/service";
import { StatusChip } from "@/components/ui/status-chip";
import { WithdrawIntentionButton } from "@/components/public/secure-actions";
import { formatDateTime } from "@/lib/config/datetime";
import { allowRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export default async function IntentionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params; const { token = "" } = await searchParams;
  const rateAllowed = token ? await allowRequest("read-intention", 60, 60) : false;
  const intention = rateAllowed ? await getIntention(id, token) : null;
  if (!intention) return <main className="narrow-shell"><section className="state-card"><span className="eyebrow">Link seguro</span><h1>Interesse não encontrado</h1><p>O link pode estar incompleto ou inválido.</p></section></main>;
  const status = String(intention.status);
  return <main className="narrow-shell">
    {intention.public_slug ? <Link className="brand-link" href={`/p/${intention.public_slug}`}>LA Confeitaria Artesanal</Link> : <span className="brand-link">LA Confeitaria Artesanal</span>}
    <section className="secure-card">
      <div className="secure-heading"><div><span className="eyebrow">Sondagem</span><h1>{String(intention.name)}</h1></div><StatusChip status={status} /></div>
      <p>Seu interesse ajuda a confeiteira a decidir o que produzir. Ele não é reserva e não garante disponibilidade.</p>
      <p className="muted">Registrado em {formatDateTime(String(intention.created_at || ""))}</p>
      {status === "ACTIVE" && <div className="danger-zone"><p>Não quer mais sinalizar interesse?</p><WithdrawIntentionButton id={id} token={token} /></div>}
      {status === "WITHDRAWN" && <p className="alert alert-neutral">Interesse retirado.</p>}
    </section>
  </main>;
}
