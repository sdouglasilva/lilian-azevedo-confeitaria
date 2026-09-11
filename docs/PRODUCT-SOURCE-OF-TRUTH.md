---
artifact_id: LA-CONFEITARIA-DELIVERY-PACK
status: CANONICAL
canonical_filename: LA-CONFEITARIA-DELIVERY-PACK-CANONICAL.md
canonical_library_file_id: libfile_74c105f62d608191ad42a520520a3937
canonical_revision: 2026-09-05.1
handoff_rule: use this exact canonical artifact; never select a parenthesized duplicate or older pack
---

# DELIVERY-PACK-v1

## Restrição financeira absoluta

**Custo operacional obrigatório do MVP: R$ 0.** Nenhum serviço pode exigir mensalidade, compra de créditos, domínio pago, cartão obrigatório, overage ou auto-recharge. Se um recurso não couber em free tier com hard limit, ele fica fora do MVP até nova decisão explícita.


**Produto:** Lilian Azevedo Confeitaria Artesanal / LA Confeitaria Artesanal  
**Objetivo:** especificação única e executável para implementação do MVP por coding agent.  
**Status:** consolidado após auditoria de `PRODUCT-CORE-PACK-v1.md`, `UX-PACK-v1.md`, `VISUAL-PACK-v1.md` e `TECH-PACK-v1.md`.

---

## 0. Regra de autoridade

Este arquivo é a fonte de verdade para a implementação do MVP.

Se algum pack anterior divergir deste arquivo, **este arquivo prevalece para o corte de implementação**.

Questões abertas não viram feature por antecipação. Não criar tabelas, endpoints, telas, componentes, jobs ou infraestrutura para funcionalidades não incluídas explicitamente neste pack.

---

## 1. Tese e escopo do MVP

O produto resolve um problema simples: sincronizar **desejo → pedido → pagamento confirmado → produção → retirada**.

A confeiteira abre uma **Produção** com um ou mais doces. Clientes acessam um link, escolhem itens, fazem um pedido e recebem instruções para pagamento via Pix fora do sistema. A confeiteira confirma manualmente o pagamento. Somente pedidos pagos entram em **quanto produzir**.

O MVP também suporta **Sondagem**: em vez de pedido, clientes podem registrar interesse em produtos para ajudar a confeiteira a decidir o que produzir.

Não é marketplace, ERP, rede social, app de delivery ou checkout.

### Fora do MVP

Não implementar:

- gateway de pagamento;
- cartão, boleto ou wallet;
- conta/senha de cliente;
- perfil social;
- foto de cliente;
- comentário;
- reação;
- votação;
- recompensa/gamificação;
- feed;
- seguidores;
- chat;
- push notification;
- programa de fidelidade;
- estoque de ingredientes;
- ficha técnica;
- fiscal/contabilidade;
- logística/roteirização;
- prova social visível;
- campanhas de marketing;
- reativação automática de interessados.

---

## 2. Decisões de implementação congeladas

Estas decisões fecham as ambiguidades que poderiam fazer o coding agent parar ou inventar comportamento.

### 2.1 Pedido com múltiplos itens

**Decisão:** um pedido pode conter um ou vários itens da mesma Produção.

UX:

- seleção inline nos cards;
- um único resumo;
- uma única confirmação;
- não usar metáfora de carrinho;
- não criar página de carrinho.

### 2.2 Capacidade

**Decisão:** capacidade por Item da Produção é **opcional**.

- `capacity = null` significa sem limite explícito.
- Se houver capacidade, pedidos `AWAITING_PAYMENT` e `PAYMENT_CONFIRMED` ocupam capacidade.
- `EXPIRED` e `CANCELLED` não ocupam.
- Nunca armazenar “quantidade restante” como fonte de verdade; derivar da soma dos pedidos elegíveis.

### 2.3 Janela de pagamento

**Decisão para o primeiro corte:**

- padrão: **6 horas**;
- configurável por Produção;
- um único lembrete, padrão **2 horas antes da expiração**;
- se houver `order_cutoff_at`, `expires_at = min(created_at + payment_window, order_cutoff_at)`;
- se não houver tempo útil para lembrete, não enviar lembrete.

Esses valores devem ser configuração, não constantes espalhadas pelo código.

### 2.4 Cancelamento

**Cliente:** pode cancelar pelo link seguro apenas enquanto `AWAITING_PAYMENT` e antes de expirar.

**Depois de pagamento confirmado:** não há cancelamento self-service. A confeiteira pode cancelar manualmente; eventual devolução de dinheiro ocorre fora do sistema.

`COMPLETED` é final.

### 2.5 Intenção

No MVP, Intenção é usada principalmente em Produção de modo **SURVEY**.

- cliente registra interesse por Produto;
- fornece nome + telefone + e-mail;
- recebe link seguro para consultar/retirar a intenção;
- Intenção **não é convertida automaticamente** ao fazer ou pagar pedido;
- reativação futura não é implementada agora.

### 2.6 “Minhas ações”

**Não criar área de cliente.**

Pedidos e Intenções são acessados por links seguros enviados por e-mail.

### 2.7 Compartilhamento

Implementar compartilhamento da Produção via Web Share API quando disponível, com fallback de copiar link. Sem métricas públicas de compartilhamento.

### 2.8 Pagamento

O sistema não movimenta dinheiro.

Instruções de Pix vêm de configuração de ambiente:

- `PIX_KEY`
- `PIX_RECIPIENT_NAME`
- `PAYMENT_INSTRUCTIONS` opcional

**Decisão de MVP:** mostrar a chave Pix em texto + ação **Copiar chave**. QR Code não é requisito do primeiro corte e não deve gerar biblioteca, tela, endpoint ou regra própria. Pode ser decidido depois sem alterar o fluxo de pedido.

Durante desenvolvimento/teste, a ausência de `PIX_KEY` não bloqueia build nem E2E técnico; a interface deve indicar configuração pendente sem inventar uma chave. Antes de abrir para clientes reais, a chave válida deve estar configurada.

A confirmação é manual pela confeiteira.

---

## 3. Modelo conceitual de Produção

Para evitar duplicidade técnica entre `mode` e `status`, implementar:

### `productions.mode`

- `SURVEY`
- `RESERVATION`

### `productions.status`

- `DRAFT`
- `ACTIVE`
- `CLOSED`
- `COMPLETED`
- `CANCELLED`

Mapeamento de linguagem de domínio/UI:

- `mode=SURVEY + status=ACTIVE` → **Sondagem**
- `mode=RESERVATION + status=ACTIVE` → **Reservas abertas**

Isso preserva o domínio e impede combinações redundantes como status `SURVEY` junto de mode `SURVEY`.

`SOLD_OUT` é condição derivada, nunca status persistido.

---

## 4. Jornada do cliente

### 4.1 Reserva aberta

`link → Produção → selecionar itens/quantidades → Fazer pedido → nome + telefone + e-mail → confirmar → Aguardando pagamento → Pix fora do sistema → confeiteira confirma → Pagamento confirmado`

Regras:

- navegação anônima;
- sem cadastro prévio;
- dados só depois da decisão de pedir;
- erro preserva seleção e formulário;
- não mostrar sucesso antes do commit real;
- e-mail após criação do pedido;
- link seguro do pedido no e-mail.

### 4.2 Sondagem

`link → Produção → escolher Produto → Tenho interesse → nome + telefone + e-mail → registrar → confirmação`

Texto deve deixar claro:

- não é reserva;
- não garante produção;
- não consome capacidade.

### 4.3 Pedido por link seguro

O link permite:

- ver itens e quantidades;
- ver valor;
- ver status;
- ver instruções de pagamento enquanto pendente;
- cancelar se ainda permitido.

Não permite listar outros pedidos do mesmo e-mail.

---

## 5. Jornada da confeiteira

`login → Produções → criar/abrir Produção → acompanhar → confirmar pagamentos → ver quanto produzir → concluir pedidos → encerrar/concluir Produção`

### Superfícies administrativas

1. **Produções** — ciclos recentes/ativos e CTA Nova Produção.
2. **Criar/editar Produção** — uma única tela vertical e progressiva.
3. **Produção operacional** — principal área de trabalho.
4. **Produtos** — catálogo mínimo.

### Produção operacional

Prioridade visual:

1. **Quanto produzir** — somente `PAYMENT_CONFIRMED`, agrupado por Produto.
2. **Pendentes de pagamento** — `AWAITING_PAYMENT`, separados.
3. **Intenções** — sinal fraco, separado.
4. Lista de pedidos com filtros:
   - Pendentes;
   - Confirmados;
   - Expirados/Cancelados;
   - Concluídos.

Em pedido pendente, `Confirmar pagamento` deve ser inline e fácil de localizar.

---

## 6. Estados e transições

### Pedido

- `AWAITING_PAYMENT → PAYMENT_CONFIRMED`
- `AWAITING_PAYMENT → EXPIRED`
- `AWAITING_PAYMENT → CANCELLED`
- `PAYMENT_CONFIRMED → COMPLETED`
- `PAYMENT_CONFIRMED → CANCELLED` somente por admin

Estados finais não retornam.

### Intenção

- `ACTIVE → WITHDRAWN`

Não reservar estados, enums ou automações para conversão futura no MVP.

### Produção

- `DRAFT → ACTIVE`
- `ACTIVE → CLOSED`
- `ACTIVE → CANCELLED`
- `CLOSED → COMPLETED`

Cancelar Produção cancela pedidos não concluídos associados. Para pedidos pagos, eventual estorno é operacional e externo.

---

## 7. Arquitetura técnica

### Stack

- **Next.js + TypeScript**
- **PostgreSQL / Supabase**
- **Supabase Auth** somente admin
- **Supabase Storage** para fotos de Produtos
- **Brevo Free** para e-mail transacional
- **Netlify Free** para aplicação web full-stack Next.js
- **Supabase Cron / pg_cron** para rotina de lembrete e expiração

Arquitetura: monólito full-stack. Sem microserviços, Redis, event bus ou fila dedicada.

### Scheduler e hospedagem gratuita

A produção deve funcionar sem custo obrigatório de hospedagem ou domínio registrado. Não usar Vercel Hobby para este cliente comercial, porque o plano Hobby é restrito a uso pessoal/não comercial.

Hospedagem canônica do MVP: **Netlify Free**, que suporta Next.js full-stack e fornece URL de produção gratuita no formato `nome-do-projeto.netlify.app`. Essa URL é o endereço público inicial do cliente e não exige compra de domínio.

Um domínio próprio como `.com.br` ou `.com` é melhoria futura e opcional; só entra se alguém decidir pagar o registro. Não bloquear lançamento por domínio próprio.

Scheduler canônico:

`Supabase Cron (a cada 10 min) → HTTP protegido → /api/internal/process-pending-orders no Next.js`

O segredo do cron fica em Supabase Vault e nas variáveis de ambiente da hospedagem. A rota:

1. expira pedidos vencidos de forma idempotente;
2. envia um lembrete para pedidos elegíveis ainda não lembrados;
3. registra `reminder_sent_at` somente após envio aceito pelo provedor.

Não criar fila no MVP.

### 7.1 Auditoria de serviços antes do código

Estado canônico de infraestrutura para o primeiro deploy:

| Serviço | Escolha | Situação | Custo mínimo | Observação |
|---|---|---|---:|---|
| Hosting | Netlify Free | projeto `lilian-azevedo-confeitaria` já criado e acesso público liberado | R$ 0 | 300 créditos/mês com hard limit; se acabar, o site pausa e não há cobrança |
| Banco/Auth/Storage/Cron | Supabase Free | projeto `LA Confeitaria` criado e saudável (`cbnggqwchzsqtbkqixon`, `sa-east-1`) | R$ 0 enquanto dentro do Free | URL: `https://cbnggqwchzsqtbkqixon.supabase.co`; manter dentro dos limites gratuitos |
| E-mail transacional | Brevo Free | conta criada; API key armazenada como segredo na Netlify; remetente verificado | R$ 0 | remetente de teste: `douglas.ernesto.silva@gmail.com`; sem domínio próprio pode haver reescrita técnica do remetente |
| Imagens | Supabase Storage | disponível no projeto `LA Confeitaria`; bucket/policies serão criados por migration | R$ 0 no limite Free | upload apenas admin |
| Scheduler | Supabase Cron/pg_cron | disponível no projeto; job será criado por migration/configuração | R$ 0 no limite Free | roda a cada 10 min e chama endpoint interno protegido |
| Observabilidade | logs nativos Netlify/Supabase | suficiente no MVP | R$ 0 | não adicionar Sentry no primeiro corte |
| Domínio | `*.netlify.app` | reservado pelo projeto | R$ 0 | domínio próprio não bloqueia lançamento |

**Restrição financeira absoluta:** todos os serviços ativos do MVP devem permanecer em plano gratuito, sem cartão obrigatório, auto-recharge, overage ou compra de créditos. Se um recurso exigir pagamento, ele fica fora do MVP.

**Não adicionar outro provedor sem necessidade real.**

---

## 8. Modelo de dados

### `products`

- `id uuid pk`
- `name text not null`
- `short_description text`
- `image_path text`
- `base_price_cents integer null check >= 0`
- `status ACTIVE | INACTIVE`
- timestamps

### `productions`

- `id uuid pk`
- `public_slug text unique not null`
- `mode SURVEY | RESERVATION`
- `status DRAFT | ACTIVE | CLOSED | COMPLETED | CANCELLED`
- `fulfillment_at timestamptz null`
- `order_cutoff_at timestamptz null`
- `payment_window_minutes integer default 360`
- `reminder_before_minutes integer default 120`
- timestamps

### `production_items`

- `id uuid pk`
- `production_id fk`
- `product_id fk`
- `price_cents integer null check >= 0`
- `capacity integer null check > 0`
- `offer_enabled boolean default true`
- unique `(production_id, product_id)`

Em `RESERVATION`, todo item ofertado precisa ter preço efetivo: `production_items.price_cents` ou `products.base_price_cents`. Bloquear publicação se faltar preço.

### `customers`

É contato operacional, não usuário autenticado.

- `id uuid pk`
- `name text not null`
- `email text not null`
- `email_normalized text not null`
- `phone text not null`
- `phone_normalized text not null`
- timestamps
- unique `(email_normalized, phone_normalized)`

Reutilizar somente quando **e-mail + telefone normalizados** coincidirem. Não inferir identidade por apenas um campo.

### `orders`

- `id uuid pk`
- `customer_id fk`
- `production_id fk`
- `status AWAITING_PAYMENT | PAYMENT_CONFIRMED | EXPIRED | CANCELLED | COMPLETED`
- `access_token_hash text not null`
- `idempotency_key text unique not null`
- `expires_at timestamptz null`
- `reminder_sent_at timestamptz null`
- `payment_confirmed_at timestamptz null`
- `completed_at timestamptz null`
- `cancelled_at timestamptz null`
- timestamps

### `order_items`

- `id uuid pk`
- `order_id fk`
- `production_item_id fk`
- `quantity integer not null check > 0`
- `unit_price_cents integer not null check >= 0`
- unique `(order_id, production_item_id)`

Preço é snapshot histórico.

### `intentions`

- `id uuid pk`
- `customer_id fk`
- `product_id fk`
- `source_production_id fk null`
- `status ACTIVE | WITHDRAWN`
- `access_token_hash text not null`
- timestamps

Índice parcial para no máximo uma `ACTIVE` por `(customer_id, product_id)`.

### Auditoria mínima

Para ações administrativas críticas, registrar:

- timestamps de transição;
- `updated_by_admin_id` ou tabela enxuta `admin_activity` apenas se a implementação ficar mais simples/segura.

Não criar um event-sourcing system.

---

## 9. Concorrência e integridade

Criação de pedido com capacidade acontece em **uma transação PostgreSQL**:

1. validar Produção `ACTIVE` + mode `RESERVATION`;
2. bloquear (`FOR UPDATE`) os `production_items` envolvidos;
3. somar quantidades de pedidos `AWAITING_PAYMENT` + `PAYMENT_CONFIRMED` não expirados/cancelados;
4. comparar com capacidade;
5. criar/reutilizar customer;
6. criar order + order_items;
7. commit.

Depois do commit, disparar comunicações transacionais fora da transação. Falha de comunicação nunca reverte o pedido já confirmado no banco.

Regras:

- idempotency key impede pedido duplicado por duplo toque/retry;
- confirmar pagamento é update condicional apenas de `AWAITING_PAYMENT`;
- cron é idempotente;
- cancelar/expirar libera capacidade por derivação de estado;
- nunca decrementar/incrementar contador de estoque manual.

---

## 10. Autenticação e acesso

### Cliente

Sem sessão e sem conta.

Pedido e Intenção recebem token aleatório criptograficamente forte.

- URL contém token bruto;
- banco armazena apenas hash;
- token nunca vai para logs;
- comparação server-side;
- token não serve como sessão geral.

### Admin

Supabase Auth para administradores. No MVP, usar **e-mail + senha** com allowlist, sem tela pública de cadastro e sem dependência de magic link/SMTP para o login administrativo.

O primeiro usuário admin é criado manualmente uma única vez no Supabase Auth. Não existe signup público de admin. Recuperação de senha não precisa de fluxo próprio no MVP; se necessário durante o teste, a conta pode ser administrada pelo dashboard do Supabase.

Env:

- `ADMIN_EMAILS` — allowlist separada por vírgula; no ambiente de teste inicial: `douglas.ernesto.silva@gmail.com`.

Toda ação admin valida sessão + allowlist no servidor. Cadastro/login nunca concede privilégio admin apenas por existir uma conta Auth.

---

## 11. Comunicações transacionais — e-mail somente no MVP

### Provedor canônico: Brevo Free

Usar **Brevo Free** apenas para e-mail transacional. O plano gratuito atende ao baixo volume esperado e não exige compra de domínio para o primeiro lançamento; usando remetente gratuito, a Brevo pode reescrever o endereço para um domínio técnico próprio. Isso reduz branding e entregabilidade ideal, mas preserva o requisito de custo zero.

**SMS automatizado está fora do MVP enquanto o requisito for custo zero.** SMS comercial exige créditos pagos em provedores usuais. Não configurar Sender ID, número, saldo, Twilio, Brevo SMS ou outro serviço pago. A arquitetura deve ficar simples o bastante para um canal SMS ser adicionado futuramente, mas sem dependência, tabela, job ou credencial de SMS agora.

### E-mails obrigatórios

1. **Pedido recebido / aguardando pagamento**
   - resumo;
   - valor;
   - Pix/instruções;
   - expiração;
   - link seguro.

2. **Lembrete único de pagamento**
   - curto;
   - valor;
   - horário de expiração;
   - link.

3. **Pagamento confirmado**
   - informar que pedido entrou na produção.

4. **Pedido expirado/cancelado**
   - informar que não está mais reservado.

5. **Intenção registrada**
   - confirmar interesse;
   - link para retirar intenção.

O texto do formulário deve avisar que nome/telefone/e-mail são usados apenas para comunicação operacional. Marketing futuro exige consentimento separado.

### Regras de integração

- e-mail: `POST /v3/smtp/email`;
- nunca enviar comunicação antes do commit da transação;
- falha de e-mail não desfaz pedido;
- registrar somente metadados técnicos mínimos, sem conteúdo/PII completo;
- retry deve ser idempotente para não duplicar mensagens;
- o telefone continua coletado para contato operacional manual da confeiteira, não para SMS automático;
- em desenvolvimento, se Brevo não estiver configurado, o adapter de e-mail registra somente payload sanitizado no servidor.

---

## 12. Visual implementável

### Marca

Conceito: **ateliê de confeitaria contemporâneo**.

Preservar apenas o DNA cromático da referência atual, não o logo/design original.

### Tokens

- canvas `#FFF9F3`
- surface `#FFFFFF`
- cream `#F7EFE5`
- champagne `#E8D7AE`
- gold `#B58C49`
- blush `#E9C7B7`
- rosewood `#8B6259`
- cocoa `#4B3733`
- ink `#2C2624`
- muted `#6D625E`
- border `#E4D8D0`

Semânticos:

- aguardando: `#FFF4D8` / `#6D5100`
- confirmado: `#E7F3EC` / `#245B3B`
- expirado: `#F0EEEC` / `#655D59`
- cancelado/erro: `#FDEBEC` / `#8A2F38`
- concluído: `#EEE8E5` / `#5B4741`

Tipografia:

- Fraunces 600 — títulos/editorial/produtos;
- DM Sans — interface/operação;
- corpo principal 16 px;
- toque mínimo 44×44 px.

Cards comuns: fundo + borda, sombra como exceção.

Fotografia: 4:3, luz natural/difusa, textura real, sem filtros fortes/marca d’água dominante.

### Mobile-first

- cliente: 360–430 px prioritário, uma coluna;
- admin também mobile-first;
- desktop apenas expande, sem dashboard corporativo.

---

## 13. Rotas mínimas

### Públicas

- `/p/[slug]` — Produção pública
- `/pedido/[id]?token=...` — consulta do pedido
- `/interesse/[id]?token=...` — consulta/retirada de Intenção

### Admin

- `/admin`
- `/admin/produtos`
- `/admin/producoes`
- `/admin/producoes/nova`
- `/admin/producoes/[id]`

### Interna

- `/api/internal/process-pending-orders`

Não criar rotas sociais, perfil de cliente ou carrinho.

---

## 14. Actions/endpoints do domínio

### Público

- get public production by slug;
- create order;
- get order by id + token;
- cancel awaiting order by token;
- create intention;
- get intention by id + token;
- withdraw intention by token;
- share é client-side.

### Admin

- create/update/activate/inactivate Product;
- upload/replace Product image;
- create/update/publish/close/cancel/complete Production;
- add/update/remove Production Item enquanto permitido;
- list/filter orders;
- confirm payment;
- cancel order;
- complete order.

Sem CRUD genérico.

---

## 15. Estrutura de repositório

```text
/app
  /(public)/p/[slug]
  /pedido/[id]
  /interesse/[id]
  /admin
    /produtos
    /producoes
  /api/internal/process-pending-orders
/components
  /public
  /admin
  /ui
/domain
  /products
  /productions
  /orders
  /intentions
/lib
  /supabase
  /auth
  /email
  /storage
  /validation
  /security
  /config
/db
  /migrations
/tests
  /domain
  /integration
  /e2e
/docs
  ARCHITECTURE.md
  DOMAIN-RULES.md
```

UI chama actions; actions orquestram; regras críticas ficam no domínio. Não criar base classes/repositories genéricos prematuros.

---

## 16. Variáveis de ambiente

Mínimo:

```text
NEXT_PUBLIC_APP_URL=
APP_TIMEZONE=America/Sao_Paulo
APP_LOCALE=pt-BR
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
BREVO_API_KEY=
EMAIL_FROM=douglas.ernesto.silva@gmail.com
EMAIL_FROM_NAME=LA Confeitaria Artesanal
ADMIN_EMAILS=douglas.ernesto.silva@gmail.com
PIX_KEY=
PIX_RECIPIENT_NAME=
PAYMENT_INSTRUCTIONS=
CRON_SECRET=
```

Não exigir `service_role`/secret key no browser nem no bundle. Preferir RLS + sessão admin e RPCs PostgreSQL `SECURITY DEFINER` estritamente validadas para operações públicas atômicas. Nunca expor Brevo key ou cron secret ao browser.

---

## 16.1 Tempo, locale e datas

- banco armazena timestamps como `timestamptz`/UTC;
- regras de negócio que dependem de horário usam explicitamente `APP_TIMEZONE=America/Sao_Paulo`;
- interface apresenta datas/horas em `America/Sao_Paulo` e locale `pt-BR`;
- não depender do timezone da máquina, runtime, Netlify ou navegador para decidir expiração/cutoff;
- testes de expiração e cutoff devem cobrir a conversão UTC ↔ horário local.

---

## 17. Segurança mínima obrigatória

- validação server-side tipada;
- autorização admin no servidor;
- token de pedido/intenção com hash no banco;
- rate limit leve em create order/intention e leitura por token;
- normalização de e-mail/telefone;
- logs sem token e sem PII completa;
- upload apenas por admin;
- validar MIME, extensão e tamanho;
- RLS ou bloqueio equivalente para impedir acesso direto indevido;
- secrets somente em ambiente seguro;
- HTTPS;
- formulário público com honeypot/rate limit básico contra spam.

Não usar CAPTCHA no primeiro corte salvo abuso real.

---

## 18. Testes obrigatórios antes de deploy

### Domínio/integridade

- Intenção nunca entra em “quanto produzir”.
- `AWAITING_PAYMENT` nunca entra em “quanto produzir”.
- `PAYMENT_CONFIRMED` entra exatamente uma vez.
- Duas reservas concorrentes não ultrapassam capacidade.
- Retry/duplo toque não duplica pedido.
- Expiração libera capacidade.
- Cancelamento libera capacidade.
- Confirmação de pagamento duplicada é idempotente.
- Pedido não nasce em Produção fechada/cancelada/sondagem.
- Preço do pedido não muda quando Produto/Item é editado.
- Token inválido não revela pedido/intenção.
- Cliente não acessa admin.
- Produção cancelada cancela pedidos elegíveis.

### E2E mínimo

1. Admin entra com e-mail + senha usando conta previamente criada e presente na allowlist.
2. Cria Produto.
3. Cria Produção de Reserva com 2 Produtos.
4. Cliente abre link e faz pedido com 2 itens.
5. Pedido fica Aguardando pagamento.
6. E-mail/adapter recebe resumo e link.
7. Admin confirma pagamento.
8. “Quanto produzir” atualiza corretamente.
9. Cliente vê Pagamento confirmado pelo link.
10. Admin conclui pedido.
11. Pedido pendente expira via rotina interna.
12. Produção SURVEY registra e retira Intenção.

Rodar antes de considerar pronto:

- lint;
- typecheck;
- unit/integration tests;
- e2e smoke;
- `next build`.

---

## 18.1 Smoke test real em produção

Depois do primeiro deploy funcional e antes de considerar entregue, executar na URL pública um fluxo real de baixa quantidade:

`admin login → criar Produto → abrir Produção de Reserva → cliente criar pedido → receber e-mail → abrir link seguro → admin confirmar Pix manualmente → "quanto produzir" atualizar → criar segundo pedido pendente → executar/aguardar rotina de expiração → confirmar capacidade liberada`

Também testar em celular real ao menos: formulário com teclado aberto, copiar chave Pix, rolagem, link recebido por e-mail e upload de foto de Produto.

O smoke não substitui testes automatizados; ele valida integração Netlify + Supabase + Brevo + navegador real.

---

## 19. Critérios de aceite do MVP

O MVP está pronto somente quando:

- cliente acessa Produção por link sem login;
- fotos/produtos/preços são claros no celular;
- seleção de múltiplos itens funciona sem carrinho;
- nome + telefone + e-mail são pedidos uma única vez no fluxo;
- pedido é transacional e idempotente;
- capacidade não é ultrapassada;
- pedido nasce `AWAITING_PAYMENT`;
- cliente recebe instruções de Pix e link seguro por e-mail;
- admin confirma pagamento em um toque/ação curta;
- cliente recebe confirmação;
- “quanto produzir” considera só pagos;
- pendentes ficam separados;
- pedidos vencidos expiram e liberam capacidade;
- no máximo um lembrete operacional por e-mail antes da expiração;
- admin conclui retirada/entrega;
- Sondagem registra Intenção sem confundir com pedido;
- nenhuma feature social aberta aparece;
- interface respeita o Visual Pack;
- mobile funciona sem hover/tooltips obrigatórios;
- erros preservam dados;
- build e testes passam;
- deploy de preview e produção funcionam.

---

## 20. Launch checklist

Antes de abrir para clientes reais:

- publicar em uma URL gratuita `*.netlify.app` e escolher um nome legível para o cliente;
- não comprar domínio para lançar; domínio próprio é opcional e futuro;
- configurar Supabase production;
- aplicar migrations;
- primeiro usuário admin já criado e confirmado no Supabase Auth: `douglas.ernesto.silva@gmail.com`; manter esse e-mail na admin allowlist e não criar signup público;
- configurar a chave Pix real; no MVP a UI usa chave em texto + copiar, sem QR obrigatório;
- criar/configurar conta Brevo Free, verificar `EMAIL_FROM` e API key; domínio próprio não é obrigatório para lançar, embora seja recomendado futuramente para melhor branding/entregabilidade;
- não configurar SMS no MVP; qualquer ativação futura exige nova decisão porque pode gerar custo;
- criar o job Supabase Cron por migration/configuração versionada; `CRON_SECRET` já está provisionado na Netlify e no Supabase Vault;
- validar e-mail real ponta a ponta;
- criar 1 Produção real de teste;
- testar pedido real com quantidade pequena;
- testar confirmação manual;
- testar expiração;
- validar timezone `America/Sao_Paulo` contra UTC no banco;
- executar o smoke test real em produção definido neste pack;
- revisar texto de privacidade/coleta de nome, telefone e e-mail;
- garantir backup/export do banco.

Este projeto deve permanecer 100% em free tiers. Se algum limite gratuito for atingido, preferir degradação controlada, pausa ou ajuste de uso — nunca upgrade automático ou cobrança. O Supabase Free pode pausar por inatividade e não inclui backup automático; documentar isso como limitação aceita e manter migrations + export manual periódico quando houver dados reais.

---

## 21. Instrução de comportamento para o coding agent

O coding agent deve:

- implementar o MVP inteiro deste pack;
- não pedir decisões que já foram congeladas aqui;
- não ampliar escopo;
- não criar arquitetura para hipóteses futuras;
- manter código simples, tipado e previsível;
- criar migrations rastreáveis;
- criar testes das regras críticas antes de considerar a feature concluída;
- usar mocks/adapters somente para credenciais externas ausentes e continuar construindo;
- marcar claramente qualquer bloqueio que dependa exclusivamente de segredo, conta externa ou domínio;
- entregar preview funcional antes do deploy definitivo;
- corrigir erros de build/teste antes de encerrar.

**Regra final:** se houver duas soluções tecnicamente válidas, escolher a menor que preserve integridade, segurança e experiência definidas neste pack.


---

## 22. Estado de infraestrutura no momento do handoff ao Codex

Este estado substitui qualquer anotação anterior de “a configurar”:

- GitHub: conexão ativa para o usuário `sdouglasilva`; repositório do projeto ainda deve ser criado/usado pelo coding agent.
- Netlify: projeto Free `lilian-azevedo-confeitaria` criado, público e reservado em `https://lilian-azevedo-confeitaria.netlify.app`; ainda sem primeiro deploy.
- Netlify env já configurado: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `APP_TIMEZONE=America/Sao_Paulo`, `APP_LOCALE=pt-BR`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `ADMIN_EMAILS`, além de `BREVO_API_KEY` e `CRON_SECRET` como segredos. Pix permanece deliberadamente sem valor definitivo.
- Supabase: projeto Free `LA Confeitaria` criado e `ACTIVE_HEALTHY`, ref `cbnggqwchzsqtbkqixon`, região `sa-east-1`.
- Supabase Auth: primeiro usuário admin já criado e com e-mail confirmado: `douglas.ernesto.silva@gmail.com`. Autorização administrativa continua dependendo também de `ADMIN_EMAILS`; não existe signup público de admin.
- Supabase Vault: `cron_secret` e `app_public_url` já provisionados. O job `pg_cron` ainda deve ser criado pela implementação versionada, não manualmente fora das migrations/configuração do projeto.
- Brevo: conta Free criada; API key já armazenada como segredo no projeto Netlify; remetente `douglas.ernesto.silva@gmail.com` verificado. O teste ponta a ponta de entrega de e-mail acontece após o primeiro deploy funcional.
- SMS: deliberadamente fora do MVP para preservar custo obrigatório R$ 0.
- Pix: gateway inexistente. Chave definitiva ainda não foi informada; MVP usa chave em texto + copiar. QR Code não é requisito. O app deve aceitar configuração posterior sem alteração de código.
- Domínio: nenhum domínio pago. Usar `*.netlify.app`.
- Regra financeira: nenhum recurso pode exigir cartão, upgrade, crédito comprado, overage ou cobrança automática para o MVP funcionar.

Não resta cadastro externo obrigatório para iniciar o código. O coding agent não deve interromper a implementação porque Pix definitivo, repositório, bucket, migrations, RLS, job de cron ou dados de seed ainda não existem: esses itens são parte da própria implementação.
