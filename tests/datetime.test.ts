import test from "node:test";
import assert from "node:assert/strict";
import { isoToLocalInput, zonedLocalToIso } from "../lib/config/datetime.ts";

test("horário local de São Paulo converte explicitamente para UTC", () => {
  assert.equal(zonedLocalToIso("2026-09-05T20:30", "America/Sao_Paulo"), "2026-09-05T23:30:00.000Z");
});

test("timestamp UTC volta ao campo local esperado em São Paulo", () => {
  assert.equal(isoToLocalInput("2026-09-05T23:30:00.000Z", "America/Sao_Paulo"), "2026-09-05T20:30");
});
