import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { getAdminSession } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";
export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdminSession()) redirect("/admin");
  const { error } = await searchParams;
  return <main className="login-shell"><section className="login-card"><span className="brand-mark large">LA</span><span className="eyebrow">Área da confeiteira</span><h1>Entrar</h1><p>Use o e-mail e a senha cadastrados no Supabase Auth.</p>{error && <p className="alert alert-error">E-mail, senha ou permissão inválidos.</p>}<form action={loginAction} className="form-grid"><label>E-mail<input type="email" name="email" autoComplete="username" required /></label><label>Senha<input type="password" name="password" autoComplete="current-password" required /></label><button className="button button-primary" type="submit">Entrar</button></form><p className="privacy-note">Não existe cadastro público de administrador.</p></section></main>;
}
