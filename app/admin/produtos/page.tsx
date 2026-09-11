import { requireAdmin } from "@/lib/auth/admin";
import { listProducts } from "@/lib/supabase/admin-data";
import { publicImageUrl } from "@/lib/supabase/rest";
import { saveProductAction } from "@/app/actions/admin";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";
const reais = (cents: number | null) => cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const session = await requireAdmin(); const products = await listProducts(session.accessToken); const query = await searchParams;
  return <AdminShell email={session.email}><div className="page-heading"><div><span className="eyebrow">Catálogo mínimo</span><h1>Produtos</h1><p>Nome, descrição, preço-base, foto e disponibilidade.</p></div></div>
    {query.saved && <p className="alert alert-success">Produto salvo.</p>}{query.error && <p className="alert alert-error">Não foi possível salvar. Revise os dados e a imagem WebP.</p>}
    <details className="editor-card" open={products.length === 0}><summary>Novo produto</summary><ProductForm /></details>
    <div className="editor-stack">{products.map((product) => <details className="editor-card" key={product.id}><summary><span>{product.name}</span><small>{product.status === "ACTIVE" ? "Ativo" : "Inativo"}</small></summary><ProductForm product={product} imageUrl={publicImageUrl(product.image_path)} /></details>)}</div>
  </AdminShell>;
}

function ProductForm({ product, imageUrl }: { product?: Awaited<ReturnType<typeof listProducts>>[number]; imageUrl?: string | null }) {
  return <form action={saveProductAction} className="form-grid editor-form" encType="multipart/form-data">
    {product && <input type="hidden" name="id" value={product.id} />}{product?.image_path && <input type="hidden" name="image_path" value={product.image_path} />}
    {imageUrl && <div className="admin-thumb"><img src={imageUrl} alt={`Foto atual de ${product?.name}`} /></div>}
    <label>Nome<input name="name" required maxLength={120} defaultValue={product?.name || ""} /></label>
    <label>Descrição curta<textarea name="short_description" maxLength={600} rows={3} defaultValue={product?.short_description || ""} /></label>
    <label>Preço-base (R$)<input name="base_price" inputMode="decimal" placeholder="5,00" defaultValue={reais(product?.base_price_cents ?? null)} /></label>
    <label>Status<select name="status" defaultValue={product?.status || "ACTIVE"}><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select></label>
    <label>Foto WebP (máx. 5 MB)<input type="file" name="image" accept="image/webp,.webp" /></label>
    <button className="button button-primary" type="submit">{product ? "Salvar alterações" : "Criar produto"}</button>
  </form>;
}
