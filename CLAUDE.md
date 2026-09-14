# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start dev server (Cloudflare workerd runtime)
- `npm run build` — production build (SSR via `@astrojs/cloudflare`)
- `npm run preview` — preview production build
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — Prettier (includes prettier-plugin-astro + prettier-plugin-tailwindcss)
- `npm run test` — Vitest (unit + fast-check property tests)

Pre-commit hooks: husky + lint-staged runs `eslint --fix` on `*.{ts,tsx,astro}` and `prettier --write` on `*.{json,css,md}`.

CI (`.github/workflows/ci.yml`) runs `npx astro sync`, `npm run lint`, `npm run test`, then `npm run build` on every push/PR to `master`; the build step needs `SUPABASE_URL`/`SUPABASE_KEY` repo secrets.

## Architecture

**Astro 6 SSR app** Deployed to Cloudflare Workers.

**Critical:** Always enable RLS on new tables with granular per-operation, per-role policies.

### Rendering mode

Full server-side rendering (`output: "server"` in astro.config.mjs). All pages are server-rendered by default. API routes must export `const prerender = false`.

### Auth flow

- `src/lib/supabase.ts` — creates a Supabase SSR client using `@supabase/ssr` with cookie-based sessions. Uses `astro:env/server` for `SUPABASE_URL` and `SUPABASE_KEY` (server-only secrets declared in astro.config.mjs `env.schema`).
- `src/middleware.ts` — runs on every request, resolves the current user, attaches to `context.locals.user`. Redirects unauthenticated users away from routes listed in `PROTECTED_ROUTES`.
- API endpoints: `src/pages/api/auth/{signin,signup,signout}.ts`
- Auth pages: `src/pages/auth/{signin,signup,confirm-email}.astro`
- Protected page example: `src/pages/dashboard.astro`

### Key conventions

- **Path alias**: `@/*` maps to `./src/*` (tsconfig paths).
- **Astro components** for static content/layout; **React components** only when interactivity is needed.
- **Tailwind class merging**: use the `cn()` helper from `@/lib/utils` (clsx + tailwind-merge) for conditional/merged class names. Do not concatenate class strings manually.
- **shadcn/ui**: components live in `src/components/ui/`, "new-york" style variant. Install new ones with `npx shadcn@latest add [name]`.
- **API routes**: use uppercase `GET`, `POST` exports; validate input with zod.
- **Supabase migrations**: `supabase/migrations/` using naming format `YYYYMMDDHHmmss_short_description.sql`.
- **React**: no Next.js directives ("use client" etc.). Extract hooks to `src/hooks/` (per the `hooks` alias in `components.json`).
- **Services/helpers** go in `src/lib/` (or `src/lib/services/` for extracted business logic).
- **Shared types** (entities, DTOs) go in `src/types.ts`.

### Git workflow for changes

Each change (`context/changes/<change-id>/`) is implemented on its own branch, named exactly after `<change-id>` (e.g. `save-goods-list`), branched from `master`.

- The branch is created when `/10x-implement` starts — not at `/10x-new` or `/10x-plan` time. Planning artifacts (`change.md`, `plan.md`, `plan-brief.md`) are created and committed on `master`; only implementation work happens on the change's branch.
- Phases within a change commit sequentially onto that branch, same as the existing per-phase commit ritual.
- Once the change is fully implemented (and reviewed, if `/10x-impl-review` runs), merge it back into `master` locally (fast-forward or a plain merge) — no PR required for this solo project.
- `/10x-archive` runs after the merge back to `master`.

### Environment

- Node.js v22.14.0 (see `.nvmrc`)
- Env vars: `SUPABASE_URL`, `SUPABASE_KEY` (copy `.env.example` to `.env` for Node, or `.dev.vars` for Cloudflare local dev)
- Local Supabase: `npx supabase start` (requires Docker)
- Cloudflare local dev: secrets go in `.dev.vars` (gitignored)
- Deploy: `npx wrangler deploy` (requires Cloudflare account + `wrangler` auth)

## E2E Testing

- `npx playwright test` — run the full E2E suite (starts/reuses the dev server on `:4321` per `playwright.config.ts`'s `webServer`).
- `npx playwright test <file>` — run a single spec.
- Tests live in `tests/e2e/`, one test per file, named `<feature>.spec.ts`. `tests/e2e/seed.spec.ts` is the reference exemplar — model new specs on it.
- Auth: `tests/e2e/auth.setup.ts` is a Playwright "setup" project that logs in once (fixed local test account `e2e-seed@example.com`, created idempotently) and saves `tests/e2e/.auth/user.json` (gitignored). The `chromium` project depends on `setup` and loads that `storageState` — individual tests never log in through the UI.
- Dedicated project, never production: E2E runs against a Supabase project reserved solely for E2E (its URL/publishable key in `.dev.vars`) — tests create and delete real accounts and data, so this must never point at the production project or local Docker Supabase used for manual dev testing. Migrations are applied with `supabase db push --db-url <connection-string>`, deliberately not `supabase link`, so the CLI's linked project (production) is never touched.

### E2E Testing Rules

- Use `getByRole`, `getByLabel`, `getByText` as primary locators. Fall back to `getByTestId` only when accessibility attributes are ambiguous — and prefer fixing the missing `id`/`htmlFor`/`aria-label` in the component over adding a test-only workaround, per the `id`/`htmlFor` fix applied to `GoodsFitForm.tsx`'s vehicle/item fields.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- **Wait for hydration before interacting with a `client:load` island — with proof, not a timer.** Filling a field immediately after `page.goto()` can land before React attaches its controlled-input handlers; the initial render then silently overwrites what was typed. `.fill()` sets the DOM value directly and can "succeed" even when React isn't listening yet, so checking `inputValue()` afterward proves nothing. `page.waitForLoadState("networkidle")` doesn't work either: Vite's HMR client keeps a WebSocket open for the page's lifetime, so network never goes idle and the wait just hangs until timeout. Instead wait for a real React-driven side effect before the first `fill`/`click`: a mount-time data fetch (`page.waitForResponse(...)` registered *before* `goto`/`reload`, as in `waitForFormMount` in `seed.spec.ts`), or a toggle-driven DOM change (`waitForFormHydration` in `tests/e2e/utils.ts`, which clicks a password-visibility toggle and asserts the `type` attribute actually flips, retried via `expect(...).toPass()` since the click can itself land before hydration).
- Each test must be independently runnable — no shared state between tests.
- Never use `page.waitForTimeout()`. Wait for specific conditions: `toBeVisible()`, `waitForURL()`, `waitForResponse()`.
- Assert the business outcome, not implementation details.
- Use unique identifiers (e.g., a `Date.now()` suffix) for test data to avoid collisions across runs. Clean up what the test created, in the same test.
- Use `storageState` for authentication — never log in through the UI in individual tests.
- The first request to a cold local dev server (route compilation + a real Supabase round trip) can take longer than Playwright's default 5s assertion timeout — prefer an explicit `waitForURL(..., { timeout: 20_000 })` over bumping global timeouts.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** It is the single source of truth
for the workflow — risk → seed test + rules → generate → review against the five
anti-patterns → re-prompt → verify. The skill's `references/` carry the full
rules, anti-patterns, seed pattern, and prompt-template.

A few hard rules that hold even before you invoke the skill:

- **Locators:** `getByRole` / `getByLabel` / `getByText` first; `getByTestId`
  only when accessibility attributes are ambiguous. Never CSS selectors, XPath,
  or DOM structure.
- **Never `page.waitForTimeout()`.** Wait for state: `toBeVisible()`,
  `waitForURL()`, `waitForResponse()`.
- **Test independence + cleanup.** Each test runs standalone — its own setup,
  action, assertion, and cleanup; unique ids (timestamp suffix) so parallel runs
  and re-runs don't collide.

Two boundaries to keep straight:

- **DOM (snapshot) is the default.** Vision (`--caps=vision`) is a supplement for
  visual-only risks (layout, z-index, animation); for pixel regression prefer
  deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel). VLM model
  selection/cost is a debugging topic (Lesson 5), not testing.
- **Healer helps on selectors, harms on logic.** A changed selector → healer
  re-finds it (route through PR review). A changed business behavior → healer
  masks the bug; that failing-test-to-fix case is Lesson 5.

<!-- END @przeprogramowani/10x-cli -->
