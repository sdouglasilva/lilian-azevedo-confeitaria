import { rpc, publicImageUrl } from "@/lib/supabase/rest";

export type PublicProductionItem = { id: string; product_id: string; name: string; short_description?: string | null; image_path?: string | null; price_cents?: number | null; remaining?: number | null; image_url?: string | null };
export type PublicProduction = { id: string; public_slug: string; mode: "SURVEY" | "RESERVATION"; status: "ACTIVE" | "CLOSED" | "COMPLETED" | "CANCELLED"; fulfillment_at?: string | null; order_cutoff_at?: string | null; accepting: boolean; items: PublicProductionItem[] };

export async function getPublicProduction(slug: string): Promise<PublicProduction | null> {
  const data = await rpc<PublicProduction | null>("la_public_production", { p_slug: slug });
  if (!data) return null;
  return { ...data, items: (data.items || []).map((item) => ({ ...item, image_url: publicImageUrl(item.image_path) })) };
}
