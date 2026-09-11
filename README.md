# LA Confeitaria Artesanal — MVP

Aplicação Next.js + TypeScript, full-stack e mobile-first para Produções em modo **Sondagem** ou **Reservas**, usando o Supabase já existente como backend de domínio.

## Desenvolvimento

1. Copie `.env.example` para `.env.local` e preencha apenas as credenciais do ambiente.
2. `npm install`
3. `npm run dev`

Qualidade antes de qualquer deploy: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

A migration `db/migrations/20260905215924_la_mvp_schema.sql` é histórica e já foi aplicada no projeto Supabase existente. **Não a reexecute para “sincronizar” o banco.** Mudanças futuras devem entrar em novas migrations.

## Segurança

Clientes não possuem conta. Pedidos e intenções usam links seguros com token opaco; somente o hash é enviado ao banco. `CRON_SECRET` e `BREVO_API_KEY` são usados exclusivamente no servidor. Admin usa Supabase Auth + `ADMIN_EMAILS` no servidor e não possui signup público.

O Pix é configuração de ambiente. Sem `PIX_KEY`, a interface mostra explicitamente “configuração pendente” e continua buildável.
