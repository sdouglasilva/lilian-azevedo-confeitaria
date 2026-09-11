import { requireSupabaseConfig } from "@/lib/config/env";
import { newUuid } from "@/lib/security/crypto";
import { validateProductImage } from "@/lib/validation/image";

export async function uploadProductImage(productId: string, file: File, accessToken: string): Promise<string> {
  await validateProductImage(file);
  const path = `products/${productId}/${newUuid()}.webp`;
  const config = requireSupabaseConfig();
  const response = await fetch(`${config.supabaseUrl}/storage/v1/object/product-images/${path}`, {
    method: "POST",
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${accessToken}`,
      "content-type": "image/webp",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!response.ok) throw new Error("IMAGE_UPLOAD_FAILED");
  return path;
}
