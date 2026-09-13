# Test Plan

> Test phase for this project, rolled out in stages. The strategy is frozen
> at the top (§1–§5); the cookbook patterns at the bottom (§6) fill in as
> subsequent phases are rolled out.
> Read this before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when the plan goes stale (see §8).
>
> Last updated: 2026-09-13

## 1. Strategy

Tests in this project are governed by three non-negotiable rules:

1. **Cost × signal.** The cheapest test that gives real signal for a given
   risk wins. Don't promote to e2e just because e2e "feels safer." Don't
   bolt a vision model onto a deterministic diff that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and a failure would show up somewhere in area Y" carry
   the same weight as PRD lines or hot-spot scan data.
3. **Risks are scenarios, not code locations.** This plan documents
   _what could break_ and _why we consider it likely_ — based on
   documents, the interview, and code signal (churn, structure, existing
   test base). It does NOT claim to know which line is responsible for a
   failure. That knowledge is produced by `/10x-research` during each
   rollout phase. If the plan and research disagree about where a failure
   lies — research is the source of truth.

Hot-spot scan scope used to weight likelihood: `src/`, `supabase/migrations/`
(23 commits/30d — sufficient signal; `context/`, documentation, and build
output excluded).

## 2. Risk Map

Top failure scenarios this project must guard against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user/business
terms, not test names. The Source column cites _the evidence that raised
this risk to the top_ — never a specific file as "this is where the failure
lives" (that's research's job, see §1 rule #3).

| #   | Risk (failure scenario)                                                                                                                                                                                                     | Impact | Likelihood | Source (evidence — not an anchor)                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | A packing-heuristic refactor passes all existing tests, but changes the packing order in a way that breaks the weight rule (FR-010) or other expectations — the tests assert current behavior, not the correctness contract | High   | High       | interview Q2 (confirmed past incident); PRD FR-010; hot-spot dir `src/lib/services/packing/` (6 commits/30d)                                                                                                                         |
| 2   | Fit-check returns a false "fits" — a positive result despite exceeding max. payload or violating rotation/stacking rules                                                                                                    | High   | Medium     | PRD Guardrails ("false fit is worse than no answer"); PRD FR-009; interview Q1                                                                                                                                                       |
| 3   | A logged-in user reads/edits/deletes another user's saved vehicle profile or goods-item template (IDOR) via `vehicle-profiles`/`goods-item-templates`                                                                       | High   | Medium     | CLAUDE.md — "Critical: Always enable RLS... granular per-operation, per-role"; hot-spot dir `supabase/migrations/` (8 commits/30d) + `src/pages/api/vehicle-profiles/` (7 commits/30d); roadmap S-01/S-02 risk notes (2026-09-12/13) |
| 4   | Middleware doesn't redirect a logged-out user or a user with an expired session away from a protected route                                                                                                                 | High   | Medium     | hot-spot dir `src/middleware.ts` (4 commits/30d) + `src/components/auth/` (6 commits/30d); CLAUDE.md Auth flow; PRD Access Control                                                                                                   |
| 5   | The entire form UI flow — selecting a saved profile/template, submitting, displaying validation errors — breaks without detection                                                                                           | Medium | High       | interview Q4; hot-spot dir `src/components/fit-check/` (11 commits/30d — most frequently changed directory in the repo), zero test coverage                                                                                          |
| 6   | The API accepts an invalid/boundary payload (negative dimensions, item count near the documented CPU limit) without a clean server-side validation error, or the limit isn't actually enforced                              | Medium | Medium     | lessons.md (lesson on benchmarking the CPU limit on Workers for the packing algorithm); CLAUDE.md zod validation convention on API routes; hot-spot dir `src/lib/validation/` (7 commits/30d)                                        |

Risk #3 covers the mandatory abuse filter (authorization/access — IDOR);
the product has auth and persistent per-user data, so this row is required.

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                  | Must challenge                                                                                                                                                                        | Context `/10x-research` must ground                                                                                                                              | Likely cheapest layer                                                   | Anti-pattern to avoid                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| #1   | The heuristic change preserves the FR-010 invariant (never heavier-on-lighter) regardless of how the ordering changes                                        | "Tests still pass" ≠ "the refactor is safe" — existing tests may assert only _that a valid arrangement exists_, not the specific rule                                                 | Whether the broken "manual expectation" corresponds to FR-010 (a hard rule) or a soft preference (a golden-file candidate, explicitly marked as a behavior lock) | property-based (extending the existing `packer.property.test.ts`)       | A brute-force snapshot of the exact order, which only freezes current behavior                                     |
| #2   | No "fits" result appears when rotation/stacking is violated or max. payload is exceeded, even for boundary inputs                                            | "Existing packer/property tests already cover this" — they may test geometry and weight separately, not their combination into a single "fits" flag                                   | The exact point where the geometric and weight results merge into the fit/no-fit flag                                                                            | combined-invariant property test + a thin API integration test          | An expected value copied from the packer's current output instead of from an independent definition of correctness |
| #3   | A request as User A against a resource owned by User B is rejected on every exposed HTTP method                                                              | "The RLS policy exists in the migration, so the API is safe" — a bug in the route (a missing `user_id` filter, using the service-role key instead of anon+RLS) can bypass it entirely | Which Supabase client (anon+RLS vs. service-role) each route uses; the exact `using`/`with check` clauses; every HTTP method on `[id]` routes                    | integration (two different logged-in test users)                        | Testing only "a logged-out user gets 401," without testing "logged in as someone else gets 403/404"                |
| #4   | A request to a protected route while logged out is redirected before any protected content renders; same for an expired session mid-flow                     | "Manual testing during PR review is enough" — session expiry regresses silently on unrelated middleware changes                                                                       | The exact list of protected routes; the session/cookie shape from `@supabase/ssr`; the redirect target/status                                                    | integration (if the setup allows it), otherwise a thin e2e smoke test   | Testing only the happy path: "logged in, everything works"                                                         |
| #5   | Selecting a saved profile/template correctly prefills fields; saving/deleting updates the dropdown without a dead entry; a validation error reaches the user | "The zod schema tests already cover this" — they test the schema in isolation, not the component's wiring (fetch/select/submit state sync)                                            | The data/state-fetching pattern in the component; how validation errors are rendered; whether there's optimistic UI after save/delete                            | component test (tool to be confirmed by research) instead of a full e2e | Over-mocking the Supabase client to the point where the test only verifies mock calls                              |
| #6   | The API rejects out-of-bounds payloads with a clean validation error, never a silent 500/timeout; the documented CPU limit is actually enforced server-side  | "The client form already blocks bad data" — CLAUDE.md explicitly requires zod on API routes regardless of the client                                                                  | The current value/enforcement location of the limit; the exact zod schema bounds per field                                                                       | unit/contract (zod) + a thin integration test at the limit boundary     | A test's expected value copied from what the schema currently allows, instead of from the documented rule          |

## 3. Phased Rollout

Each row is a separate rollout phase that will open its own change folder via
`/10x-new`. Status moves left to right per the values below; the orchestrator
updates Status as artifacts appear on disk.

| #   | Phase name                                 | Goal (one line)                                                                                                          | Risks covered | Test types                                | Status        | Change folder                                    |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------- | ----------------------------------------- | ------------- | ------------------------------------------------ |
| 1   | Hardening fit-check correctness guarantees | Prove that the packing heuristic never reports a false "fits" and survives refactors without silent regression           | #1, #2        | property-based, unit (combined invariant) | change opened | `context/changes/testing-fit-check-correctness/` |
| 2   | Authorization and session boundary         | Prove that one user's data is inaccessible to another, and that protected routes actually protect                        | #3, #4        | integration                               | not started   | —                                                |
| 3   | Input validation and resource limit        | Prove that the API cleanly rejects boundary data and that the documented CPU limit is actually enforced                  | #6            | unit/contract, thin integration           | not started   | —                                                |
| 4   | Main UI flow coverage                      | Prove that selecting saved data, submitting, and validation errors in the fit-check form work and don't regress silently | #5            | component, possibly thin e2e              | not started   | —                                                |

**Status vocabulary** (fixed parser values): `not started` → `change opened`
→ `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

| Layer                    | Tool                 | Version | Notes                                                                                                                            |
| ------------------------ | -------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration       | Vitest               | ^5.0.0  | already configured, `npm run test`; currently 6 files, pure logic only in `src/lib/`                                             |
| property-based           | fast-check           | ^4.9.0  | already present as a devDependency, used in `packer.property.test.ts`                                                            |
| component (React)        | none yet             | —       | to be verified by research in §3 Phase 4                                                                                         |
| API/Supabase integration | none yet             | —       | to be verified by research in §3 Phase 2; local Supabase (`npx supabase start`) already available for dev                        |
| e2e                      | none yet             | —       | no decision yet; §3 Phase 4 will verify whether a thin e2e is needed at all — tool configuration is out of scope for this lesson |
| (optional) AI-native     | none in this session | n/a     | no MCP docs/search/browser dedicated to the stack available in the current session                                               |

**Stack grounding tools (current session):**

- Docs: none (Context7 unavailable this session); checked: 2026-09-13
- Search: general `WebSearch` available (not Exa) — unused at this stage, since there was no need to verify external documentation; checked: 2026-09-13
- Runtime/browser: none (Playwright MCP unavailable this session); checked: 2026-09-13
- Provider/platform: `gh` CLI available via Bash for CI inspection; no dedicated Cloudflare/Supabase MCP; checked: 2026-09-13

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase <N>" means the gate is enforced only once that
phase is rolled out; before that, the gate is `planned`.

| Gate                            | Where                  | Required?                                                                          | Catches                                        |
| ------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| lint + typecheck                | local + CI             | required (already wired in: ESLint type-checked rules + `astro build` in `ci.yml`) | syntax/type drift                              |
| unit (pure logic)               | local + CI             | required (already wired in: `npm run test` in `ci.yml`)                            | logic regressions                              |
| property-based (packing/weight) | local + CI             | required after §3 Phase 1                                                          | fit-check correctness invariant regressions    |
| integration (authz/middleware)  | local + CI             | required after §3 Phase 2                                                          | data leaking between users, auth bypass        |
| contract (API validation)       | local + CI             | required after §3 Phase 3                                                          | acceptance of invalid/boundary payloads        |
| component/e2e on main flow      | CI on PR               | required after §3 Phase 4                                                          | broken critical UI flow                        |
| post-edit hook                  | local (agent loop)     | recommended local (hook configuration out of scope for this lesson)                | regressions at edit time                       |
| multimodal visual review        | CI on PR               | optional, selective (1-3 screens, if needed at all)                                | visual issues skipped by deterministic diff    |
| pre-prod smoke                  | between merge and prod | optional                                                                           | environment-specific bugs (Cloudflare Workers) |

## 6. Cookbook Patterns

How to add new tests in this project. Each subsection fills in once the
corresponding rollout phase is implemented; until then the subsection reads
"TBD — see §3 Phase <N>."

### 6.1 Adding a unit test

- **Location**: colocated with the module under test, e.g. `src/lib/services/packing/`.
- **Naming**: `*.test.ts` for deterministic unit tests (Vitest); `*.property.test.ts` for randomized property tests (Vitest + fast-check). Both live next to the source file they cover, not in a separate `__tests__/` tree.
- **Reference tests**: `src/lib/services/packing/packer.property.test.ts` — `describe("runFitCheck property: combined correctness invariant (rotation + stacking + weight)")` for the property-test pattern (one property asserting several sub-invariants together against a single black-box result, rather than testing sub-functions in isolation); `src/lib/services/packing/packer.test.ts` — `it("free order: never places a rotatable heavier item above a lighter stackable item, even though rotation gives it a footprint that would geometrically fit there")` for the deterministic-scenario pattern (a hand-crafted input where only one geometric arrangement is possible, so the assertion pins a real correctness guarantee instead of restating the algorithm's current output).
- **Run command**: `npm run test` (whole suite) or `npx vitest run <path>` for a single file.
- **`numRuns` convention**: default `100` for a property test; raise to `~250` only for properties tied to a risk with a confirmed past incident (see `packer.property.test.ts`'s weight-cap, weight-based-stacking, combined-invariant, and EPSILON-boundary blocks) — leave properties without that history at the default to avoid inflating CI time without a corresponding signal gain.

### 6.2 Adding an integration test

- TBD — see §3 Phase 2 (pattern for authorization/IDOR and middleware tests).

### 6.3 Adding an e2e test

- TBD — see §3 Phase 4.

### 6.4 Adding a test for a new API endpoint

- TBD — see §3 Phase 3 (pattern for input validation and boundaries/limits).

### 6.5 Adding a test for a saved-data UI flow (React component)

- TBD — see §3 Phase 4.

### 6.6 Per-rollout-phase notes

(Optional. After each phase is implemented, `/10x-implement` adds 2-3 lines
here about anything surprising the phase taught — e.g. the tool chosen for
component tests, an established fixture pattern for two Supabase test users.)

**§3 Phase 1**: A property's `numRuns` count doesn't guarantee it exercises the scenario you care about — measure the catch rate empirically (reintroduce the bug, run N times, count failures) rather than trusting a single pass/fail. The packer's general-purpose `requestArb` (vehicle dims independent of item dims) rarely forces real stacking, so a combined property built on it caught a disabled FR-010 check in under a third of runs; a dedicated arbitrary that deliberately constrains geometry to force the scenario (`stackForcingArb` in `packer.property.test.ts`) raised that to 10/10.

## 7. What We Deliberately Don't Test

Interview question 5 (Phase 2) — "what not to spend the test budget on" —
was skipped by the user ("skip"). So there are no explicit exclusions yet
anchored in a real answer; forcing them in would mean inventing risk, which
this plan avoids.

This section will be filled in at the next `/10x-test-plan --refresh`, or
sooner if the user reports a specific exclusion.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-09-13
- Stack versions last verified: 2026-09-13
- AI-native tool references last verified: 2026-09-13

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
