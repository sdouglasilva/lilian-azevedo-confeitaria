import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    if (["node_modules", ".git", ".next", ".netlify"].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  }));
  return nested.flat();
}

test("nenhum client component referencia segredos server-side", async () => {
  const files = (await filesUnder(process.cwd())).filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes("node_modules") && !file.includes("tests"));
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (!source.startsWith('"use client"')) continue;
    for (const secret of ["CRON_SECRET", "BREVO_API_KEY", "ADMIN_EMAILS", "serverSecret("]) assert.equal(source.includes(secret), false, `${path.relative(process.cwd(), file)} contém ${secret}`);
  }
});

test("rotas admin, exceto login, exigem requireAdmin", async () => {
  const protectedPages = ["app/admin/page.tsx", "app/admin/produtos/page.tsx", "app/admin/producoes/page.tsx", "app/admin/producoes/nova/page.tsx", "app/admin/producoes/[id]/page.tsx"];
  for (const page of protectedPages) assert.match(await readFile(page, "utf8"), /requireAdmin\(/, page);
});

test("não existe variável pública para cron ou Brevo", async () => {
  const files = (await filesUnder(process.cwd())).filter((file) => !file.includes(".git") && !file.includes("node_modules"));
  for (const file of files) {
    const source = await readFile(file, "utf8").catch(() => "");
    assert.equal(/NEXT_PUBLIC_(CRON|BREVO|ADMIN)/.test(source), false, path.relative(process.cwd(), file));
  }
});

test("links seguros são derivados no servidor e o token bruto não é persistido", async () => {
  const orderService = await readFile("domain/orders/service.ts", "utf8");
  const intentionService = await readFile("domain/intentions/service.ts", "utf8");
  for (const source of [orderService, intentionService]) {
    assert.match(source, /p_token_hash:\s*sha256\(token\)/);
    assert.equal(source.includes("access_token:"), false);
  }
});

test("rota interna exige CRON_SECRET antes de processar pendências", async () => {
  const source = await readFile("app/api/internal/process-pending-orders/route.ts", "utf8");
  assert.match(source, /serverSecret\(\)/);
  assert.match(source, /status:\s*403/);
  assert.match(source, /la_process_pending/);
});
