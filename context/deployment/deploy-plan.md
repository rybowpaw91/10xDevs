---
project: loadfit
platform: Cloudflare Workers
status: deployed
created: 2026-09-07
deployed_at: 2026-09-07
production_url: https://loadfit.paw-r-91.workers.dev
cloudflare_account: paw.r.91@gmail.com's Account (fdea194320203f8555946788d6ff01b4)
supabase_project: esxozlitesevippjyecy
---

# First deploy: LoadFit → Cloudflare Workers

## Context

`context/foundation/infrastructure.md` already picked **Cloudflare Workers (with static assets, not Pages)** for LoadFit after a scored comparison and anti-bias cross-check, and the user confirmed that decision on 2026-09-06. This plan is the Plan-Mode deploy step: turn that decision into a concrete, ordered set of steps for the *first* production deploy, gated by human approval before anything mutates a live account.

Nothing had been deployed at the time this plan was written:
- `wrangler whoami` → not authenticated (no Cloudflare account linked from this machine)
- `supabase/.temp/project-ref` did not exist → no remote Supabase project linked yet
- `.dev.vars` did not exist → no local secrets configured
- `wrangler.jsonc`'s `name` was still the scaffold default `"10x-astro-starter"`, not `"loadfit"`
- `tech-stack.md` still hinted `deployment_target: cloudflare-pages`, which `infrastructure.md` had already flagged as stale (the pinned `@astrojs/cloudflare ^13.5.0` adapter is Workers-only)

Both Cloudflare and Supabase are being set up from scratch, and this plan deliberately stops at a working **manual** `wrangler deploy` — GitHub Actions auto-deploy-on-merge (the `tech-stack.md` CI hint) is out of scope here and will be a separate follow-up plan.

## Phase 0 — Manual account gates ✅ done (2026-09-07)

- [x] **Cloudflare account**: logged in as `paw.r.91@gmail.com`, single account (`fdea194320203f8555946788d6ff01b4`) — no `account_id` ambiguity, none added to `wrangler.jsonc`.
- [x] **Cloudflare workers.dev subdomain**: claimed as `paw-r-91.workers.dev` → production URL `https://loadfit.paw-r-91.workers.dev`.
- [x] **Supabase project**: existing project reused (`esxozlitesevippjyecy.supabase.co`), anon/publishable key in the new `sb_publishable_...` format — confirmed compatible with `@supabase/ssr` ^0.10.3 during Phase 4 verification.
- [x] **Supabase Auth → URL Configuration**: Site URL set to `https://loadfit.paw-r-91.workers.dev`, Redirect URLs include that URL and `http://localhost:4321`.
- [x] **Supabase email confirmation**: confirmed on; confirmation email delivered without hitting the built-in SMTP rate limit during the smoke test.
- [x] **Database schema**: none needed — confirmed empty `supabase/migrations/` and no non-auth table queries in `src/`.

## Phase 1 — Fix stale scaffold config ✅ done (2026-09-07)

- [x] `wrangler.jsonc`: changed `"name": "10x-astro-starter"` → `"name": "loadfit"`.
- [x] `context/foundation/tech-stack.md`: updated the `deployment_target` hint from `cloudflare-pages` to `cloudflare-workers`, and the "Why this stack" prose from "Cloudflare Pages/Workers" to "Cloudflare Workers (with static assets)".

## Phase 2 — Secrets ✅ done (2026-09-07)

- [x] Local dev: `.dev.vars` created (gitignored) with `SUPABASE_URL` / `SUPABASE_KEY`.
- [x] Production secrets set via `wrangler secret put SUPABASE_URL` / `SUPABASE_KEY` — this is what first created the `loadfit` Worker on the account (before any code was deployed).

## Phase 3 — Build and deploy ✅ done (2026-09-07)

- [x] `npm ci` — clean install, 772 packages (pre-existing audit findings from the earlier bootstrap verification, unrelated to this deploy).
- [x] `npm run build` — Astro build via the Cloudflare adapter. Adapter auto-enabled two extra bindings not previously in `wrangler.jsonc`: `IMAGES` (Cloudflare Images, for image processing) and `SESSION` (KV, for Astro sessions) — both provisioned automatically by `wrangler deploy`, no manual config needed.
- [x] `wrangler deploy` — succeeded. Cloudflare auto-provisioned a new KV namespace `loadfit-session` for the `SESSION` binding. Deployed to **https://loadfit.paw-r-91.workers.dev**, version `bc0d449b-825c-4372-a13a-0c6d74afe3bb`.

## Phase 4 — Verify ✅ done (2026-09-07) — all green, no errors

- [x] Homepage: `HTTP 200` (checked via `curl -k`; this shell's own CA bundle is broken per the earlier bootstrap-verification log, unrelated to the deployment).
- [x] Full auth loop in production, run by the user: sign up → confirmation email received and clicked → sign in → landed on `/dashboard` showing the authenticated user's email. This directly confirms the risk register's #1 concern (`SUPABASE_URL`/`SUPABASE_KEY` undefined-in-prod footgun) did **not** occur, and that the new `sb_publishable_...` key format works with `@supabase/ssr` ^0.10.3.
- [x] `/dashboard` while logged out → `302` redirect to `/auth/signin` (confirmed via `curl`, headers show `location: /auth/signin`).
- [x] `wrangler tail` ran through the entire smoke test — every request (`signup`, `confirm-email`, `signin`, `dashboard`, `signout`, repeat `signin`) logged `Ok`, zero runtime errors.

## Phase 5 — Rehearse rollback once ✅ done (2026-09-07)

- [x] `wrangler deployments list` — 4 versions on record: initial Worker creation (from the first `secret put`), two secret-change versions, and the code deployment (`bc0d449b`, currently active at 100%).
- [x] Rollback command confirmed for future incidents: `wrangler rollback --experimental-versions [<version-id>]` (not executed — no incident, nothing to roll back).

## Explicitly out of scope for this plan

- GitHub Actions auto-deploy-on-merge (CI already lints/builds in `.github/workflows/ci.yml` but does not deploy) — separate follow-up, needs a scoped Cloudflare API token added as a repo secret.
- `wrangler versions upload`-based PR preview deploys.
- Any Cloudflare Hyperdrive / binding work for the Supabase connection (noted as a future optimization in `infrastructure.md`, not required for MVP).

## Note on artifact location

This is the canonical location per `CLAUDE.md`'s Module 1 Lesson 5 hand-off contract (read by downstream milestone-planning skills as "what's already deployed"). A mirrored copy is also kept at `context/changes/deployment/deployment-plan.md` per explicit user request. If the two drift, this file is the source of truth — update both, or reconcile the `changes/` copy when the change is archived via `/10x-archive`.
