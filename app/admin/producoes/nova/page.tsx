import { requireAdmin } from "@/lib/auth/admin";
import { listProducts } from "@/lib/supabase/admin-data";
import { AdminShell } from "@/components/admin/admin-shell";
import { ProductionForm } from "@/components/admin/production-form";

export const dynamic = "force-dynamic";
export default async function NewProduction({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireAdmin(); const products = await listProducts(session.accessToken); const query = await searchParams;
  return <AdminShell email={session.email}><div className="page-heading"><div><span className="eyebrow">Novo ciclo</span><h1>Nova produção</h1><p>Uma única superfície, do rascunho à publicação.</p></div></div>{query.error && <p className="alert alert-error">Revise os dados e selecione ao menos um item.</p>}<section className="editor-card open-card"><ProductionForm products={products} /></section></AdminShell>;
}
