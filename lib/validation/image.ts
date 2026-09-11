export async function validateProductImage(file: File): Promise<void> {
  if (file.type !== "image/webp" || !/\.webp$/i.test(file.name)) throw new Error("IMAGE_MUST_BE_WEBP");
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = new TextDecoder("ascii");
  if (bytes.length < 12 || text.decode(bytes.slice(0, 4)) !== "RIFF" || text.decode(bytes.slice(8, 12)) !== "WEBP") {
    throw new Error("INVALID_IMAGE");
  }
}
