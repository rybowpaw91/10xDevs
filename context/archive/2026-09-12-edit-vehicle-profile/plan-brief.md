# Edit Saved Vehicle Profile — Plan Brief

> Full plan: `context/changes/edit-vehicle-profile/plan.md`

## What & Why

Roadmap slice S-01 of milestone M-4 (Editable saved data): a logged-in user can edit a previously saved vehicle profile's label and dimensions in place, instead of the current delete-and-re-save-only workflow. Covers MS-01.

## Starting Point

`vehicle_profiles` (from M-2's S-01) supports save/list/delete only — RLS has no `UPDATE` policy, and neither API route exports a `PATCH`/`PUT` handler. No field/type changes are needed; editing updates the same label/length/width/height that create already validates.

## Desired End State

Each saved profile in the list gets an "Edit" action. Clicking it turns that row into editable fields with Save/Cancel; Save asks for confirmation before overwriting, then persists via a new `PATCH` endpoint and updates the list — and if that profile is currently selected in the vehicle form above, the live Length/Width/Height fields update to match.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Edit UI shape | Inline edit within the saved-profiles list row | Self-contained — doesn't conflate the profile being edited with the main form's current fit-check inputs | Plan (user-confirmed) |
| Confirmation | Confirm before saving an overwrite | User's explicit choice — first confirmation dialog in this app, since an edit overwrites in place | Plan (user-confirmed) |
| API update semantics | Full object, same schema as create | One schema to maintain; the UI always shows all fields together anyway | Plan (user-confirmed) |
| Live-form sync | Update the main form's fields if the edited profile is currently selected | Avoids a stale-looking selected profile whose displayed dimensions no longer match what's saved | Plan (user-confirmed) |
| Fold in dropdown-delete UX fix? | No — keep this change focused on editing only | Keeps scope matching the Change ID exactly; the delete-UX fix stays a separate future follow-up | Plan (user-confirmed) |
| RLS policy shape | New `UPDATE` policy, scoped `to authenticated` from the start | Matches the already-corrected `INSERT`/`DELETE` policies' shape; no follow-up migration needed this time | Plan |

## Scope

**In scope:**
- New `UPDATE` RLS policy on `vehicle_profiles`
- `PATCH /api/vehicle-profiles/[id]`
- Inline edit UI (Edit/Save/Cancel per row) with confirm-before-save and live-form sync

**Out of scope:**
- Editing saved goods-item templates (that's S-02, a separate change)
- Partial-field updates
- The parked in-dropdown-delete UX fix for the vehicle-profile select
- Any change to the packing algorithm or fit-check API

## Architecture / Approach

Three phases, bottom-up (RLS → API → UI), mirroring the exact shape every prior saved-entity slice in this project used (M-2's S-01/S-02, M-3's S-01). No new types or shared schemas needed — `vehicleProfileInputSchema` is reused verbatim for the update path.

**Branching:** implemented on branch `edit-vehicle-profile` (created off `master` at `/10x-implement` start), merged back locally once complete.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Layer | `UPDATE` RLS policy on `vehicle_profiles` | Low — first `UPDATE` policy in the app, but same well-understood shape as the existing three |
| 2. API Route | `PATCH /api/vehicle-profiles/[id]` | Low — direct mirror of the existing `POST`/`DELETE` handlers |
| 3. UI Integration | Inline edit, confirm-before-save, live-form sync | New UI pattern (first inline-edit + first confirmation dialog in this app) — the two things actually worth getting right |

**Prerequisites:** None beyond the existing auth baseline and local Supabase/Docker (both already in place from M-2).
**Estimated effort:** ~2 focused sessions — Phase 3 is the only one with real UI-design surface.

## Open Risks & Assumptions

- The confirmation widget's exact shape (inline confirm vs. a shadcn `AlertDialog`) is left to the implementer — must not be a bare `window.confirm()`, per the plan's Critical Implementation Details, but no existing confirmation-dialog pattern exists in this codebase to copy from yet.

## Success Criteria (Summary)

- A user can edit a saved vehicle profile's label/dimensions in place, with a confirmation step before the change is persisted
- The main vehicle form stays in sync with the edited profile when it's the one currently selected
- Edits are genuinely private per user — RLS-enforced and verified with a real second test account
