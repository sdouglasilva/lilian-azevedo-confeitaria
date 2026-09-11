import test from "node:test";
import assert from "node:assert/strict";
import { paymentConfig } from "../lib/config/env.ts";

test("Pix ausente produz configuração pendente sem exceção", () => {
  const previous = { key: process.env.PIX_KEY, name: process.env.PIX_RECIPIENT_NAME, instructions: process.env.PAYMENT_INSTRUCTIONS };
  delete process.env.PIX_KEY; delete process.env.PIX_RECIPIENT_NAME; delete process.env.PAYMENT_INSTRUCTIONS;
  assert.deepEqual(paymentConfig(), { pixKey: "", recipientName: "", instructions: "" });
  if (previous.key !== undefined) process.env.PIX_KEY = previous.key;
  if (previous.name !== undefined) process.env.PIX_RECIPIENT_NAME = previous.name;
  if (previous.instructions !== undefined) process.env.PAYMENT_INSTRUCTIONS = previous.instructions;
});
