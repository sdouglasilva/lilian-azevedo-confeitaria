import test from "node:test";
import assert from "node:assert/strict";
import { validateProductImage } from "../lib/validation/image.ts";

test("upload valida extensão, MIME, assinatura e tamanho antes de salvar produto", async () => {
  const webp = Uint8Array.from([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
  await validateProductImage(new File([webp], "doce.webp", { type: "image/webp" }));
  for (const file of [
    new File([webp], "doce.png", { type: "image/webp" }),
    new File([webp], "doce.webp", { type: "image/png" }),
    new File(["not an image"], "doce.webp", { type: "image/webp" }),
    new File([new Uint8Array(5 * 1024 * 1024 + 1)], "doce.webp", { type: "image/webp" }),
  ]) await assert.rejects(validateProductImage(file));
});
