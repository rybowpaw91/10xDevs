# Single-Trip Fit Check — Plan Brief

> Full plan: `context/changes/single-trip-fit-check/plan.md`

## What & Why

LoadFit's core hypothesis, proven end-to-end: a logged-in user submits one goods list and one vehicle and gets back a correct, trustworthy fit/no-fit result with a usable packing order and utilization percentage. This is the entirety of milestone M-1 (roadmap slice S-01) — the smallest slice that proves automated fit-checking actually works, before any save/reuse or exact-trip-count features are considered.

## Starting Point

The repo has a working Astro 6 + React 19 + Cloudflare Workers scaffold with full auth (login-protected `/dashboard` already works via `src/middleware.ts`), but zero domain code: no `src/types.ts`, no JSON API pattern (existing auth routes redirect after a form POST, not fetch/JSON), no zod usage, no test runner, and no dynamic-list form UI. This feature builds all of those for the first time.

## Desired End State

A signed-in user opens `/fit-check`, adds goods rows (dimensions, quantity, rotatable/stackable flags), picks a vehicle preset or types dimensions manually, and submits. Within seconds they see a fit/no-fit verdict, a text packing order plus a per-layer 2D grid, and a volume-only utilization %. An oversized single item is called out by name; more than 200 total units is rejected with a clear message before it reaches the algorithm.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Packing algorithm | Hand-rolled Extreme-Point heuristic (FFD-by-volume ordering) | Non-overlap enforced by construction, fully under our own test coverage — the correctness guardrail can't depend on an unaudited third-party package. |
| Vehicle input | Manual entry + a handful of hardcoded presets | Matches FR-002's "enter or select" wording without building persistence (parked as FR-008). |
| Output format | Per-layer 2D grid (top-down per height level) + text order | Visualizes stacking, which a single flat grid would hide, short of full 2D/3D rendering (explicit non-goal). |
| Oversized item handling | Fail fast with a named reason (pre-check before placement search) | Gives an actionable answer instead of a bare no-fit, and skips wasted placement work. |
| Support threshold | 100% base coverage required | Simplest to reason about and safest against the guardrail — no tunable "close enough" judgment call. |
| Scale cap | 200 total units, rejected above with a message | Keeps the heuristic comfortably sub-second on Cloudflare Workers per algorithm research; a hard, explicit limit beats a silent slowdown. |
| Testing rigor | Unit tests + fast-check property tests | Directly tests the "no false positives" guardrail across a wide random input space, not just hand-picked cases. |
| Input validation | Reject via zod, no clamping | Matches CLAUDE.md's documented (previously unused) convention; silently altering user input would undermine trust in the reported result. |
| Rotation semantics (plan-time decision, not asked) | `rotatable=true` → all 6 axis-aligned orientations eligible; `false` → only the entered orientation | PRD's boolean flag doesn't specify granularity; this is the standard simplification in the Extreme-Point heuristic literature and keeps the guardrail's contract testable. |

## Scope

**In scope:**
- Goods-list + vehicle-dimension input, including a small hardcoded vehicle-preset list
- Extreme-Point packing algorithm with rotation + 100%-stacking-support constraints
- Fit/no-fit verdict, text packing order, per-layer grid diagram, volume-only utilization %
- New JSON API route (first in this repo) + zod validation (first real use)
- Test runner setup (Vitest + fast-check — didn't exist before this change) wired into CI

**Out of scope:**
- Exact trip/vehicle count (FR-006), saved goods lists (FR-007), saved vehicle profiles (FR-008) — all parked for a later milestone
- 2D/3D visual rendering, weight/max-load checking, multi-vehicle fleet assignment (explicit PRD non-goals)
- Any persistence layer, database schema, or migrations
- Automated API-level (HTTP) integration tests — no test harness for Astro endpoints exists yet; covered manually instead

## Architecture / Approach

Four layers, built bottom-up: (1) test infrastructure + shared types + vehicle presets, (2) a pure, framework-free packing module (`src/lib/services/packing/`) fully covered by unit + property tests before anything else touches it, (3) a JSON API route (`/api/fit-check`) wrapping the packer behind zod validation and the existing auth middleware, (4) a React-island form + results UI on a new protected page (`/fit-check`), linked from the dashboard.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Test Infrastructure, Types & Presets | Vitest+fast-check wired into `npm test` and CI, `src/types.ts`, hardcoded vehicle presets | Low — pure scaffolding |
| 2. Packing Algorithm Core | Extreme-Point heuristic packer, fully unit + property tested | Highest risk — the correctness guardrail lives entirely here |
| 3. Fit-Check API Route | `/api/fit-check` JSON endpoint, zod schema, middleware protection | First JSON API + first zod usage in this repo — no precedent to lean on |
| 4. Fit-Check Page & Results UI | Dynamic goods-list form, preset dropdown, results view with per-layer grids | First dynamic list-field UI in this repo |

**Prerequisites:** None beyond the existing auth/deploy baseline, which this slice consumes but doesn't modify.
**Estimated effort:** ~4 focused sessions, one per phase, for a solo after-hours developer.

## Open Risks & Assumptions

- The rotation-semantics decision (6 orientations when rotatable) was made during planning, not confirmed with the user via a question round — flagged here in case real-world cargo constraints (e.g. "this side up" items) later prove it wrong.
- No automated HTTP-level test harness exists for the API route; correctness there relies on manual verification each phase, not CI.
- 200-unit cap is a planning-time estimate grounded in algorithm research, not a measured benchmark against the real Workers runtime — worth a quick timing check during Phase 2's manual verification.

## Success Criteria (Summary)

- A user can submit a goods list + vehicle and reliably get a correct fit/no-fit result — verified by property-based tests proving zero false positives across randomized inputs, not just hand-picked cases
- The full flow (form → API → algorithm → results UI) completes within a few seconds, matching the PRD's NFR
- Unauthenticated visitors cannot reach the feature, matching the existing dashboard's protection model
