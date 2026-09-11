import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { listProductions } from "@/lib/supabase/admin-data";
import { AdminShell } from "@/components/admin/admin-shell";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDateTime } from "@/lib/config/datetime";

export const dynamic = "force-dynamic";
export default async function AdminHome() {
  const session = await requireAdmin(); const productions = await listProductions(session.accessToken);
  return <AdminShell email={session.email}><div className="page-heading"><div><span className="eyebrow">Hoje no ateliê</span><h1>Produções</h1><p>Acompanhe demanda, pagamentos e o que realmente precisa ser produzido.</p></div><Link className="button button-primary" href="/admin/producoes/nova">Nova produção</Link></div>
    {productions.length === 0 ? <section className="state-card"><h2>Nenhuma produção criada</h2><p>Crie a primeira produção para começar.</p></section> : <div className="admin-list">{productions.slice(0, 5).map((production) => <Link className="admin-list-row" href={`/admin/producoes/${production.id}`} key={production.id}><div><strong>{production.public_slug}</strong><small>{production.mode === "SURVEY" ? "Sondagem" : "Reservas"} · {formatDateTime(production.fulfillment_at)}</small></div><StatusChip status={production.status} /></Link>)}</div>}
  </AdminShell>;
}
