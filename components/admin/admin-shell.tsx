import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  return <div className="admin-shell">
    <header className="admin-header"><Link href="/admin" className="admin-brand"><span className="brand-mark">LA</span><span><strong>Ateliê</strong><small>painel da confeiteira</small></span></Link><form action={logoutAction}><button className="button button-ghost" type="submit">Sair</button></form></header>
    <nav className="admin-nav" aria-label="Administração"><Link href="/admin/producoes">Produções</Link><Link href="/admin/produtos">Produtos</Link></nav>
    <div className="admin-content"><p className="session-note">Sessão: {email}</p>{children}</div>
  </div>;
}
