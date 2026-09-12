# Edit Saved Vehicle Profile Implementation Plan

## Overview

Implement roadmap slice S-01 (milestone M-4: Editable saved data): a logged-in user can edit a previously saved vehicle profile's label and dimensions in place, instead of the current delete-and-re-save-only workflow. Covers MS-01.

## Current State Analysis

- **`vehicle_profiles` has RLS enabled with only `SELECT`/`INSERT`/`DELETE` policies** — confirmed via migration history (`20260911092339_create_vehicle_profiles.sql`, `20260911142338_scope_vehicle_profiles_policies_to_authenticated.sql`). No `UPDATE` policy exists, so updates are denied by default today.
- **Neither `src/pages/api/vehicle-profiles/index.ts` nor `[id].ts` exports a `PATCH`/`PUT` handler** — confirmed by direct read; `index.ts` has `GET`/`POST`, `[id].ts` has `DELETE` only.
- **`VehicleProfile` (`src/types.ts`) and `vehicleProfileInputSchema` (`src/lib/validation/vehicle-profile-schema.ts`) need no field changes** — editing updates existing fields (label, length, width, height) only; the schema already validates exactly this shape for create and can be reused verbatim for update.
- **The saved-profiles list UI (`GoodsFitForm.tsx:496-519`) is a simple flex row per profile** (label + dimensions text + a delete button) — no inline-edit pattern exists anywhere in this codebase yet; this plan introduces the first one.
- **`handlePresetChange` (`GoodsFitForm.tsx:202-215`) already has the logic shape needed for live-form sync** — it sets `vehicle.length/width/height` from a selected profile's saved values; the edit-save handler needs the same kind of assignment when the edited profile's id matches `vehicle.presetId`.

### Key Discoveries:

- `src/lib/validation/vehicle-profile-schema.ts` exports `vehicleProfileInputSchema` — reusable as-is for the update body (per your confirmed decision: full object, same schema as create).
- `GoodsFitForm.tsx`'s `savedProfiles` state (`VehicleProfile[]`) and its `setSavedProfiles` setter are the single source of truth the edit flow updates on success, mirroring how `saveProfile`/`deleteProfile` already update it.
- The S-01 (M-2) impl-review established the pattern this plan follows exactly: RLS scoped `to authenticated` from the first migration (not a follow-up), and an explicit `context.locals.user` guard on every handler including the new one.

## Desired End State

In the saved-profiles list, each profile has an "Edit" (pencil) action alongside its existing delete action. Clicking it turns that row's label and three dimension fields into editable inputs with Save and Cancel actions. Clicking Save prompts a confirmation ("Overwrite this profile's saved values?" or similar) before actually saving; confirming sends the full updated object to `PATCH /api/vehicle-profiles/[id]`, and on success updates `savedProfiles` in place — and if that profile's id equals the currently-selected `vehicle.presetId`, also updates the live Length/Width/Height fields in the form above to match. Clicking Cancel discards the in-progress edit and reverts the row to its display state. Editing is private per user (RLS-enforced, verified against the local Supabase instance with two test accounts).

**Verification**: automated tests cover the new zod validation path (reusing existing schema, so this is really an integration-level check that the route wires it correctly) plus a unit-level confirmation that the migration's `UPDATE` policy exists with the right shape; manual verification confirms edit → confirm → list updates → live form syncs when applicable → cancel discards changes → a second test user cannot edit the first user's profile.

## What We're NOT Doing

- No editing for saved goods-item templates — that's S-02, a separate change (`edit-goods-item-template`), planned and implemented independently.
- No partial-field updates — the API always validates and replaces the full object (label + all three dimensions), matching create's validation exactly.
- Not folding in the parked in-dropdown delete UX fix for the vehicle-profile select — kept as a separate future follow-up, per your explicit decision.
- No change to the goods-item-template UI, the packing algorithm, or any other part of the fit-check feature.
- No uniqueness constraint on profile labels, no cap on saved profiles — unchanged from S-01 (M-2)'s existing behavior.

## Implementation Approach

Three phases, bottom-up: RLS policy first (independently verifiable against the local Supabase instance before any API code exists), then the API route, then the UI — mirroring the exact phase shape of every prior saved-entity slice in this project (M-2's S-01/S-02, M-3's S-01).

**Branching** (per CLAUDE.md's "Git workflow for changes"): all three phases are implemented on a branch named `edit-vehicle-profile`, created off `master` when `/10x-implement` starts. This plan itself is created and committed on `master`. Once Phase 3 is complete (and reviewed, if `/10x-impl-review` runs), merge `edit-vehicle-profile` back into `master` locally before archiving.

## Critical Implementation Details

### Confirmation step, not a native `confirm()`

Per your decision, saving an edit requires a confirmation step before the `PATCH` request fires — this is the first confirmation dialog anywhere in this app (delete actions elsewhere are fire-immediately). Use a small inline confirmation affordance consistent with the app's existing component set (e.g., the Save button's click first reveals an inline "Confirm overwrite? [Yes] [No]" state, or a shadcn `AlertDialog` if one is already available in `src/components/ui/` — implementer's call on the exact widget, but it must not be a bare browser `window.confirm()`, which is inconsistent with the rest of this app's UI).

### Live-form sync on successful edit

After a successful `PATCH`, if `vehicle.presetId === editedProfile.id`, update `vehicle.length/width/height` to the new saved values (mirroring the assignment shape already used in `handlePresetChange`). This must happen only on successful save, not optimistically, to avoid showing values that didn't actually persist if the request fails.

## Phase 1: Data Layer — UPDATE RLS Policy

### Overview

Add the missing `UPDATE` policy to `vehicle_profiles`, scoped `to authenticated` from the start.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_add_vehicle_profiles_update_policy.sql` (new — generate the timestamp via `date -u +%Y%m%d%H%M%S` at creation time)

**Intent**: Allow a user to update their own vehicle profiles, matching the existing per-operation RLS convention.

**Contract**: `create policy "vehicle_profiles_update_own" on vehicle_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);` — both `using` (which rows can be targeted) and `with check` (what the resulting row must satisfy) scoped to the owning user, matching the existing `INSERT`/`DELETE` policies' shape.

### Success Criteria:

#### Automated Verification:

- `npx supabase start` succeeds and the new migration applies cleanly
- `npm run lint` passes
- Type checking passes (no type changes expected, but confirm no regression)

#### Manual Verification:

- Inspect the applied migration and confirm exactly four policies now exist on `vehicle_profiles` (`SELECT`/`INSERT`/`DELETE`/`UPDATE`), all scoped `to authenticated`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API Route — PATCH Handler

### Overview

Expose an authenticated update endpoint for a single vehicle profile, behind the same validation schema used for create.

### Changes Required:

#### 1. Update route

**File**: `src/pages/api/vehicle-profiles/[id].ts`

**Intent**: Let the signed-in user update one of their saved vehicle profiles.

**Contract**: Add `export const PATCH: APIRoute`. Checks `context.locals.user` explicitly (401 if absent), validates `context.params.id` is a UUID via the existing `idSchema` (400 if not), parses and validates the JSON body against `vehicleProfileInputSchema` (400 with `z.treeifyError`-style messages on failure, matching the POST handler's pattern in `index.ts`), updates the row via the request-scoped Supabase client (RLS ensures only a row the caller owns can actually be updated), returns the updated row as JSON 200 on success; if no row was actually updated (not found or not owned), returns 404 — mirroring the existing `DELETE` handler's not-found handling in the same file.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds with the new handler present

#### Manual Verification:

- Authenticated `PATCH /api/vehicle-profiles/<id>` with a valid body returns 200 and the updated profile, and a subsequent `GET` reflects the change
- An invalid `PATCH` body (missing label, negative dimension) returns 400 with a clear message
- `PATCH` on a nonexistent or non-UUID id returns 404 / 400 respectively
- An unauthenticated `PATCH` request is redirected/rejected
- Against the local Supabase instance: a second test user's `PATCH` against the first user's profile id affects nothing and returns 404

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI Integration (Inline Edit)

### Overview

Add an inline edit affordance to the saved-profiles list: edit-in-place with a confirmation step before saving, and live-form sync when the edited profile is currently selected.

### Changes Required:

#### 1. Per-profile edit state and inline edit fields

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Let the user turn one saved profile's row into editable fields without disturbing the others or the main vehicle form.

**Contract**: A new piece of state tracks which profile (if any) is currently being edited, plus its in-progress draft values (label/length/width/height as strings, mirroring `VehicleState`'s string-field convention). When a profile's id matches the currently-edited id, its list row renders `Input`s (matching the existing style) instead of the plain label/dimensions text, plus Save and Cancel `Button`s replacing the Edit/Delete pair for that row only.

#### 2. Edit trigger, confirm-before-save, and cancel

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Wire the Edit/Save/Cancel actions to the draft state and the new PATCH endpoint.

**Contract**: An "Edit" `Button` (pencil icon, e.g. `Pencil` from `lucide-react`) per profile enters edit mode for that row, seeding the draft from the profile's current values. "Save" first shows/requires the confirmation step (per Critical Implementation Details), then validates the draft against `vehicleProfileInputSchema` client-side (surfacing errors the same way `saveProfile` does) and `PATCH`es `/api/vehicle-profiles/<id>`; on success, replaces the profile in `savedProfiles` with the updated row, exits edit mode, and — if `vehicle.presetId === id` — updates `vehicle.length/width/height` from the updated values (per Critical Implementation Details). "Cancel" exits edit mode without any request, discarding the draft.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds

#### Manual Verification:

- Clicking Edit on a saved profile turns its row into editable fields; other rows are unaffected
- Changing a value and clicking Save prompts a confirmation; confirming saves the change and the list shows the new values
- Declining the confirmation (or clicking Cancel before it) leaves the saved profile unchanged
- If the edited profile is currently selected in the vehicle preset dropdown, the Length/Width/Height fields above update to match after a successful save
- If the edited profile is not currently selected, the main form fields are untouched by the edit
- Signed-out visit to the fit-check page still redirects to sign-in (unchanged baseline)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- None new beyond what Phase 2 verifies manually — `vehicleProfileInputSchema` is already covered by existing tests from S-01 (M-2), and this plan reuses it unchanged for the update path.

### Integration Tests:

- None automated for the API layer in this slice (same rationale as every prior saved-entity slice — no HTTP test harness in this repo yet) — covered by Phase 2's manual verification, including the two-user RLS isolation check against the local Supabase instance.

### Manual Testing Steps:

1. Sign in, navigate to `/fit-check`.
2. Save a vehicle profile under a label.
3. Click Edit on it; change the label and one dimension; click Save; confirm the overwrite prompt.
4. Confirm the saved-profiles list shows the new values.
5. Select that same profile from the preset dropdown (if not already selected); confirm the Length/Width/Height fields above match the edited values.
6. Edit the same profile again but click Cancel before confirming; confirm nothing changed.
7. Using the local Supabase instance, confirm a second test user cannot edit the first user's profile (PATCH returns 404, no change).

## Performance Considerations

Trivial — a handful of rows per user, a single-row update.

## Migration Notes

Additive only — a new RLS policy on an existing table, no data migration. Rolling back means dropping the policy and removing the `PATCH` handler and edit UI; no impact on save/list/delete, which continue to work unchanged.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01, milestone M-4)
- Sibling implementation (structural precedent): `context/archive/2026-09-11-save-vehicle-profile/plan.md`
- Sibling impl-review (source of the RLS-`to authenticated`-from-the-start and explicit-auth-guard conventions this plan follows): `context/archive/2026-09-11-save-vehicle-profile/reviews/impl-review.md`
- Existing JSON API + zod pattern: `src/pages/api/vehicle-profiles/index.ts`
- Existing preset/profile prefill logic this plan extends: `src/components/fit-check/GoodsFitForm.tsx` (`handlePresetChange`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer — UPDATE RLS Policy

#### Automated

- [x] 1.1 `npx supabase start` succeeds and the migration applies cleanly — a4d6a89
- [x] 1.2 `npm run lint` passes — a4d6a89
- [x] 1.3 Type checking passes — a4d6a89

#### Manual

- [x] 1.4 Exactly four policies exist on `vehicle_profiles`, all scoped `to authenticated` — a4d6a89

### Phase 2: API Route — PATCH Handler

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 Type checking passes
- [x] 2.3 `npm run build` succeeds with the new handler present

#### Manual

- [x] 2.4 Authenticated PATCH updates a profile (200 + updated row); subsequent GET reflects the change
- [x] 2.5 Invalid PATCH body returns 400 with a clear message
- [x] 2.6 PATCH on a nonexistent/non-UUID id returns 404/400
- [x] 2.7 Unauthenticated PATCH is redirected/rejected
- [x] 2.8 Two-user RLS isolation confirmed against the local Supabase instance

### Phase 3: UI Integration (Inline Edit)

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 Type checking passes
- [ ] 3.3 `npm run build` succeeds

#### Manual

- [ ] 3.4 Edit turns one row into editable fields without affecting others
- [ ] 3.5 Save prompts confirmation; confirming persists the change and updates the list
- [ ] 3.6 Declining confirmation or clicking Cancel leaves the profile unchanged
- [ ] 3.7 Live form syncs when the edited profile is currently selected
- [ ] 3.8 Live form untouched when the edited profile is not selected
- [ ] 3.9 Signed-out visit still redirects to sign-in
