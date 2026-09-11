# CODEX HANDOFF — LA Confeitaria Artesanal

## Current execution status — 2026-09-11

- Restored from the canonical bootstrap bundle on `main`.
- Fixed admin forms so failed saves preserve the user's entered data.
- Product uploads now validate WebP extension, MIME, signature and the 5 MB limit before saving.
- The server-action upload limit is aligned with the 5 MB product-image requirement.
- “Quanto produzir” groups by product ID, so products with identical names are not merged.
- Brevo requests now reuse the database delivery UUID as the provider idempotency key.
- Added PostgreSQL integration coverage for multi-item orders, capacity, retry, cancellation, expiration, survey intentions, state transitions, email receipts and RLS.
- Added GitHub quality gates and explicit Netlify build configuration.
- Verified locally: 30 tests, lint, typecheck, production build, HTTP route checks and desktop/mobile browser rendering.
- Supabase production has no Production records yet, so a complete real customer/admin smoke requires the first production to be created after deployment.
- External blockers: GitHub write returned `403 Resource not accessible by integration`; production Netlify still points to the earlier raw-upload deploy until the validated source reaches GitHub or a supported Netlify build deploy is triggered.
- Netlify environment review found `BRAVO_API_KEY` instead of the required `BREVO_API_KEY`; the stored value was not copied because it did not match a recognized Brevo API-key format.

Exact continuation: authorize GitHub write for `sdouglasilva/lilian-azevedo-confeitaria`, push `main`, connect that repository to the existing Netlify site `adc61111-1049-41c2-b89d-09f09dc9aea0`, set a valid secret `BREVO_API_KEY`, deploy through the normal Next.js build integration, then run the production smoke described in the canonical pack.

## Mission

Take this repository as the **real code baseline**. Inspect the filesystem and implementation before changing anything.

Operational rule:

> **If a required behavior already exists and is correct, preserve it. If a canonical requirement does not exist or is incomplete, implement it. Do not create placeholder/fake files merely to satisfy a checklist.**

The code is authoritative for what already exists. `docs/PRODUCT-SOURCE-OF-TRUTH.md` is authoritative for product behavior and scope.

## Source hygiene

This snapshot intentionally excludes prior Gate/orchestrator/audit/investigation artifacts. Do not recreate `GATE*`, `EXECUTION-MAP`, blocker reports, or other process-only files unless they are strictly necessary for the application itself.

Keep and use:
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DOMAIN-RULES.md`
- `docs/PRODUCT-SOURCE-OF-TRUTH.md`
- application, domain, library, migration and test files that actually exist in the repository.

## Current code baseline

This clean snapshot was built from implementation commit:

`5b0133e4cf49ffb96595e1141490a33a479afc41`

That baseline already includes the reconstructed Next.js application, domain/security tests, Supabase schema migration, cron migration, dependency lockfile and the Gate 2/2.1 code/security fixes. Process-only Gate documents were removed from this handoff.

## Current external state

Target GitHub repository:

`sdouglasilva/lilian-azevedo-confeitaria`

The remote repository was previously empty. Treat this snapshot as the bootstrap source to publish.

Production URL:

`https://lilian-azevedo-confeitaria.netlify.app`

A previous Netlify deployment was created by raw API/upload and produced no functions/edge functions, causing 404s for the application and server routes. **Do not reproduce raw file upload as the deployment strategy for this Next.js app.** Use a supported Next.js/Netlify build path after the repository is healthy and quality gates pass.

Known affected paths from that failed deployment:
- `/`
- `/admin/login`
- `/api/internal/process-pending-orders`

## Required execution behavior

1. Inspect the repository tree and existing implementation.
2. Read `docs/PRODUCT-SOURCE-OF-TRUTH.md`, `docs/ARCHITECTURE.md`, and `docs/DOMAIN-RULES.md`.
3. Build a requirement-to-code matrix from the canonical product pack against the actual filesystem.
4. Preserve correct existing implementation. Do not rewrite working areas for style alone.
5. Implement only proven gaps or defects.
6. Do not invent fake infrastructure, fake secrets, fake integrations, fake routes, fake migrations, or placeholder folders.
7. Do not re-run historical database migrations merely to “sync” state. If a database defect is proven, create a new corrective migration.
8. Keep secrets out of the repository. `.env.example` must remain placeholder-only.
9. Run the real project gates available in `package.json`, including tests, lint, typecheck and build.
10. Resolve failures in code/configuration, then rerun gates until green or until an external blocker is proven.
11. Bootstrap/push this code to `sdouglasilva/lilian-azevedo-confeitaria` on `main` when GitHub write access is available.
12. Only after the repository is healthy, configure/verify the Netlify deployment using the normal Next.js build integration and verify the public/admin/internal routes.

## Scope guardrails

Do not redesign the product. Do not add speculative social features, accounts for customers, payment gateway processing, ERP/stock/accounting/logistics, or other out-of-scope systems unless the canonical product pack explicitly requires them.

For any ambiguity: prefer the smallest implementation that satisfies the canonical pack and existing architecture.

## Definition of done

Done means all of the following are true:
- repository contains real application code, not process artifacts;
- canonical requirements are either implemented or explicitly evidenced as already implemented;
- test/lint/typecheck/build pass, or a concrete external blocker is documented with command/output evidence;
- no real secrets are committed;
- GitHub `main` contains the validated source;
- Netlify builds the Next.js app through a supported build path;
- `/`, `/admin/login`, and `/api/internal/process-pending-orders` no longer fail because of missing deploy packaging/functions.
