---
project: loadfit
researched_at: 2026-09-06
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript/JavaScript
  framework: Astro 6.3.1 (SSR, output: "server")
  runtime: Cloudflare Workers (via @astrojs/cloudflare ^13.5.0)
---

## Recommendation

**Deploy on Cloudflare Workers** (with static assets — not Cloudflare Pages).

Cloudflare Workers is the only researched platform to pass all five agent-friendly criteria cleanly: CLI-first (`wrangler`), fully managed/serverless, best-in-class agent-readable docs (`llms.txt`, markdown-suffix fetching), a stable scriptable deploy API, and a GA official MCP server for live-state queries. It's also the cheapest option at this project's traffic level (free tier likely covers 10k-100k requests/month), and `wrangler` is already a devDependency in the scaffolded project — no new tooling to introduce for a solo, 3-week after-hours budget. The interview ruled out persistent-connection requirements (no WebSockets/background jobs needed) and confirmed external managed services (Supabase) are fine, both of which remove the main reasons to prefer a container-based PaaS (Fly.io, Railway, Render) or accept Vercel's Hobby-tier commercial-use restriction.

**Correction to the incoming tech-stack.md hint**: it designates `deployment_target: cloudflare-pages`, but the pinned adapter (`@astrojs/cloudflare ^13.5.0`) dropped Pages support entirely as of v13.0.0 — the adapter is Workers-only now. This research updates the concrete target from Pages to Workers; see the Anti-Bias Cross-Check and Getting Started sections below for what changes as a result.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Notes |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | Only platform with a clean sweep. Free tier: 100k req/day; paid tier $5/mo covers 10M req + 30M CPU-ms. `wrangler rollback` still needs an `--experimental-versions` flag. |
| Vercel | Pass | Pass | Pass | Pass | Partial | `vercel logs`/`vercel rollback` are excellent and agent-optimized (rebuilt Feb 2026). MCP is public beta, OAuth-based, read-only-leaning. Hobby tier's Fair Use terms restrict commercial use — LoadFit (a tool aimed at small transport-company owners) likely needs Pro ($20/mo). |
| Render | Pass | Pass | Pass | Pass | Partial | CLI reached full deploy-triggering GA on 2026-09-01 (days old at research time) — a recency risk. Free tier has ~50-60s cold starts after 15min idle; Starter ($7/mo) removes this. Infra MCP is GA per third-party sources but not self-labeled GA by Render. |
| Fly.io | Pass | Pass | Pass | Pass | Partial | Always-on VMs give the most headroom if WebSockets/background jobs are added later, but requires container/Dockerfile literacy and has had no free tier since Oct 2024 (~$10-20/mo realistic baseline). Official MCP server explicitly marked beta. |
| Netlify | Partial | Pass | Pass | Partial | Pass | No dedicated CLI rollback command (UI/API only) weakens both CLI-first and deploy-API stability. `@netlify/mcp` is GA. Edge Functions have a tight 50ms CPU/request ceiling if Astro middleware runs in edge mode. |
| Railway | Partial | Pass | Pass | Partial | Pass | Official MCP server + Claude Code skill package is a genuine agent-integration strength, and no Dockerfile is needed (Railpack auto-build). But no CLI rollback verb, and multiple independent 2025-2026 reports document real reliability incidents (an 8-hour outage, elevated build/deploy failure rates) — a live risk, not marketing-page material. |

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Wins on every criterion: `wrangler` covers deploy/rollback/log-tailing end to end; the platform is fully serverless (no server to patch); Cloudflare publishes `llms.txt` and markdown-suffixed docs across the board; `wrangler deploy` is deterministic with structured output; and the official Workers Bindings MCP server (GA, OAuth) gives structured access to D1/R2/KV/Hyperdrive if the project grows into needing them. It's also the path already scaffolded by the starter (wrangler is a devDependency), which matters for a 3-week after-hours budget — no new tool to learn from zero, once the Pages-vs-Workers correction below is applied.

#### 2. Vercel

Scores nearly identically — its CLI and docs are arguably even more explicitly agent-optimized (the `vercel logs` command was rebuilt in Feb 2026 specifically for structured, agent-friendly output). The gap versus Cloudflare is cost-shaped, not capability-shaped: Hobby's free tier comes with a commercial-use restriction in its Fair Use terms, and LoadFit is a tool for paying small-business operators, which likely trips that clause and forces Pro at $20/mo — a real ongoing cost Cloudflare's free tier avoids at this traffic level.

#### 3. Render

A close third on raw criteria (4 Pass, 1 Partial, same profile as Vercel and Fly.io), Render loses ground mainly on freshness and free-tier UX: its CLI only became capable of triggering deploys directly a few days before this research (2026-09-01), which is too new to fully trust for a 3-week build, and its free-tier cold starts (~50-60s after 15 minutes idle) are a real risk for a "medium user scale, low QPS" app with idle gaps — avoidable only by paying for the $7/mo Starter tier.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Stale deploy-target assumption.** The project's own `tech-stack.md` still says `cloudflare-pages`, and older tutorials/community answers reference `wrangler pages deploy`. Anyone (including a future agent) following that literally will attempt a Pages-shaped deploy against an adapter (`@astrojs/cloudflare ^13.5.0`) that no longer emits Pages-compatible output.
2. **Partial `nodejs_compat` coverage.** Supabase's JS SDK / `@supabase/ssr` transitive dependencies could touch an unimplemented Node API (e.g. `http2`, `cluster`), surfacing as a production-only crash that doesn't reproduce in local testing.
3. **Env var / binding split.** `astro:env/server` (the pattern CLAUDE.md already documents for this project) covers plain env vars but not Cloudflare bindings. If `SUPABASE_URL`/`SUPABASE_KEY` end up declared as bindings instead of plain vars (or vice versa), the app can work fine under `wrangler dev` (which loads `.dev.vars`) and silently fail (`undefined`) in production.
4. **CPU-time billing, not wall-clock, with a 10ms/invocation free-tier cap.** Synchronous work inside the packing algorithm's fit-check — the PRD's non-negotiable correctness guardrail — could exceed the free tier's CPU budget under real load, forcing an earlier-than-planned upgrade to the $5/mo paid plan.
5. **`wrangler rollback` still requires `--experimental-versions`.** The exact command an agent or developer reaches for during an incident carries an "experimental" label, undercutting confidence in the "stable deploy API" criterion at the moment it matters most.

### Pre-Mortem — How This Could Fail

The team deployed LoadFit's Astro SSR app to Cloudflare Workers, copying `wrangler pages deploy` from an older tutorial and from the starter's own generic "Pages/Workers" framing. Because `@astrojs/cloudflare` 13.x no longer supports Pages, the build silently produced a stale static artifact — the SSR fit-check endpoint quietly 404'd for two weeks while static marketing pages kept working, so nobody noticed. Separately, `SUPABASE_KEY` was set as a Workers Secret binding rather than a plain `astro:env` var: it read fine locally under `wrangler dev` (which loads `.dev.vars`) but came back `undefined` in production, so login broke over a weekend with no one around to catch it — this is a solo, after-hours project with no on-call. By the time both issues were diagnosed, the debugging ate most of the remaining 3-week budget, and the "obvious, path-of-least-resistance" platform choice ended up costing more time than a more explicit platform would have.

### Unknown Unknowns

- Cloudflare has quietly moved Pages into maintenance mode while steering new projects toward Workers — most existing tutorials, Stack Overflow answers, and even this project's own `tech-stack.md` hint haven't caught up to that shift.
- The Cloudflare Vite plugin now runs local `astro dev` on real `workerd`, so `nodejs_compat` restrictions apply in local dev too — a dependency that "just worked" during early prototyping under plain Node can break the moment the Cloudflare adapter is wired in, well before actual deployment.
- `nodejs_compat` behavior is itself versioned by the `compatibility_date` pinned in `wrangler.jsonc`/`wrangler.toml` (behavior differs around the 2024-09-23 and 2026-08-04 thresholds) — a config value most developers never think of as behavior-changing.
- Hyperdrive exists specifically to pool Worker→external-Postgres connections (like Supabase) at the edge; without it, every Worker invocation may pay a fresh TCP/TLS handshake to Supabase, and most getting-started guides won't mention this until latency becomes visible.
- The official Workers Bindings MCP server is a genuine productivity multiplier for later live-state queries (D1/R2/KV/Hyperdrive) but is easy to overlook entirely since the CLI alone looks sufficient at MVP scope.

**Decision**: proceed with Cloudflare Workers, risks absorbed into the risk register below (user confirmed 2026-09-06).

## Operational Story

- **Preview deploys**: `wrangler versions upload` creates a preview version with its own URL without shifting production traffic; promote to 100% with `wrangler versions deploy`. No automatic PR-based preview URLs out of the box (unlike Vercel/Netlify) — wiring GitHub Actions to call `wrangler versions upload` per PR is a manual setup step if PR previews are wanted later.
- **Secrets**: plain env vars go through `astro:env/server` (declared in `astro.config.mjs`'s `env.schema`, as CLAUDE.md documents) and are set locally via `.dev.vars` (gitignored) or in production via `wrangler secret put <NAME>`. Cloudflare *bindings* (D1/R2/KV/Hyperdrive, if added later) are a separate mechanism accessed via `context.locals.runtime.env` or `import { env } from "cloudflare:workers"` — do not conflate the two; `SUPABASE_URL`/`SUPABASE_KEY` should stay as plain Worker secrets, not bindings, unless the project switches to Hyperdrive for the Supabase Postgres connection.
- **Rollback**: `wrangler rollback [<version-id>]` reverts to the previous or a named version (list candidates with `wrangler deployments list`); currently gated behind the `--experimental-versions` flag. Time-to-revert is seconds once the version ID is known. No database migrations are managed by Cloudflare — any Supabase schema migration tied to the rolled-back code must be reverted separately and manually.
- **Approval**: routine deploys (`wrangler deploy`) and log-tailing (`wrangler tail`) are safe for an agent to run unattended once CI is wired up. Human-only: rotating the `SUPABASE_KEY` secret, deleting the Worker/project, and any Cloudflare account-level billing tier change.
- **Logs**: `wrangler tail` streams live production logs from the terminal. The official Workers Bindings MCP server (`https://bindings.mcp.cloudflare.com/mcp`, OAuth) additionally exposes structured tools for D1/R2/KV/Hyperdrive/Workers resource state if those are added post-MVP — not required for the current CLI-only workflow.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Deploy pipeline built against stale Pages assumption (tech-stack.md says `cloudflare-pages`; adapter is Workers-only) | Devil's advocate | M | H | Before first deploy, explicitly confirm `wrangler.jsonc`/`wrangler.toml` targets Workers with static assets; do not copy `wrangler pages` commands from older tutorials or this project's own stale hint. |
| `SUPABASE_URL`/`SUPABASE_KEY` set as a Workers binding instead of a plain secret (or vice versa), working locally and failing silently in production | Devil's advocate / Pre-mortem | M | H | Set both via `wrangler secret put`, consume via `astro:env/server` only; add a smoke-test login check immediately after first production deploy, not days later. |
| Partial `nodejs_compat` coverage breaks a transitive dependency of Supabase's JS SDK only in production | Devil's advocate | L | M | Enable `nodejs_compat` with a `compatibility_date` no older than 2024-09-23; run a full auth + save/reuse flow smoke test against the deployed Worker (not just local `wrangler dev`) before considering the deploy done. |
| Packing algorithm's fit-check exceeds free-tier CPU-time cap (10ms/invocation) under real load | Devil's advocate | L | M | Monitor Worker CPU-time metrics after launch; budget for the $5/mo paid plan (30s CPU/invocation) if the algorithm's synchronous work grows. |
| `wrangler rollback` remains behind an experimental flag | Devil's advocate | L | M | Document the exact rollback command (`wrangler rollback --experimental-versions`) and rehearse it once before relying on it during a real incident. |
| Local dev now runs on real `workerd`, so a dependency issue can surface earlier (during prototyping) rather than at deploy time | Unknown unknowns | L | L | Treat any `nodejs_compat`-related local dev error as a signal to check the dependency's Workers compatibility immediately, not to route around it. |
| No native PR-based preview URLs (unlike Vercel/Netlify) | Research finding | M | L | Acceptable for a solo 3-week MVP with no team review process; revisit with `wrangler versions upload` + a small GitHub Actions step if preview links become needed. |

## Getting Started

1. Confirm the deploy target in the project's Wrangler config is Workers with static assets, not Pages — check `wrangler.jsonc`/`wrangler.toml` for `main`/`assets` fields consistent with `@astrojs/cloudflare` v13's Workers-only output (per the astro build output in `dist/`), and update any lingering `cloudflare-pages` references in `context/foundation/tech-stack.md` if the project revisits that file.
2. Set required secrets before the first deploy: `wrangler secret put SUPABASE_URL` and `wrangler secret put SUPABASE_KEY` (production); for local dev, add both to `.dev.vars` (already gitignored per CLAUDE.md).
3. Build and deploy: `npm run build` then `wrangler deploy` (uses the `wrangler ^4.90.0` devDependency already in `package.json` — no separate install needed).
4. Verify with a real request: hit the deployed Worker URL and run through the login flow and the core US-01 fit-check flow end to end, not just a static page load — this directly guards against the env-var/binding footgun above.
5. Tail logs to confirm clean startup: `wrangler tail`.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions auto-deploy-on-merge is already the tech-stack.md hint, but wiring the actual workflow file is a downstream implementation task)
- Production-scale architecture (multi-region, HA, DR)
