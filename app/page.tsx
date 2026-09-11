import Link from "next/link";
export default function Home() {
  return <main className="home-shell"><section className="home-story"><div className="home-brand"><span className="brand-mark large">LA</span><span className="eyebrow">Confeitaria artesanal</span><h1>Lilian<br />Azevedo</h1><p>Doces que tornam dias comuns mais doces.</p></div><div className="home-photo"><img src="/assets/brigadeiro-tradicional.png" alt="Brigadeiro artesanal da LA" /></div><div className="home-note"><strong>Produções em pequenas levas</strong><p>Abra o link enviado pela Lilian para escolher os doces da fornada.</p><Link className="button button-ghost" href="/admin">Área da confeiteira</Link></div></section></main>;
}
