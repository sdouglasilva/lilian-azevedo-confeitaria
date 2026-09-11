import { tableGet } from "@/lib/supabase/rest";

export type ProductRow = { id: string; name: string; short_description: string | null; image_path: string | null; base_price_cents: number | null; status: "ACTIVE" | "INACTIVE" };
export type ProductionRow = { id: string; public_slug: string; mode: "SURVEY" | "RESERVATION"; status: "DRAFT" | "ACTIVE" | "CLOSED" | "COMPLETED" | "CANCELLED"; fulfillment_at: string | null; order_cutoff_at: string | null; payment_window_minutes: number; reminder_before_minutes: number; created_at: string };
export type ProductionItemRow = { id: string; production_id: string; product_id: string; price_cents: number | null; capacity: number | null; offer_enabled: boolean };

export const listProducts = (token: string) => tableGet<ProductRow[]>("products?select=*&order=created_at.desc", token);
export const listProductions = (token: string) => tableGet<ProductionRow[]>("productions?select=*&order=created_at.desc", token);
export const getProduction = async (id: string, token: string) => (await tableGet<ProductionRow[]>(`productions?id=eq.${encodeURIComponent(id)}&select=*`, token))[0] || null;
export const listProductionItems = (id: string, token: string) => tableGet<ProductionItemRow[]>(`production_items?production_id=eq.${encodeURIComponent(id)}&select=*`, token);

export async function listOrders(productionId: string, token: string) {
  const query = `orders?production_id=eq.${encodeURIComponent(productionId)}&select=id,status,expires_at,payment_confirmed_at,created_at,customers(name,email,phone),order_items(quantity,unit_price_cents,production_items(product_id,products(name)))&order=created_at.desc`;
  return tableGet<Array<Record<string, unknown>>>(query, token);
}

export async function listIntentions(productionId: string, token: string) {
  const query = `intentions?source_production_id=eq.${encodeURIComponent(productionId)}&select=id,status,created_at,customers(name,email,phone),products(name)&order=created_at.desc`;
  return tableGet<Array<Record<string, unknown>>>(query, token);
}
