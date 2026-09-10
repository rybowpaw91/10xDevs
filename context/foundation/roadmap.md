---
project: LoadFit
version: 1
status: draft
created: 2026-09-09
updated: 2026-09-10
prd_version: 1
main_goal: low-complexity
top_blocker: capacity
milestone_id: first-fit-check
milestone_seq: 1
milestone_status: open
---

# Roadmap: LoadFit

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: First fit-check** — Status: open

- **Intent:** Prove the core hypothesis end-to-end — a user can submit one goods list and one vehicle and get back a correct, trustworthy fit/no-fit result with a usable packing order and utilization percentage.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** S-01 is `done` — a logged-in user can submit a goods list and a vehicle's cargo dimensions and receive a correct fit/no-fit determination, a recommended packing order (text + lightweight grid), and a volume-utilization percentage.
- **Scope anchors:** US-01, FR-001, FR-002, FR-003, FR-004, FR-005 (the PRD's full must-have set).

## Vision recap

LoadFit replaces ad-hoc, by-eye or spreadsheet load planning for dispatchers, warehouse staff, and small transport-company owners who plan one vehicle, one load, one trip at a time. Today that manual step wastes cargo space, causes avoidable extra runs, and produces load-planning errors — and no accessible standalone tool exists outside enterprise WMS/ERP suites built for large fleets.

## North star

**S-01: User checks whether a goods list fits on a vehicle in a single trip** — the milestone's only must-have flow and the PRD's sole defined user story; the smallest end-to-end proof that automated, correct fit-checking actually works.

> North star — the smallest end-to-end slice whose successful delivery proves the core product hypothesis. Placed first, and as the entirety of this milestone's scope, because every later capability (exact trip counts, saved goods lists, saved vehicle profiles) only matters once this core check is correct and useful.

## At a glance

| ID   | Change ID              | Outcome (user can …)                                                              | Prerequisites | PRD refs                                | Status |
| ---- | ----------------------- | ----------------------------------------------------------------------------------- | -------------- | ---------------------------------------- | ------ |
| S-01 | `single-trip-fit-check` | Submit a goods list + vehicle and see fit/no-fit, a packing order, and utilization % | —              | US-01, FR-001, FR-002, FR-003, FR-004, FR-005 | done |

## Baseline

What's already in place in the codebase as of `2026-09-09` (auto-researched + user-confirmed).
No Foundations below re-scaffold these.

- **Frontend:** partial — Astro 6 + React 19 + Tailwind 4 scaffolded (`astro.config.mjs:8-11`), shadcn-style component base (`package.json`), file-based routing under `src/pages/`. Only auth + dashboard pages exist; no domain UI yet.
- **Backend / API:** partial — Astro SSR on the Cloudflare adapter (`astro.config.mjs:9,13`); API routes exist only for auth (`src/pages/api/auth/{signin,signup,signout}.ts`). No domain API routes yet.
- **Data:** absent — no `supabase/migrations/`, no `src/types.ts`, no ORM/query builder, no goods/vehicle/packing schema anywhere in `src/`.
- **Auth:** present — full email/password flow wired end-to-end via `@supabase/ssr` (`src/lib/supabase.ts`), session-aware middleware with route protection (`src/middleware.ts`), and matching UI pages.
- **Deploy / infra:** present — Cloudflare Workers via `wrangler`, GitHub Actions CI with auto-deploy on merge (per `tech-stack.md`), already configured and deployed to production per `context/foundation/infrastructure.md`.
- **Observability:** absent — only Cloudflare's default Workers Logs toggle is enabled (`wrangler.jsonc`); no app-level logging, error tracking, or dashboards.

## Foundations

No Foundations for this milestone. The baseline already covers everything S-01 depends on (auth, deploy, scaffold); the one genuinely absent layer — Data — isn't needed by S-01, which is a pure compute flow (submit → calculate → display, no persistence). Persistence only enters with the parked save/reuse capabilities (see `## Parked`), and when it does it belongs inside that specific vertical slice, not a pre-built generic data layer.

## Slices

### S-01: User checks whether a goods list fits on a vehicle in a single trip

- **Outcome:** user can enter a goods list (dimensions, quantity, rotation and stackable flags per item) and a vehicle's cargo dimensions, submit once, and see whether everything fits, a recommended packing order (text + lightweight grid), and the volume-utilization percentage.
- **Change ID:** `single-trip-fit-check`
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004, FR-005, NFR (result within a few seconds)
- **Prerequisites:** — (login is already handled by the present Auth baseline; this slice consumes it, doesn't build it)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the milestone's entire scope, so its correctness carries all the weight — the fit-check must never claim a fit that doesn't physically work (PRD's non-negotiable guardrail), even though heuristic false negatives are an accepted trade-off. Verification stays inside this slice rather than a separate foundation, per the low-complexity framing: keep the flow small, but the guardrail inside it is not negotiable.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID                | Suggested issue title                                        | Ready for `/10x-plan` | Notes |
| ---------- | ------------------------- | -------------------------------------------------------------- | ---------------------- | ----- |
| S-01       | `single-trip-fit-check`   | Single-trip fit check: goods + vehicle → fit result & packing order | yes                     | Run `/10x-plan single-trip-fit-check` |

## Open Roadmap Questions

_None._ The PRD's own `## Open Questions` section reported none, and the interview surfaced no cross-cutting sequencing questions for this milestone.

## Parked

- **Exact trip/vehicle count when goods don't fit (FR-006).** Why parked: nice-to-have; PRD's own Socrates resolution already demoted it below the must-have baseline (bare "doesn't fit," covered by FR-003). Deferred past M-1 under the low-complexity goal and the capacity blocker (solo, after-hours) — candidate for the next milestone.
- **Save and reuse a goods list (FR-007).** Why parked: nice-to-have; introduces the first persistence work (currently absent from the baseline). Deferred past M-1 for the same reason — candidate for the next milestone, scoped as its own vertical slice when it's picked up.
- **Save and reuse a vehicle profile (FR-008).** Why parked: nice-to-have, mirrors FR-007's rationale for a separate entity. Deferred past M-1 — candidate for the next milestone, independent of FR-007's slice so it can run in parallel with it then.
- **No 2D/3D visual load rendering.** Why parked: PRD Non-Goal — cut during MVP scoping after a timeline-cost check; explicit v2 candidate.
- **No weight/max-load constraint checking.** Why parked: PRD Non-Goal — cut during MVP scoping alongside visualization; explicit v2 candidate.
- **No multi-vehicle fleet assignment or managing multiple simultaneous loads.** Why parked: PRD Non-Goal — the locked persona plans one vehicle, one load, one trip at a time.

## Milestone History

_Empty — this is the first milestone._

## Done

- **S-01: user can enter a goods list (dimensions, quantity, rotation and stackable flags per item) and a vehicle's cargo dimensions, submit once, and see whether everything fits, a recommended packing order (text + lightweight grid), and the volume-utilization percentage.** — Archived 2026-09-10 → `context/archive/2026-09-09-single-trip-fit-check/`. Lesson: —.
