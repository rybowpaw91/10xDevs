---
project: LoadFit
version: 1
status: draft
created: 2026-09-09
updated: 2026-09-11
prd_version: 2
main_goal: low-complexity
top_blocker: capacity
milestone_id: save-and-reuse
milestone_seq: 2
milestone_status: open
---

# Roadmap: LoadFit

> Derived from `context/foundation/prd-v2.md` (v2) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-2: Save and reuse** — Status: open

- **Intent:** Let a user skip re-entering data on repeat fit checks by saving and reusing both vehicle profiles and goods lists. The two capabilities are independent, parallelizable slices, but the milestone's real value — a fit check run entirely from previously saved data, no manual re-entry — only lands once both are done.
- **Source materials:** `context/foundation/prd-v2.md` (v2). Scope unchanged from the original v1-sourced generation — FR-007/FR-008 wording is identical in v2, so S-01/S-02 carry forward as-is. v2 also adds FR-009/010/011 (weight-aware fit checking), which is a distinct outcome unrelated to save/reuse — see `## Parked`.
- **Done when:** S-01 and S-02 are both `done` — a logged-in user can save a vehicle profile and a goods list from the fit-check page, and on a later visit run a full fit check by selecting both from saved data instead of typing them in again.
- **Scope anchors:** FR-007, FR-008.

## Vision recap

LoadFit replaces ad-hoc, by-eye or spreadsheet load planning for dispatchers, warehouse staff, and small transport-company owners who plan one vehicle, one load, one trip at a time. M-1 proved the core fit-check hypothesis; this milestone removes the next-biggest friction the PRD names — re-typing the same vehicle and goods list every time the tool is used.

## North star

**S-01: User saves a vehicle profile and reuses it in a later fit check** — the PRD's own Socrates dialogue names this exact pain point directly ("ad-hoc entry is repetitive if the same vehicle is reused"), the clearest textual signal in the document for what to build first in this milestone.

> North star — the smallest end-to-end slice whose successful delivery proves the milestone's hypothesis (that saving data removes real re-entry friction). S-01 is placed first because the PRD articulates its pain point most directly, but it has no dependency on S-02 — the two can be built in either order or in parallel, and the milestone's full value requires both.

## At a glance

| ID   | Change ID             | Outcome (user can …)                                                                       | Prerequisites | PRD refs | Status |
| ---- | ---------------------- | -------------------------------------------------------------------------------------------- | -------------- | -------- | ------ |
| S-01 | `save-vehicle-profile` | Save a vehicle's cargo dimensions as a named profile and select it on a later fit check       | —              | FR-008   | in-progress |
| S-02 | `save-goods-list`      | Save the current goods list as a named set and load it back into the form on a later visit    | —              | FR-007   | ready  |

## Baseline

What's already in place in the codebase as of `2026-09-10` (auto-researched + user-confirmed; re-checked since M-1 shipped).
No Foundations below re-scaffold these.

- **Frontend:** partial — Astro 6 + React 19 + Tailwind 4, shadcn set now includes `button`/`input`/`checkbox`/`label`/`select`/`card` (`src/components/ui/`). The fit-check page and form (`src/pages/fit-check.astro`, `src/components/fit-check/`) are the first domain UI pattern this milestone extends.
- **Backend / API:** partial — first JSON API precedent now exists (`src/pages/api/fit-check.ts`, `prerender = false`, zod-validated) alongside the legacy `formData()` + redirect auth routes. This milestone's endpoints should follow the JSON pattern, not the legacy one.
- **Data:** absent — `supabase/migrations/` exists but is empty; no ORM/query builder; no persistence entities in `src/types.ts`. `tech-stack.md` names PostgreSQL via Supabase as the chosen provider, just not wired into any domain schema yet.
- **Auth:** present — full email/password flow via `@supabase/ssr` (`src/lib/supabase.ts`), session-aware middleware with route protection (`src/middleware.ts`). Both new slices consume this as-is; every saved row must be scoped to the owning user via RLS.
- **Deploy / infra:** present — Cloudflare Workers via `wrangler`, GitHub Actions CI with auto-deploy on merge, already configured and deployed to production per `context/foundation/infrastructure.md`.
- **Observability:** absent — unchanged since M-1; not needed by either slice in this milestone.

## Foundations

No Foundations for this milestone. Data is the only absent layer either slice needs, but each slice's persistence need is small and self-contained (one table each, no shared schema or shared migration) — building a generic "data layer" foundation ahead of either slice would complete more of the layer than either slice actually requires. Each slice creates its own table and RLS policy as part of its own plan, following the per-operation, per-role RLS convention CLAUDE.md already documents.

## Slices

### S-01: User saves a vehicle profile and reuses it in a later fit check

- **Outcome:** user can save a vehicle's cargo dimensions as a named profile from the fit-check page, and select that saved profile — alongside the existing hardcoded presets and manual entry — on a later visit to prefill the vehicle fields.
- **Change ID:** `save-vehicle-profile`
- **PRD refs:** FR-008
- **Prerequisites:** — (Auth is present and this slice consumes it; the fit-check page it extends is already done; the slice creates its own minimal schema, so Data's absence isn't a blocking prerequisite)
- **Parallel with:** S-02 (no shared dependency — the PRD's own Socrates note on FR-008 explicitly frames it as independent of FR-007's slice)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the app's first persistence-backed feature — even though the schema itself is small (one table: id, user, label, dimensions), this slice sets the RLS/migration pattern every later persistence feature will follow, so getting the per-user access-control policy right here matters more than the feature's small surface suggests.
- **Status:** in-progress

### S-02: User saves a goods list and reuses it in a later fit check

- **Outcome:** user can save the current goods list — all line items — as a named set from the fit-check page, and load a previously saved list back into the form on a later visit instead of re-entering every item.
- **Change ID:** `save-goods-list`
- **PRD refs:** FR-007
- **Prerequisites:** — (same reasoning as S-01: Auth present, fit-check page already done, this slice owns its own schema)
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** More schema surface than S-01 — a saved list holds multiple items, not one flat row, so the child-table-vs-JSONB-column tradeoff needs a deliberate call during `/10x-plan` (affects how easily individual saved items can be edited later). Doesn't block sequencing; just a design decision to make explicitly rather than default into.
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID              | Suggested issue title                                          | Ready for `/10x-plan` | Notes |
| ---------- | ----------------------- | ------------------------------------------------------------- | ---------------------- | ----- |
| S-01       | `save-vehicle-profile`  | Save & reuse vehicle profile on the fit-check page             | yes                    | Run `/10x-plan save-vehicle-profile` |
| S-02       | `save-goods-list`       | Save & reuse goods list on the fit-check page                  | yes                    | Run `/10x-plan save-goods-list` |

## Open Roadmap Questions

_None._ The PRD's own `## Open Questions` section reported none, and this milestone's interview surfaced no cross-cutting sequencing questions.

## Parked

- **Exact trip/vehicle count when goods don't fit (FR-006).** Why parked: nice-to-have; PRD's own Socrates resolution already demoted it below the must-have baseline (bare "doesn't fit," covered by FR-003, done in M-1). Not requested for this milestone — candidate for a future one.
- **No 2D/3D visual load rendering.** Why parked: PRD Non-Goal — cut during MVP scoping after a timeline-cost check; explicit v2 candidate.
- **Weight-aware fit checking (FR-009, FR-010, FR-011 in `prd-v2.md`).** Why parked: no longer a PRD Non-Goal as of v2 — promoted to must-have — but not folded into M-2 because it's a distinct outcome (extends the core fit-check from M-1: a hard weight-capacity cap on feasibility, a heavier-below-lighter packing-order rule, and a weight-utilization percentage) unrelated to save/reuse, M-2's actual theme. User-confirmed sequencing (2026-09-11): open as its own milestone (M-3) immediately after M-2 closes.
- **No multi-vehicle fleet assignment or managing multiple simultaneous loads.** Why parked: PRD Non-Goal — the locked persona plans one vehicle, one load, one trip at a time.

## Milestone History

- **M-1: First fit-check** (`first-fit-check`) — closed 2026-09-10. Proved the core hypothesis: a user can submit a goods list and a vehicle's cargo dimensions and receive a correct fit/no-fit determination, a packing order, and a volume-utilization percentage (S-01, `single-trip-fit-check`).

## Done

- **S-01: user can enter a goods list (dimensions, quantity, rotation and stackable flags per item) and a vehicle's cargo dimensions, submit once, and see whether everything fits, a recommended packing order (text + lightweight grid), and the volume-utilization percentage.** — Archived 2026-09-10 → `context/archive/2026-09-09-single-trip-fit-check/`. Lesson: —.
