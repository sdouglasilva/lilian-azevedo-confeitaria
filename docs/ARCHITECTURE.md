# Arquitetura

Monólito Next.js App Router. UI pública e admin usam Server Actions/Route Handlers. Regras transacionais de capacidade, idempotência e transição permanecem nas RPCs PostgreSQL já aplicadas. O browser nunca recebe `CRON_SECRET` ou `BREVO_API_KEY`.

- Público: `/p/[slug]`, `/pedido/[id]?token=...`, `/interesse/[id]?token=...`.
- Admin: Supabase Auth por e-mail/senha, cookie HttpOnly, validação de `ADMIN_EMAILS` e RLS/RPC admin.
- E-mail: Brevo após commit do domínio; recibo idempotente via `la_claim_email`/`la_finish_email`.
- Cron futuro: `POST /api/internal/process-pending-orders`, protegido por `CRON_SECRET`, chama `la_process_pending`.
