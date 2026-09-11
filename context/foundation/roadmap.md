---
project: LoadFit
version: 1
status: draft
created: 2026-09-09
updated: 2026-09-11
prd_version: 3
main_goal: low-complexity
top_blocker: capacity
milestone_id: weight-aware-loading
milestone_seq: 3
milestone_status: open
---

# Roadmap: LoadFit

> Derived from `context/foundation/prd-v3.md` (v3) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-3: Weight-aware loading** — Status: open

- **Intent:** Extend the core fit-check (M-1) so weight is a first-class feasibility constraint, not just volume — a "fits" result must also respect the vehicle's maximum payload, the packing order must never stack a heavier item above a lighter one, and the user sees a weight-utilization percentage alongside the existing volume-utilization one.
- **Source materials:** `context/foundation/prd-v3.md` (v3). FR-009/FR-010/FR-011 were added when the user reversed the original MVP scope cut on weight/max-load checking; FR-001 and FR-002 were amended in the same pass to add per-item weight and vehicle maximum payload as inputs. This milestone was explicitly parked for exactly this sequencing point — see M-2's `## Parked` entry (carried into this file's own Milestone History) and the note on FR-009/010/011: "open as its own milestone (M-3) immediately after M-2 closes."
- **Done when:** S-01 is `done` — a logged-in user can enter each goods item's weight and the vehicle's maximum payload, submit once, and get a fit determination, packing order, and utilization readout that are all weight-aware, not just volume-aware.
- **Scope anchors:** FR-001 (amended), FR-002 (amended), FR-009, FR-010, FR-011.

## Vision recap

LoadFit replaces ad-hoc, by-eye or spreadsheet load planning for dispatchers, warehouse staff, and small transport-company owners who plan one vehicle, one load, one trip at a time. M-1 proved the core fit-check hypothesis using volume alone; the PRD's own guardrails are explicit that a "fits" result is only trustworthy once weight is accounted for too — a load can fit by volume and still be over the vehicle's legal payload, and a geometrically-stable stack can still be dangerous if a heavy item sits on a light one.

## North star

**S-01: Fit check accounts for weight** — the only slice this milestone needs.

> North star — the smallest end-to-end slice whose successful delivery proves the milestone's hypothesis (that treating weight as a hard feasibility constraint, not an afterthought, produces trustworthy results). Here it's also the entire milestone: every FR this milestone covers is tightly coupled enough that there's no smaller meaningful cut.

## At a glance

| ID   | Change ID              | Outcome (user can …)                                                                                                    | Prerequisites | PRD refs                          | Status |
| ---- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------- | ---------------------------------- | ------ |
| S-01 | `weight-aware-fit-check` | Enter each item's weight and the vehicle's max payload, and get a fit/packing/utilization result that's weight-aware, not just volume-aware | —              | FR-001, FR-002, FR-009, FR-010, FR-011, US-01 | ready  |

## Baseline

What's already in place in the codebase as of `2026-09-11` (auto-researched — direct read of the relevant source files during this session, plus confirmation from M-1/M-2's own baselines).
No Foundations below re-scaffold these; this milestone needs none.

- **Frontend:** present (for this milestone's needs) — `src/components/fit-check/GoodsFitForm.tsx` already has per-row inputs (length/width/height/quantity/rotatable/stackable) and a vehicle-dimensions section; `src/components/fit-check/FitCheckResult.tsx` already renders the fit/no-fit banner, packing order, and volume-utilization line. Neither has any weight field or weight-utilization line yet — this milestone adds them to existing sections, not new ones.
- **Backend / API:** present (for this milestone's needs) — `src/pages/api/fit-check.ts` and `src/lib/validation/fit-check-schema.ts` already establish the JSON API + zod pattern this milestone extends; `goodsItemSchema`/`vehicleDimensionsSchema` have zero weight fields today.
- **Data:** not applicable — the fit-check computation itself is stateless (request in, result out, nothing persisted); this was true before M-1 and remains true here. (Contrast with M-2's saved profiles/templates, which do persist — see the Parked note below on whether those should also gain weight.)
- **Business logic:** absent — confirmed by direct read of `src/lib/services/packing/packer.ts` and `src/lib/services/packing/support.ts`: the packing algorithm's placement/support logic is purely geometric today; `isFullySupported` checks only footprint overlap, with zero awareness of mass. This is the actual surface this milestone's slice touches.
- **Auth:** present — unchanged since M-1/M-2; this milestone doesn't touch persistence or access control at all.
- **Deploy / infra:** present — unchanged since M-1/M-2.
- **Observability:** absent — unchanged; not needed by this milestone's slice.

## Foundations

No Foundations for this milestone. Every FR this milestone covers (FR-001 amendment, FR-002 amendment, FR-009, FR-010, FR-011) is business logic and type/schema surface inside the already-shipped, stateless fit-check feature — there is no new cross-cutting layer to unlock. Adding a foundation ahead of S-01 would mean pre-building part of the one slice that needs it, which the roadmap's own scope-cap rule for Foundations rules out.

## Slices

### S-01: Fit check accounts for weight

- **Outcome:** user can enter each goods item's weight and the vehicle's maximum payload alongside the existing dimension fields, submit once, and see: a fit determination where exceeding the vehicle's maximum payload always means "doesn't fit" (even if it fits by volume), a packing order that never places a heavier item above a lighter one, and a weight-utilization percentage shown next to the existing volume-utilization percentage.
- **Change ID:** `weight-aware-fit-check`
- **PRD refs:** FR-001, FR-002, FR-009, FR-010, FR-011, US-01
- **Prerequisites:** — (builds entirely on the already-shipped, stateless M-1 fit-check feature; no auth or persistence changes needed)
- **Parallel with:** — (only slice in this milestone)
- **Blockers:** —
- **Unknowns:**
  - Should the already-shipped saved goods-item templates (FR-007) and vehicle profiles (FR-008) also gain a weight field in this milestone, so loading a saved item/profile doesn't leave weight blank and require re-entry every time? — Owner: user. Block: no (S-01 is fully shippable and verifiable without deciding this — weight can simply be typed fresh on every submission, same as any other field before a template/profile covers it; this is a scope-widening option, not a dependency).
- **Risk:** Extends the core packing heuristic's placement/support logic (not just a post-hoc pass/fail gate) to also weigh mass when deciding what can stack on what — a larger algorithmic surface than a simple weight-cap check alone, but already scoped and accepted via the PRD's own Socrates resolution on FR-010 ("the user explicitly wants weight to affect packing order, not just a pass/fail gate; the increased algorithmic scope is deliberate, not incidental").
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID                | Suggested issue title                                  | Ready for `/10x-plan` | Notes |
| ---------- | ------------------------- | ------------------------------------------------------- | ---------------------- | ----- |
| S-01       | `weight-aware-fit-check`  | Make the fit check weight-aware (max payload + stacking) | yes                    | Run `/10x-plan weight-aware-fit-check` |

Each Change ID above is implemented on its own branch of the same name, created when `/10x-implement` starts and merged back to `master` locally once the change is complete — see CLAUDE.md's "Git workflow for changes".

## Open Roadmap Questions

_None._ The PRD's own `## Open Questions` section reported none. The one real open decision this milestone surfaced (whether saved templates/profiles should also carry weight) is scoped to S-01 alone, not cross-cutting, so it lives in that slice's Unknowns instead of here.

## Parked

- **Exact trip/vehicle count when goods don't fit (FR-006).** Why parked: nice-to-have; PRD's own Socrates resolution already demoted it below the must-have baseline (bare "doesn't fit," covered by FR-003, done in M-1). Not requested for this milestone — candidate for a future one.
- **No 2D/3D visual load rendering.** Why parked: PRD Non-Goal — cut during MVP scoping after a timeline-cost check; explicit v2 candidate.
- **No multi-vehicle fleet assignment or managing multiple simultaneous loads.** Why parked: PRD Non-Goal — the locked persona plans one vehicle, one load, one trip at a time.
- **Apply the same in-dropdown delete UX to the saved vehicle-profile select (S-01 of M-2).** Why parked: user feedback during M-2's `save-goods-item` Phase 3 manual testing (2026-09-11) asked for saved goods-item templates to be deletable via a small icon button inside their dropdown option, instead of a separate management list — the vehicle-profile select still uses the older separate-list pattern. Candidate for a small follow-up change for UI consistency across both saved-entity types. See `context/archive/2026-09-11-save-goods-item/change.md` Notes.
- **Adding a weight field to saved goods-item templates (FR-007) and vehicle profiles (FR-008).** Why parked: not declared by any PRD FR — FR-007/FR-008 as written only cover label, dimensions, rotatable, stackable (goods items) and label, dimensions (vehicles). Surfaced as an Unknown on S-01 instead of invented as new scope; revisit once S-01 ships and it's clear whether re-typing weight every time a saved item/profile is used is actually a real friction point worth a follow-up change.

## Milestone History

- **M-1: First fit-check** (`first-fit-check`) — closed 2026-09-10. Proved the core hypothesis: a user can submit a goods list and a vehicle's cargo dimensions and receive a correct fit/no-fit determination, a packing order, and a volume-utilization percentage (S-01, `single-trip-fit-check`).
- **M-2: Save and reuse** (`save-and-reuse`) — closed 2026-09-11. A logged-in user can save a vehicle profile and a goods item template from the fit-check page, and run a full fit check by loading both from saved data instead of retyping them (S-01 `save-vehicle-profile`, S-02 `save-goods-item`).

## Done

- **S-01: user can enter a goods list (dimensions, quantity, rotation and stackable flags per item) and a vehicle's cargo dimensions, submit once, and see whether everything fits, a recommended packing order (text + lightweight grid), and the volume-utilization percentage.** — Archived 2026-09-10 → `context/archive/2026-09-09-single-trip-fit-check/`. Lesson: —.
- **S-01: user can save a vehicle's cargo dimensions as a named profile from the fit-check page, and select that saved profile — alongside the existing hardcoded presets and manual entry — on a later visit to prefill the vehicle fields.** — Archived 2026-09-11 → `context/archive/2026-09-11-save-vehicle-profile/`. Lesson: —.
- **S-02: user can save a single goods item — label, dimensions, whether it can be rotated, whether other items can be stacked on it — as a reusable template from the fit-check page, and load a previously saved item template into the form on a later visit instead of re-entering its fields, mirroring S-01's vehicle-profile pattern applied to one goods item at a time.** — Archived 2026-09-11 → `context/archive/2026-09-11-save-goods-item/`. Lesson: —.
