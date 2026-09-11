import test from "node:test";
import assert from "node:assert/strict";
import { canCustomerCancel, countsForProduction, occupiesCapacity } from "../domain/orders/rules.ts";
import { productionLabel } from "../domain/productions/rules.ts";

test("quanto produzir conta somente PAYMENT_CONFIRMED", () => {
  assert.equal(countsForProduction("PAYMENT_CONFIRMED"), true);
  for (const status of ["AWAITING_PAYMENT", "EXPIRED", "CANCELLED", "COMPLETED"] as const) assert.equal(countsForProduction(status), false);
});

test("capacidade é ocupada por pendente válido e confirmado", () => {
  const now = new Date("2026-09-05T20:00:00-03:00");
  assert.equal(occupiesCapacity("AWAITING_PAYMENT", new Date("2026-09-05T21:00:00-03:00"), now), true);
  assert.equal(occupiesCapacity("AWAITING_PAYMENT", new Date("2026-09-05T19:00:00-03:00"), now), false);
  assert.equal(occupiesCapacity("PAYMENT_CONFIRMED", new Date("2026-09-05T19:00:00-03:00"), now), true);
  assert.equal(occupiesCapacity("CANCELLED", new Date("2026-09-05T21:00:00-03:00"), now), false);
});

test("cliente só cancela pendente antes da expiração", () => {
  const now = new Date("2026-09-05T20:00:00-03:00");
  assert.equal(canCustomerCancel("AWAITING_PAYMENT", new Date("2026-09-05T20:01:00-03:00"), now), true);
  assert.equal(canCustomerCancel("AWAITING_PAYMENT", now, now), false);
  assert.equal(canCustomerCancel("PAYMENT_CONFIRMED", new Date("2026-09-05T21:00:00-03:00"), now), false);
});

test("linguagem da produção distingue modo e status", () => {
  assert.equal(productionLabel("SURVEY", "ACTIVE"), "Sondagem");
  assert.equal(productionLabel("RESERVATION", "ACTIVE"), "Reservas abertas");
  assert.equal(productionLabel("RESERVATION", "CANCELLED"), "Cancelada");
});
