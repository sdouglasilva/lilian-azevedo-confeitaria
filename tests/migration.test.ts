import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const EXPECTED = "120a7d29dfb00bb194ff6b2fe7b29dde26db567ba575cc981d23553b83a963b3";
test("migration histórica permanece byte a byte intacta", async () => {
  const data = await readFile(new URL("../db/migrations/20260905215924_la_mvp_schema.sql", import.meta.url));
  assert.equal(createHash("sha256").update(data).digest("hex"), EXPECTED);
});
