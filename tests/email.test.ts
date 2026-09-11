import test from "node:test";
import assert from "node:assert/strict";
import { sendEmail } from "../lib/email/brevo.ts";

test("Brevo recebe a mesma chave nos retries e reconhece duplicata já aceita", async (t) => {
  const previous = process.env.BREVO_API_KEY;
  process.env.BREVO_API_KEY = "local-adapter-only";
  t.after(() => { if (previous === undefined) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = previous; });
  const keys: string[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    keys.push(body.headers.idempotencyKey);
    return keys.length === 1
      ? Response.json({ messageId: "test-message" }, { status: 201 })
      : Response.json({ code: "duplicate_parameter", message: "idempotencyKey already used" }, { status: 400 });
  });
  const message = { to: "test@example.test", subject: "Teste", html: "<p>Teste</p>", idempotencyKey: "12345678-1234-1234-1234-123456789abc" };
  assert.equal((await sendEmail(message)).status, "sent");
  assert.equal((await sendEmail(message)).status, "sent");
  assert.deepEqual(keys, [message.idempotencyKey, message.idempotencyKey]);
});

test("erro de autenticação do provedor não é tratado como envio aceito", async (t) => {
  const previous = process.env.BREVO_API_KEY;
  process.env.BREVO_API_KEY = "local-adapter-only";
  t.after(() => { if (previous === undefined) delete process.env.BREVO_API_KEY; else process.env.BREVO_API_KEY = previous; });
  t.mock.method(globalThis, "fetch", async () => Response.json({ code: "unauthorized" }, { status: 401 }));
  await assert.rejects(sendEmail({ to: "test@example.test", subject: "Teste", html: "Teste", idempotencyKey: "12345678-1234-1234-1234-123456789abc" }), /BREVO_401/);
});
