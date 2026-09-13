---
project: LoadFit
version: 1
status: draft
created: 2026-09-09
updated: 2026-09-13
prd_version: 3
main_goal: low-complexity
top_blocker: capacity
milestone_id: editable-saved-data
milestone_seq: 4
milestone_status: done
---

# Roadmap: LoadFit

> Derived from the user's own description (anchors below) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-4: Editable saved data** — Status: done

- **Intent:** Let a user correct or update a saved vehicle profile or goods-item template in place, instead of the current delete-and-re-save-only workflow. Both tables were built save/list/delete-only in M-2, with no UPDATE RLS policy on either — this milestone adds real edit support to both.
- **Source materials:** user description (2026-09-12): "obecnie chce dodac mozliwosc edytowania zapisanych w bazie pojazdow i itemow" (want to add the ability to edit saved vehicles and items in the database).
- **Done when:** S-01 and S-02 are both `done` — a logged-in user can edit a saved vehicle profile's label/dimensions and a saved goods-item template's label/dimensions/rotatable/stackable, in place, from the fit-check page.
- **Scope anchors:**
  - MS-01: User can edit a saved vehicle profile (label, dimensions) instead of only delete + re-save.
  - MS-02: User can edit a saved goods-item template (label, dimensions, rotatable, stackable) instead of only delete + re-save.

## Vision recap

LoadFit replaces ad-hoc, by-eye or spreadsheet load planning for dispatchers, warehouse staff, and small transport-company owners who plan one vehicle, one load, one trip at a time. M-2 let users save vehicle profiles and goods-item templates to skip re-entering data; but neither can be corrected once saved — a typo or a changed vehicle spec means deleting the whole saved row and starting over. This milestone closes that gap.

## North star

**S-01: User edits a saved vehicle profile** — with both slices independent and no dependency between them, either could go first; this one is picked because it mirrors M-2's own S-01 (vehicle profile), which was built first there too and established the RLS/API pattern (`SELECT`/`INSERT`/`DELETE`) the whole app now follows — editing it first establishes the `UPDATE` half of that same pattern before S-02 reuses it.

> North star — the smallest end-to-end slice whose successful delivery proves the milestone's hypothesis (that in-place editing removes the delete-and-redo friction). Not more validation-critical than S-02, just sequenced first by precedent.

## At a glance

| ID   | Change ID                   | Outcome (user can …)                                                                 | Prerequisites | PRD refs | Status |
| ---- | ---------------------------- | -------------------------------------------------------------------------------------- | -------------- | -------- | ------ |
| S-01 | `edit-vehicle-profile`       | Edit a saved vehicle profile's label and dimensions in place                           | —              | MS-01    | done |
| S-02 | `edit-goods-item-template`   | Edit a saved goods-item template's label, dimensions, rotatable, and stackable in place | —              | MS-02    | done  |

## Baseline

What's already in place in the codebase as of `2026-09-12` (auto-researched — direct read of the relevant source files; user-confirmed).
No Foundations below re-scaffold these.

- **Frontend:** present — `src/components/fit-check/GoodsFitForm.tsx` already renders both saved-profile and saved-item-template management UI (select/dropdown, save, delete); neither has an edit affordance yet.
- **Backend / API:** partial — `src/pages/api/vehicle-profiles/{index,[id]}.ts` and `src/pages/api/goods-item-templates/{index,[id]}.ts` export only `GET`/`POST`/`DELETE` — confirmed via direct read, no `PUT`/`PATCH` handler exists on either route pair.
- **Data:** partial — both `vehicle_profiles` and `goods_item_templates` tables exist with RLS enabled, but only `SELECT`/`INSERT`/`DELETE` policies — confirmed via migration history, no `UPDATE` policy on either table, so updates are denied by default today.
- **Auth:** present — unchanged since M-1/M-2/M-3; both new slices consume it as-is.
- **Deploy / infra:** present — unchanged.
- **Observability:** absent — unchanged; not needed by either slice.

## Foundations

No Foundations for this milestone. Adding an `UPDATE` RLS policy + a `PATCH`/`PUT` route + edit UI is small and self-contained per table — each slice owns its own migration, matching M-2's own precedent of not building a shared foundation ahead of two small, independent, same-shaped slices.

## Slices

### S-01: User edits a saved vehicle profile

- **Outcome:** user can edit a previously saved vehicle profile's label and dimensions in place, instead of deleting and re-saving it.
- **Change ID:** `edit-vehicle-profile`
- **PRD refs:** MS-01
- **Prerequisites:** — (the `vehicle_profiles` table, its `SELECT`/`INSERT`/`DELETE` RLS, and its API/UI already exist from M-2's S-01; this slice adds `UPDATE`)
- **Parallel with:** S-02 (no shared dependency — separate table, separate route pair)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This table has never had an `UPDATE` RLS policy before — getting its per-user access-control policy right (scoped `to authenticated`, `auth.uid() = user_id` on both `using` and `with check`) matters more than the feature's small surface suggests, same category of risk M-2's S-01 flagged for its original `INSERT`/`DELETE` policies.
- **Status:** done

### S-02: User edits a saved goods-item template

- **Outcome:** user can edit a previously saved goods-item template's label, dimensions, whether it can be rotated, and whether other items can be stacked on it, in place, instead of deleting and re-saving it.
- **Change ID:** `edit-goods-item-template`
- **PRD refs:** MS-02
- **Prerequisites:** — (same reasoning as S-01: table/RLS/API/UI already exist from M-2's S-02, this slice adds `UPDATE`)
- **Parallel with:** S-01
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low — direct structural mirror of S-01 once its `UPDATE`-policy pattern exists (or built independently in parallel with the same shape).
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID                  | Suggested issue title                                | Ready for `/10x-plan` | Notes |
| ---------- | --------------------------- | ------------------------------------------------------ | ---------------------- | ----- |
| S-01       | `edit-vehicle-profile`      | Edit a saved vehicle profile in place                  | yes                    | Run `/10x-plan edit-vehicle-profile` |
| S-02       | `edit-goods-item-template`  | Edit a saved goods-item template in place              | yes                    | Run `/10x-plan edit-goods-item-template` |

Each Change ID above is implemented on its own branch of the same name, created when `/10x-implement` starts and merged back to `master` locally once the change is complete — see CLAUDE.md's "Git workflow for changes".

## Open Roadmap Questions

_None._ This milestone is self-described (no PRD to cross-check); no cross-cutting sequencing question surfaced during the interview.

## Parked

- **Exact trip/vehicle count when goods don't fit (FR-006).** Why parked: nice-to-have; PRD's own Socrates resolution already demoted it below the must-have baseline (bare "doesn't fit," covered by FR-003, done in M-1). Still the only uncovered PRD FR; candidate for a future milestone.
- **No 2D/3D visual load rendering.** Why parked: PRD Non-Goal — cut during MVP scoping after a timeline-cost check; explicit v2 candidate.
- **No multi-vehicle fleet assignment or managing multiple simultaneous loads.** Why parked: PRD Non-Goal — the locked persona plans one vehicle, one load, one trip at a time.
- **Apply the same in-dropdown delete UX to the saved vehicle-profile select (S-01 of M-2).** Why parked: user feedback during M-2's `save-goods-item` Phase 3 manual testing (2026-09-11) asked for saved goods-item templates to be deletable via a small icon button inside their dropdown option, instead of a separate management list — the vehicle-profile select still uses the older separate-list pattern. Candidate for a small follow-up change for UI consistency across both saved-entity types; could be folded into this milestone's S-01 if convenient since that slice already touches the vehicle-profile UI, but not required. See `context/archive/2026-09-11-save-goods-item/change.md` Notes.
- **Adding a weight field to saved goods-item templates (FR-007) and vehicle profiles (FR-008).** Why parked: not declared by any PRD FR — FR-007/FR-008 as written only cover label, dimensions, rotatable, stackable (goods items) and label, dimensions (vehicles). Deferred during `weight-aware-fit-check` planning (2026-09-12); revisit once it's clear whether re-typing weight every time a saved item/profile is used is actually a real friction point worth a follow-up change.

## Milestone History

- **M-1: First fit-check** (`first-fit-check`) — closed 2026-09-10. Proved the core hypothesis: a user can submit a goods list and a vehicle's cargo dimensions and receive a correct fit/no-fit determination, a packing order, and a volume-utilization percentage (S-01, `single-trip-fit-check`).
- **M-2: Save and reuse** (`save-and-reuse`) — closed 2026-09-11. A logged-in user can save a vehicle profile and a goods item template from the fit-check page, and run a full fit check by loading both from saved data instead of retyping them (S-01 `save-vehicle-profile`, S-02 `save-goods-item`).
- **M-3: Weight-aware loading** (`weight-aware-loading`) — closed 2026-09-12. A user's fit check is now weight-aware: exceeding the vehicle's maximum payload always means "doesn't fit" even if it fits by volume, the packing order never stacks a heavier item above a lighter one, and a weight-utilization percentage is shown alongside the volume one (S-01, `weight-aware-fit-check`).
- **M-4: Editable saved data** (`editable-saved-data`) — closed 2026-09-13. A logged-in user can edit a previously saved vehicle profile's label and dimensions in place, and edit a previously saved goods-item template's label, dimensions, rotatable, and stackable flags in place, instead of the delete-and-re-save-only workflow both had since M-2 (S-01 `edit-vehicle-profile`, S-02 `edit-goods-item-template`). Along the way, both tables also gained a previously-parked `weight`/`maxPayload` field, made editable too.

## Done

- **S-01: user can enter a goods list (dimensions, quantity, rotation and stackable flags per item) and a vehicle's cargo dimensions, submit once, and see whether everything fits, a recommended packing order (text + lightweight grid), and the volume-utilization percentage.** — Archived 2026-09-10 → `context/archive/2026-09-09-single-trip-fit-check/`. Lesson: —.
- **S-01: user can save a vehicle's cargo dimensions as a named profile from the fit-check page, and select that saved profile — alongside the existing hardcoded presets and manual entry — on a later visit to prefill the vehicle fields.** — Archived 2026-09-11 → `context/archive/2026-09-11-save-vehicle-profile/`. Lesson: —.
- **S-02: user can save a single goods item — label, dimensions, whether it can be rotated, whether other items can be stacked on it — as a reusable template from the fit-check page, and load a previously saved item template into the form on a later visit instead of re-entering its fields, mirroring S-01's vehicle-profile pattern applied to one goods item at a time.** — Archived 2026-09-11 → `context/archive/2026-09-11-save-goods-item/`. Lesson: —.
- **S-01: user can enter each goods item's weight and the vehicle's maximum payload alongside the existing dimension fields, submit once, and see: a fit determination where exceeding the vehicle's maximum payload always means "doesn't fit" (even if it fits by volume), a packing order that never places a heavier item above a lighter one, and a weight-utilization percentage shown next to the existing volume-utilization percentage.** — Archived 2026-09-12 → `context/archive/2026-09-12-weight-aware-fit-check/`. Lesson: —.
- **S-01: user can edit a previously saved vehicle profile's label and dimensions in place, instead of deleting and re-saving it.** — Archived 2026-09-13 → `context/archive/2026-09-12-edit-vehicle-profile/`. Lesson: —.
- **S-02: user can edit a previously saved goods-item template's label, dimensions, whether it can be rotated, and whether other items can be stacked on it, in place, instead of deleting and re-saving it.** — Archived 2026-09-13 → `context/archive/2026-09-13-edit-goods-item-template/`. Lesson: —.
