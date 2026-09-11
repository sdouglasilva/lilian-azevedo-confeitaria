"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { rpc } from "@/lib/supabase/rest";
import { uploadProductImage } from "@/lib/storage/products";
import { sendEntityEmail } from "@/lib/email/transactional";
import { zonedLocalToIso } from "@/lib/config/datetime";
import { validateProductImage } from "@/lib/validation/image";

const cents = (value: FormDataEntryValue | null): number | null => {
  const text = String(value || "").trim().replace(",", ".");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
};
const positive = (value: FormDataEntryValue | null): number | null => {
  const text = String(value || "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function saveProductAction(formData: FormData) {
  const session = await requireAdmin();
  const existingId = String(formData.get("id") || "") || null;
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Informe o nome do produto." };
  const currentImage = String(formData.get("image_path") || "") || null;
  let id: string | undefined;
  try {
    const file = formData.get("image");
    if (file instanceof File && file.size > 0) await validateProductImage(file);
    id = await rpc<string>("la_save_product", {
      p_id: existingId,
      p_data: {
        name,
        short_description: String(formData.get("short_description") || "").trim() || null,
        base_price_cents: cents(formData.get("base_price")),
        status: String(formData.get("status") || "ACTIVE"),
        image_path: currentImage,
      },
    }, { accessToken: session.accessToken });
    if (file instanceof File && file.size > 0) {
      const imagePath = await uploadProductImage(id, file, session.accessToken);
      await rpc("la_save_product", {
        p_id: id,
        p_data: {
          name,
          short_description: String(formData.get("short_description") || "").trim() || null,
          base_price_cents: cents(formData.get("base_price")),
          status: String(formData.get("status") || "ACTIVE"),
          image_path: imagePath,
        },
      }, { accessToken: session.accessToken });
    }
  } catch {
    return { id, error: id ? "Produto salvo, mas a foto não foi concluída. Tente salvar novamente para reenviar a imagem." : "Não foi possível concluir. Revise os dados e use uma imagem WebP válida de até 5 MB." };
  }
  revalidatePath("/admin/produtos");
  redirect("/admin/produtos?saved=1");
}

export async function saveProductionAction(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") || "") || null;
  const selected = formData.getAll("product_id").map(String);
  if (!selected.length) return { error: "Selecione ao menos um produto." };
  const items = selected.map((productId) => ({
    product_id: productId,
    price_cents: cents(formData.get(`price_${productId}`)),
    capacity: positive(formData.get(`capacity_${productId}`)),
    offer_enabled: true,
  }));
  try {
    const savedId = await rpc<string>("la_save_production", {
      p_id: id,
      p_data: {
        public_slug: String(formData.get("public_slug") || "").trim().toLowerCase(),
        mode: String(formData.get("mode") || "RESERVATION"),
        fulfillment_at: zonedLocalToIso(String(formData.get("fulfillment_at") || "")),
        order_cutoff_at: zonedLocalToIso(String(formData.get("order_cutoff_at") || "")),
        payment_window_minutes: positive(formData.get("payment_window_minutes")) || 360,
        reminder_before_minutes: Number(String(formData.get("reminder_before_minutes") || "120")),
      },
      p_items: items,
    }, { accessToken: session.accessToken });
    revalidatePath("/admin/producoes");
    redirect(`/admin/producoes/${savedId}?saved=1`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: "Não foi possível salvar. Revise datas, preços e capacidades. Seus dados foram mantidos." };
  }
}

export async function transitionProductionAction(id: string, status: "ACTIVE" | "CLOSED" | "CANCELLED" | "COMPLETED") {
  const session = await requireAdmin();
  try {
    const result = await rpc<{ cancelled_orders?: string[] }>("la_transition_production", { p_id: id, p_status: status }, { accessToken: session.accessToken });
    if (status === "CANCELLED") await Promise.allSettled((result.cancelled_orders || []).map((orderId) => sendEntityEmail(orderId, "closed")));
  } catch {
    redirect(`/admin/producoes/${id}?error=transition`);
  }
  revalidatePath(`/admin/producoes/${id}`);
  revalidatePath("/admin/producoes");
  redirect(`/admin/producoes/${id}?updated=1`);
}

export async function transitionOrderAction(productionId: string, orderId: string, status: "PAYMENT_CONFIRMED" | "CANCELLED" | "COMPLETED") {
  const session = await requireAdmin();
  try {
    await rpc("la_transition_order", { p_id: orderId, p_status: status }, { accessToken: session.accessToken });
    if (status === "PAYMENT_CONFIRMED") await sendEntityEmail(orderId, "confirmed").catch(() => "failed");
    if (status === "CANCELLED") await sendEntityEmail(orderId, "closed").catch(() => "failed");
  } catch {
    redirect(`/admin/producoes/${productionId}?error=order`);
  }
  revalidatePath(`/admin/producoes/${productionId}`);
  redirect(`/admin/producoes/${productionId}?updated=1`);
}
