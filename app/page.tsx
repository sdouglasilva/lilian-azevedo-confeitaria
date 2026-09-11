import Link from "next/link";
export default function Home() {
  return <main className="narrow-shell"><section className="state-card home-card"><span className="brand-mark large">LA</span><h1>Lilian Azevedo</h1><p>Confeitaria Artesanal</p><p className="muted">Acesse uma produção pelo link compartilhado pela confeiteira.</p><Link className="button button-ghost" href="/admin">Área da confeiteira</Link></section></main>;
}
