import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile(
  new URL("../db/migrations/20260910023442_la_pending_orders_cron.sql", import.meta.url),
  "utf8",
);
const sql = migration.replace(/--[^\n]*/g, "");
const extensionStatements = sql.match(/create\s+extension\b[^;]*;/gi) ?? [];
const schedulerSql = sql.replace(/create\s+extension\b[^;]*;/gi, "");

// Real PostgreSQL parses and executes the migration and the scheduled DO block.
// pg_cron, pg_net and Vault are external boundaries: use local contract fixtures
// for named-job upsert, decrypted values and captured requests, with no network.
// Extension loading and the real scheduler/HTTP transport belong to Gate 3.
let db: PGlite;
before(async () => {
  db = await PGlite.create();
  await db.exec(`
    create schema cron;
    create table cron.job (
      jobid bigint generated always as identity primary key,
      jobname text not null unique,
      schedule text not null,
      command text not null
    );
    create function cron.schedule(text, text, text) returns bigint language sql as $$
      insert into cron.job (jobname, schedule, command) values ($1, $2, $3)
      on conflict (jobname) do update
        set schedule = excluded.schedule, command = excluded.command
      returning jobid;
    $$;

    create schema vault;
    create table vault.decrypted_secrets (name text primary key, decrypted_secret text);

    create schema net;
    create table net.requests (
      id bigint generated always as identity primary key,
      url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer
    );
    create function net.http_post(
      url text,
      body jsonb default '{}'::jsonb,
      params jsonb default '{}'::jsonb,
      headers jsonb default '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds integer default 2000
    ) returns bigint language sql as $$
      insert into net.requests (url, body, params, headers, timeout_milliseconds)
      values ($1, $2, $3, $4, $5) returning id;
    $$;
  `);
});
beforeEach(async () => {
  await db.exec("truncate cron.job, vault.decrypted_secrets, net.requests restart identity;");
});
after(async () => { await db?.close(); });

type Job = { jobid: number; jobname: string; schedule: string; command: string };
type Request = { url: string; headers: Record<string, string>; body: unknown; timeout_milliseconds: number };

async function savedJob(): Promise<Job> {
  const { rows } = await db.query<Job>("select * from cron.job where jobname = 'la-process-pending-orders'");
  assert.equal(rows.length, 1);
  return rows[0];
}

async function configureVault(url: string | null, secret: string | null) {
  await db.query(
    `insert into vault.decrypted_secrets (name, decrypted_secret)
       values ('app_public_url', $1), ('cron_secret', $2)
       on conflict (name) do update set decrypted_secret = excluded.decrypted_secret`,
    [url, secret],
  );
}

test("cron habilita as duas extensões com IF NOT EXISTS e preserva objetos existentes", () => {
  assert.equal(extensionStatements.length, 2);
  assert.match(extensionStatements[0], /create\s+extension\s+if\s+not\s+exists\s+pg_cron\s+with\s+schema\s+pg_catalog\s*;/i);
  assert.match(extensionStatements[1], /create\s+extension\s+if\s+not\s+exists\s+pg_net\s*;/i);
  assert.doesNotMatch(sql, /\b(drop|truncate|grant|revoke)\b|create\s+(or\s+replace\s+)?(function|procedure)/i);
});

test("reaplicar migration mantém um único job de dez minutos e preserva outros jobs", async () => {
  await db.exec("select cron.schedule('unrelated-job', '0 1 * * *', 'select 1');");
  await db.exec(schedulerSql);
  const initial = await savedJob();
  await db.exec(schedulerSql);
  await db.exec(schedulerSql);
  const repeated = await savedJob();
  assert.equal(repeated.jobid, initial.jobid);
  assert.equal(repeated.schedule, "*/10 * * * *");
  assert.equal(repeated.command, initial.command);
  const { rows } = await db.query("select jobname, schedule from cron.job order by jobname");
  assert.deepEqual(rows, [
    { jobname: "la-process-pending-orders", schedule: "*/10 * * * *" },
    { jobname: "unrelated-job", schedule: "0 1 * * *" },
  ]);
});

test("migration agenda sem exigir Vault preenchido e não dispara HTTP durante a aplicação", async () => {
  await db.exec(schedulerSql);
  await savedJob();
  assert.equal((await db.query("select * from net.requests")).rows.length, 0);
  assert.equal((await db.query("select * from vault.decrypted_secrets")).rows.length, 0);
});

test("job monta URL normalizada, Bearer do Vault e corpo JSON compatíveis com o endpoint", async () => {
  const secret = "a".repeat(32);
  await configureVault("  https://example.test/base///  ", secret);
  await db.exec(schedulerSql);
  const job = await savedJob();
  assert.ok(!job.command.includes(secret), "o segredo não pode ser gravado no comando do cron");
  await db.exec(job.command);
  const { rows } = await db.query<Request>("select url, headers, body, timeout_milliseconds from net.requests");
  assert.deepEqual(rows, [{
    url: "https://example.test/base/api/internal/process-pending-orders",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: {},
    timeout_milliseconds: 60000,
  }]);
  const route = await readFile(new URL("../app/api/internal/process-pending-orders/route.ts", import.meta.url), "utf8");
  assert.match(route, /export\s+async\s+function\s+POST\(/);
  assert.ok(route.includes('auth.startsWith("Bearer ")'));
});

test("rotação de URL e segredo no Vault afeta a próxima execução sem reagendar", async () => {
  await configureVault("https://first.example.test", "a".repeat(32));
  await db.exec(schedulerSql);
  const job = await savedJob();
  await db.exec(job.command);
  await configureVault("https://second.example.test/", "b".repeat(48));
  await db.exec(job.command);
  const { rows } = await db.query<Request>("select url, headers from net.requests order by id");
  assert.deepEqual(rows.map((row) => [row.url, row.headers.Authorization]), [
    ["https://first.example.test/api/internal/process-pending-orders", `Bearer ${"a".repeat(32)}`],
    ["https://second.example.test/api/internal/process-pending-orders", `Bearer ${"b".repeat(48)}`],
  ]);
  assert.deepEqual(await savedJob(), job);
});

test("Vault ausente, vazio ou com segredo curto falha sem enviar HTTP nem expor valores", async () => {
  await db.exec(schedulerSql);
  const job = await savedJob();
  const configurations: [string | null, string | null][] = [
    [null, null], [null, "a".repeat(32)], ["", "a".repeat(32)], ["   ", "a".repeat(32)],
    ["https://example.test", null], ["https://example.test", ""], ["https://example.test", "a".repeat(31)],
  ];
  // Also cover both Vault rows being absent, not just null-valued rows.
  await assert.rejects(db.exec(job.command), { message: "LA_CRON_VAULT_CONFIGURATION_MISSING" });
  for (const [url, secret] of configurations) {
    await configureVault(url, secret);
    await assert.rejects(db.exec(job.command), { message: "LA_CRON_VAULT_CONFIGURATION_MISSING" });
  }
  assert.equal((await db.query("select * from net.requests")).rows.length, 0);
});
