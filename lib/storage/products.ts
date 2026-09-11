import { requireSupabaseConfig } from "@/lib/config/env";
import { newUuid } from "@/lib/security/crypto";

export async function uploadProductImage(productId: string, file: File, accessToken: string): Promise<string> {
  if (file.type !== "image/webp") throw new Error("IMAGE_MUST_BE_WEBP");
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
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
