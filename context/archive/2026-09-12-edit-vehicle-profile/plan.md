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

### Addendum: Scope revision (2026-09-12) — dropdown-only UI, edit+delete in dropdown, max payload field

Mid-implementation of this phase, after the original inline-edit-in-a-list design above was already built and manually spot-checked, the user gave this feedback: *"do not list all currenty saved vehicles and items, it should be visible only in dropdown. Max payload should also be editable. Edit and remove from db icon should be in dropdown. Weight and payload should be also in db and be editable."* Follow-up clarification scoped this to vehicles only for this change (goods-item-template weight stays a separate future change, S-02), confirmed the edit affordance should open a modal dialog rather than editing inline in a list row, and confirmed a single Save-in-the-dialog action is enough — no extra confirmation step is needed beyond that.

This supersedes the original Phase 3 design described above (the separate saved-profiles management list, the confirm-before-save inline flow) and un-parks max payload, which "What We're NOT Doing" and the original plan's Overview had explicitly left out of scope. Concretely:

- **The separate saved-profiles list UI is removed entirely.** Saved vehicle profiles are visible only inside the vehicle preset `<Select>` dropdown, mirroring how `goods_item_templates` already work in this same component — there is no independent list section on the page anymore.
- **Edit and Delete actions live inside the dropdown**, not in a standalone list row. Each saved-profile `SelectItem` is a raw `SelectPrimitive.Item` (not the wrapped `SelectItem`) carrying two nested icon buttons (`Pencil` for edit, `Trash2` for delete, from `lucide-react`), each using `onPointerDown`/`onPointerUp`/`onClick` with `e.stopPropagation()` so clicking them doesn't also select that preset — the same nested-interactive-element pattern already used for template deletion in this component. Keyboard equivalents: `Delete`/`Backspace` deletes the focused item, `F2` opens it for editing (chosen over a printable key to avoid colliding with Radix Select's built-in typeahead).
- **Editing opens a modal `<Dialog>`** (shadcn `dialog.tsx`, newly installed) with Label, Length, Width, Height, and Max payload fields. Save calls the PATCH endpoint directly — no separate confirmation step (the original plan's "Confirmation step, not a native `confirm()`" critical detail is superseded by this decision). The now-unused `alert-dialog.tsx` (installed for the original design) was removed.
- **Max payload becomes a real, editable, database-backed field**, not merely UI-adjacent: a new nullable `max_payload numeric check (max_payload > 0)` column on `vehicle_profiles` (additive migration, no backfill — existing rows read back as `maxPayload: null`), required going forward by `vehicleProfileInputSchema` (`z.number().positive()`), threaded through `VehicleProfile` (`src/types.ts`), both API routes' `.select()` aliasing (`maxPayload:max_payload`) and insert/update payload construction (destructure `maxPayload` out, write back as `max_payload`), and the create form, dropdown display, and edit dialog in `GoodsFitForm.tsx`.
- **Live-form sync** is preserved from the original plan: a successful edit of the currently-selected profile updates `vehicle.length/width/height` *and now also* `vehicle.maxPayload` in the live form.

No changes to Phase 1 or Phase 2's RLS/PATCH-handler shape — this addendum only extends the row shape (one new column, one new field in the existing validation schema) and reworks Phase 3's UI.

#### Revised Manual Verification (supersedes the Phase 3 Manual Verification bullets above):

- Saved vehicle profiles appear only inside the vehicle preset dropdown — no separate list is visible anywhere on the page
- Each saved profile's dropdown entry shows working Edit (pencil) and Delete (trash) icon buttons that don't trigger preset selection when clicked
- Clicking Edit (or pressing `F2` on a focused profile) opens a modal dialog pre-filled with that profile's label, dimensions, and max payload
- Pressing `Delete`/`Backspace` on a focused profile deletes it without opening the dialog
- Changing values in the dialog and clicking Save persists the change and closes the dialog; the dropdown reflects the new label/dimensions immediately
- Cancel (or closing the dialog) discards the in-progress edit with no request sent
- If the edited profile is currently selected, the Length/Width/Height/Max payload fields in the main form update to match after a successful save
- If the edited profile is not currently selected, the main form fields are untouched by the edit
- Max payload is required and editable in both the create-profile flow and the edit dialog
- Signed-out visit to the fit-check page still redirects to sign-in (unchanged baseline)

Everything checkable via direct API calls — create/PATCH with `maxPayload`, rejection when `maxPayload` is missing, backward-compatible `null` on pre-existing rows — was already verified directly (see Progress 3.10-3.13) and does not need to be re-checked by hand. Only the genuinely browser-only items above (dropdown rendering, icon-button click isolation, `F2`/`Delete` keyboard behavior, modal open/close, visual live-form sync) require human confirmation.

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

- [x] 2.1 `npm run lint` passes — d3a284e
- [x] 2.2 Type checking passes — d3a284e
- [x] 2.3 `npm run build` succeeds with the new handler present — d3a284e

#### Manual

- [x] 2.4 Authenticated PATCH updates a profile (200 + updated row); subsequent GET reflects the change — d3a284e
- [x] 2.5 Invalid PATCH body returns 400 with a clear message — d3a284e
- [x] 2.6 PATCH on a nonexistent/non-UUID id returns 404/400 — d3a284e
- [x] 2.7 Unauthenticated PATCH is redirected/rejected — d3a284e
- [x] 2.8 Two-user RLS isolation confirmed against the local Supabase instance — d3a284e

### Phase 3: UI Integration (Dropdown-only edit/delete + max payload) — supersedes original inline-edit design, see addendum above

#### Automated

- [x] 3.1 `npm run lint` passes — 294483a
- [x] 3.2 Type checking passes — 294483a
- [x] 3.3 `npm run build` succeeds — 294483a
- [x] 3.10 `npm run test` passes (42/42, including new max-payload schema tests) — 294483a
- [x] 3.11 Verified via direct API calls against local Supabase: `POST` with `maxPayload` succeeds (201) and returns it; `POST` without `maxPayload` rejects (400) with a clear validation message — 294483a
- [x] 3.12 Verified via direct API calls: `PATCH` updating `maxPayload` succeeds (200) and returns the updated value — 294483a
- [x] 3.13 Verified via direct API calls: pre-existing rows created before the migration still `GET` correctly with `maxPayload: null` (backward compatibility) — 294483a

#### Manual

- [x] 3.4 Saved profiles appear only in the dropdown — no separate list is visible — 294483a
- [x] 3.5 Dropdown Edit/Delete icon buttons work and don't trigger preset selection — 294483a
- [x] 3.6 Edit (click or `F2`) opens the modal dialog pre-filled correctly; `Delete`/`Backspace` deletes without opening it — 294483a
- [x] 3.7 Save in the dialog persists the change and updates the dropdown; Cancel discards with no request sent — 294483a
- [x] 3.8 Live form (including max payload) syncs when the edited profile is currently selected, and is untouched when it is not — 294483a
- [x] 3.9 Signed-out visit still redirects to sign-in — 294483a
