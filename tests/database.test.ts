import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Local PostgreSQL with only the Supabase platform schemas supplied by the fixture.
// Application tables, policies and RPCs are loaded unchanged from the real migration.
const db = new PGlite({ extensions: { pgcrypto } });
const secret = "local-test-only-".repeat(4);
const tokenHash = "a".repeat(64);
const adminId = randomUUID();
before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema extensions; create schema auth; create schema vault; create schema storage;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table vault.decrypted_secrets(name text, decrypted_secret text);
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid, bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated;
  `);
  await db.query("insert into auth.users values($1,'douglas.ernesto.silva@gmail.com',now())", [adminId]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [adminId]);
  await db.query("insert into vault.decrypted_secrets values('cron_secret',$1)", [secret]);
  await db.exec(await readFile(new URL("../db/migrations/20260905215924_la_mvp_schema.sql", import.meta.url), "utf8"));
});
after(() => db.close());

async function rpc<T = Record<string, unknown>>(name: string, values: unknown[]): Promise<T> {
  const result = await db.query<{ value: T }>(`select public.${name}(${values.map((_, i) => `$${i + 1}`).join(",")}) as value`, values);
  return result.rows[0].value;
}
async function production(mode = "RESERVATION", capacity = 5) {
  const products = await Promise.all([1000, 1500].map((price) => rpc<string>("la_save_product", [null, { name: "Doce de teste", base_price_cents: price, status: "ACTIVE" }])));
  const id = await rpc<string>("la_save_production", [null, {
    public_slug: `teste-${randomUUID()}`, mode, order_cutoff_at: new Date(Date.now() + 86400000).toISOString(),
    fulfillment_at: new Date(Date.now() + 172800000).toISOString(), payment_window_minutes: 360, reminder_before_minutes: 120,
  }, products.map((product_id) => ({ product_id, capacity, offer_enabled: true }))]);
  await rpc("la_transition_production", [id, "ACTIVE"]);
  const { rows: items } = await db.query<{ id: string; product_id: string }>("select id,product_id from production_items where production_id=$1 order by product_id", [id]);
  return { id, items, products };
}
function order(p: Awaited<ReturnType<typeof production>>, quantity = 1, key = randomUUID()) {
  return rpc<{ id: string; reused: boolean }>("la_create_order", [secret, randomUUID(), key, "b".repeat(64), tokenHash, p.id,
    { name: "Cliente Teste", email: `${key}@example.test`, phone: "31999999999" }, p.items.map(({ id }) => ({ id, quantity }))]);
}

test("pedido multitem: retry, preço histórico, pagamento idempotente e conclusão", async () => {
  const p = await production();
  const key = randomUUID();
  const created = await order(p, 2, key);
  assert.equal((await order(p, 2, key)).id, created.id);
  const pending = await rpc("la_get_order", [secret, created.id, tokenHash]);
  assert.equal(pending.status, "AWAITING_PAYMENT");
  assert.equal(pending.total_cents, 5000);
  await db.query("update products set base_price_cents=9000 where id=any($1::uuid[])", [p.products]);
  assert.equal((await rpc("la_get_order", [secret, created.id, tokenHash])).total_cents, 5000);
  const confirmed = await rpc("la_transition_order", [created.id, "PAYMENT_CONFIRMED"]);
  assert.deepEqual(await rpc("la_transition_order", [created.id, "PAYMENT_CONFIRMED"]), confirmed);
  await assert.rejects(rpc("la_cancel_order", [secret, created.id, tokenHash]), /CANCELLATION_UNAVAILABLE/);
  assert.equal((await rpc("la_transition_order", [created.id, "COMPLETED"])).status, "COMPLETED");
  await assert.rejects(rpc("la_transition_order", [created.id, "PAYMENT_CONFIRMED"]), /INVALID_TRANSITION/);
});

test("reservas disputando a última capacidade: somente uma é aceita e cancelamento libera", async () => {
  const p = await production("RESERVATION", 1);
  // PGlite serializes connections; this checks transaction outcomes, not multi-session lock contention.
  const attempts = await Promise.allSettled([order(p), order(p)]);
  assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 1);
  const winner = attempts.find((r) => r.status === "fulfilled");
  assert.ok(winner?.status === "fulfilled");
  await rpc("la_cancel_order", [secret, winner.value.id, tokenHash]);
  await order(p);
});

test("expiração é idempotente, libera capacidade e tokens inválidos não revelam dados", async () => {
  const p = await production("RESERVATION", 1);
  const created = await order(p);
  assert.equal(await rpc("la_get_order", [secret, created.id, "c".repeat(64)]), null);
  await assert.rejects(rpc("la_get_order", ["wrong", created.id, tokenHash]), /FORBIDDEN/);
  await db.query("update orders set expires_at=now()-interval '1 minute' where id=$1", [created.id]);
  const expired = await rpc<{ expired: string[] }>("la_process_pending", [secret]);
  assert.ok(expired.expired.includes(created.id));
  assert.equal((await rpc<{ expired: string[] }>("la_process_pending", [secret])).expired.length, 0);
  await order(p);
});

test("sondagem registra e retira intenção sem reservar nem criar pedido", async () => {
  const p = await production("SURVEY");
  await assert.rejects(order(p), /PRODUCTION_UNAVAILABLE/);
  const id = randomUUID();
  const contact = { name: "Interesse Teste", email: `${id}@example.test`, phone: "31988888888" };
  await rpc("la_create_intention", [secret, id, randomUUID(), "d".repeat(64), tokenHash, p.id, p.products[0], contact]);
  assert.equal(await rpc("la_get_intention", [secret, id, "c".repeat(64), false]), null);
  assert.equal((await rpc("la_get_intention", [secret, id, tokenHash, true])).status, "WITHDRAWN");
  assert.equal((await db.query<{ count: number }>("select count(*)::int as count from orders where production_id=$1", [p.id])).rows[0].count, 0);
});

test("produção fechada não recebe pedidos; cancelar preserva concluídos", async () => {
  const p = await production();
  const pending = await order(p);
  const done = await order(p);
  await rpc("la_transition_order", [done.id, "PAYMENT_CONFIRMED"]);
  await rpc("la_transition_order", [done.id, "COMPLETED"]);
  await rpc("la_transition_production", [p.id, "CANCELLED"]);
  assert.equal((await rpc("la_get_order", [secret, pending.id, tokenHash])).status, "CANCELLED");
  assert.equal((await rpc("la_get_order", [secret, done.id, tokenHash])).status, "COMPLETED");
  await assert.rejects(order(p), /PRODUCTION_UNAVAILABLE/);
});

test("recibo de e-mail impede envio duplicado e só marca lembrete após aceite", async () => {
  const p = await production();
  const created = await order(p);
  const claim = await rpc<{ key: string }>("la_claim_email", [secret, created.id, "reminder"]);
  assert.ok(claim.key);
  assert.equal(await rpc("la_claim_email", [secret, created.id, "reminder"]), null);
  assert.equal((await db.query<{ reminder_sent_at: unknown }>("select reminder_sent_at from orders where id=$1", [created.id])).rows[0].reminder_sent_at, null);
  await rpc("la_finish_email", [secret, created.id, "reminder", claim.key, "SENT", "local-adapter", null]);
  assert.equal(await rpc("la_claim_email", [secret, created.id, "reminder"]), null);
  assert.ok((await db.query<{ reminder_sent_at: unknown }>("select reminder_sent_at from orders where id=$1", [created.id])).rows[0].reminder_sent_at);
});

test("RPCs administrativas e tabelas de clientes são protegidas por autorização/RLS", async () => {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [randomUUID()]);
  try {
    await assert.rejects(rpc("la_save_product", [null, { name: "Não autorizado" }]), /FORBIDDEN/);
    await db.exec("set role authenticated");
    assert.equal((await db.query("select * from customers")).rows.length, 0);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from orders"), /permission denied/);
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [adminId]);
  }
});
