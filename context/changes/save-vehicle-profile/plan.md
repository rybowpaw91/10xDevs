# Save Vehicle Profile Implementation Plan

## Overview

Implement roadmap slice S-01 (milestone M-2: Save and reuse): a logged-in user saves a vehicle's cargo dimensions as a named profile from the fit-check page, sees a list of their saved profiles, selects one to prefill the vehicle fields on a later visit — alongside the existing hardcoded presets and manual entry — and can delete a profile they no longer need. This is the app's first persistence-backed feature.

## Current State Analysis

- **No persistence exists anywhere in the app yet.** `supabase/migrations/` exists but is empty; no ORM/query builder; `src/types.ts` only carries the fit-check feature's request/response DTOs, no persisted-entity types.
- **The vehicle-input UI already has the exact integration point this slice extends**: `src/components/fit-check/GoodsFitForm.tsx:178-193` renders a `<Select>` populated from the hardcoded `VEHICLE_PRESETS` array (`src/lib/constants/vehicle-presets.ts`), with `handlePresetChange` (`GoodsFitForm.tsx:120-128`) prefilling the length/width/height fields on selection without locking them. Saved profiles need to slot into this same mechanism, not a parallel one.
- **The JSON API + zod pattern is already established**: `src/pages/api/fit-check.ts` sets `prerender = false`, parses `context.request.json()`, validates with a zod schema, and returns JSON. `src/lib/validation/fit-check-schema.ts` already exports a `vehicleDimensionsSchema` (positive length/width/height) this slice can extend rather than duplicate.
- **Auth is fully wired and reusable as-is**: `src/middleware.ts:4`'s `PROTECTED_ROUTES` array is the single hook point for protecting new routes; `context.locals.user` (typed in `src/env.d.ts`) is already populated by the time any route handler runs.
- **Local Supabase is available for development**: Docker is running and the Supabase CLI is installed, so the migration can be developed and verified against a local instance (`npx supabase start`) before it ever touches the deployed project.

### Key Discoveries:

- `GoodsFitForm.tsx:99` — `VehicleState` already carries a `presetId` field distinguishing "custom" from a selected preset; saved profiles need a parallel identifier space in the same `<Select>` (a `SelectGroup`/`SelectLabel` pair, not yet imported in this file, separates "Saved profiles" from the hardcoded preset list).
- `src/lib/validation/fit-check-schema.ts` exports `vehicleDimensionsSchema` — reusable via `.extend({ label: ... })` instead of redefining length/width/height validation.
- CLAUDE.md: "Always enable RLS on new tables with granular per-operation, per-role policies" and migration naming `YYYYMMDDHHmmss_short_description.sql` — both non-negotiable conventions for this slice's migration.
- `src/middleware.ts` resolves `context.locals.user` globally; API routes never need to call `supabase.auth.getUser()` themselves — they read `context.locals.user.id` directly.

## Desired End State

On the fit-check page, a user can type a label and click "Save current as profile" to persist the vehicle fields currently in the form. Their saved profiles appear both as a "Saved profiles" group in the existing vehicle `<Select>` (selecting one prefills the fields, still editable afterward, exactly like today's hardcoded presets) and as a small management list with a delete action per profile. Profiles are private per user (enforced by RLS, not just by client-side filtering). No editing/renaming of an existing profile, no cap on how many a user can save, and duplicate labels are allowed.

**Verification**: automated tests cover the new zod schema's validation rules; manual verification confirms save → appears in both the select group and the management list → prefills correctly → delete removes it from both places → a signed-out visit to the API is rejected → RLS actually scopes rows to the owning user (verified against the local Supabase instance).

## What We're NOT Doing

- No editing/renaming an existing saved profile (FR-008 doesn't ask for it; delete + re-save covers the same need at lower scope).
- No cap on the number of saved profiles per user.
- No uniqueness constraint on profile labels — the database row id is the real identity; duplicate labels are visually disambiguated by their dimensions, exactly like the existing hardcoded presets already do.
- No changes to the goods-list save/reuse slice (S-02) — this plan covers vehicle profiles only.
- No changes to the packing algorithm, the fit-check API's request/response shape, or the weight-aware fit-check work queued for M-3.

## Implementation Approach

Bottom-up, mirroring the pattern the fit-check feature already established: data layer (migration + RLS) and shared types/validation first, then the API routes that enforce them, then the UI that consumes both. Each phase is independently verifiable — the migration and RLS policy can be verified against a local Supabase instance before any API code exists, and the API can be verified with `curl`/browser fetch before the UI exists to obscure its behavior.

## Critical Implementation Details

### RLS policy shape

Per CLAUDE.md's "granular per-operation, per-role policies" rule, the migration must define separate `SELECT`, `INSERT`, and `DELETE` policies (each `USING`/`WITH CHECK (auth.uid() = user_id)`), not a single blanket policy. No `UPDATE` policy is created — with RLS enabled and no `UPDATE` policy present, updates are denied by default, which correctly matches this slice's "no editing" scope without needing an explicit deny rule.

### User id source for INSERT

The API route must set `user_id` from `context.locals.user.id` (already resolved by `src/middleware.ts` before any route handler runs) — it must never trust a `user_id` field from the request body, since that would let a request claim a profile on another user's behalf before RLS even gets a chance to evaluate the insert.

## Phase 1: Data Layer, Types & Validation Schema

### Overview

Stand up the `vehicle_profiles` table with RLS and the shared types/schema every later phase builds on.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_vehicle_profiles.sql` (new — generate the timestamp via `date -u +%Y%m%d%H%M%S` at creation time, per CLAUDE.md's naming convention)

**Intent**: Create the table backing saved vehicle profiles, scoped per-user via RLS from the moment it exists.

**Contract**: Table `vehicle_profiles` with columns `id` (uuid, primary key, default `gen_random_uuid()`), `user_id` (uuid, references `auth.users`, not null), `label` (text, not null), `length`, `width`, `height` (numeric, not null, positive — a `CHECK` constraint mirroring the zod schema's `.positive()` rule), `created_at` (timestamptz, default `now()`). RLS enabled on the table; three policies (`SELECT`, `INSERT`, `DELETE`) each scoped to `auth.uid() = user_id` per the Critical Implementation Details above.

#### 2. Domain type

**File**: `src/types.ts`

**Intent**: Define the shared shape for a saved vehicle profile so the API routes and UI speak the same type.

**Contract**: Export `VehicleProfile` (id, label, length, width, height — dimensions in centimeters, matching the existing `VehicleDimensionsInput` convention) alongside the existing fit-check types.

#### 3. Validation schema

**File**: `src/lib/validation/vehicle-profile-schema.ts` (new)

**Intent**: Validate profile-creation requests once, reusable by both the API route and the client-side save control.

**Contract**: Export `vehicleProfileInputSchema` built from `vehicleDimensionsSchema.extend({ label: z.string().min(1) })` (imported from `@/lib/validation/fit-check-schema`), rather than redefining the dimension checks.

### Success Criteria:

#### Automated Verification:

- `npx supabase start` succeeds and the new migration applies cleanly (`npx supabase migration up` or an implicit `db reset`)
- `npm run lint` passes
- Type checking passes (`npx astro check` or `npx tsc --noEmit`) with the new `VehicleProfile` type and schema in place
- `npm run test` passes, including new unit tests for `vehicleProfileInputSchema` (valid input accepted; missing label, non-positive dimensions, and non-string label all rejected)

#### Manual Verification:

- Inspect the applied migration in Supabase Studio (local instance) and confirm RLS is enabled with exactly the three documented policies on `vehicle_profiles`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Vehicle Profiles API Routes

### Overview

Expose authenticated CRUD (create, list, delete — no update) for vehicle profiles behind the validation schema and RLS from Phase 1.

### Changes Required:

#### 1. List & create route

**File**: `src/pages/api/vehicle-profiles/index.ts` (new)

**Intent**: Let the signed-in user list their saved profiles and create a new one.

**Contract**: `export const prerender = false;`. `GET` returns the current user's `vehicle_profiles` rows (via the request-scoped Supabase client — RLS filters to the owner automatically) as JSON, ordered newest-first. `POST` parses and validates the JSON body against `vehicleProfileInputSchema`, inserts a row with `user_id` set from `context.locals.user.id` (never from the request body, per Critical Implementation Details), and returns the created row as JSON with a 201; a validation failure returns 400 with field-level messages, following the same `z.treeifyError` pattern `src/pages/api/fit-check.ts` already uses.

#### 2. Delete route

**File**: `src/pages/api/vehicle-profiles/[id].ts` (new)

**Intent**: Let the signed-in user delete one of their saved profiles.

**Contract**: `export const prerender = false;`. `DELETE` validates `context.params.id` is a UUID (reject non-UUID with 400), then deletes the matching row — RLS ensures only a row the caller owns can actually be deleted, so a request naming another user's profile id deletes nothing and should return 404 (row not found from the caller's perspective) rather than a generic success.

#### 3. Route protection

**File**: `src/middleware.ts`

**Intent**: Ensure the new endpoints are only reachable by authenticated users, matching every other domain route.

**Contract**: Add `/api/vehicle-profiles` to the `PROTECTED_ROUTES` array (the existing prefix-match already covers both `index.ts` and `[id].ts` under that path).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds with the new routes present

#### Manual Verification:

- Authenticated `POST /api/vehicle-profiles` with a valid body returns 201 and the created profile
- Authenticated `GET /api/vehicle-profiles` returns the created profile in the list
- Authenticated `DELETE /api/vehicle-profiles/<id>` removes it, and a subsequent `GET` no longer lists it
- An invalid `POST` body (missing label, negative dimension) returns 400 with a clear message
- An unauthenticated request to either route is redirected/rejected per the middleware's existing protected-route behavior
- Against the local Supabase instance: create a second test user, confirm they cannot see or delete the first user's profile (list comes back empty for them; delete by the first user's profile id affects nothing)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI Integration (Fit-Check Form)

### Overview

Wire saved profiles into the existing vehicle-input UI on the fit-check page: fetch on load, select-to-prefill, save-current, and delete.

### Changes Required:

#### 1. Fetch saved profiles on mount

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Load the user's saved profiles once when the form mounts, so both the select group and the management list have data to render.

**Contract**: A `useEffect` (first use of the hook in this file) fetches `GET /api/vehicle-profiles` on mount and stores the result in a new `savedProfiles` state array; a save or delete action updates this same state (optimistically or via refetch — implementer's call) so the UI stays in sync without a full page reload.

#### 2. "Saved profiles" group in the vehicle select

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Let a saved profile prefill the vehicle fields exactly like a hardcoded preset does, without the two lists being visually confused.

**Contract**: Import `SelectGroup`/`SelectLabel` from `@/components/ui/select` (already used by other consumers of that component) and render saved profiles as their own labeled group inside the existing `<SelectContent>`, alongside the current "Custom / manual entry" item and the `VEHICLE_PRESETS` list. `handlePresetChange`'s lookup extends to check `savedProfiles` in addition to `VEHICLE_PRESETS` so selecting a saved profile prefills length/width/height the same way, still editable afterward.

#### 3. Save-current-as-profile control

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Let the user persist whatever is currently in the vehicle length/width/height fields under a label they choose.

**Contract**: A label `Input` plus a "Save profile" `Button` near the vehicle section; on click, validates the current vehicle field values plus the label against `vehicleProfileInputSchema` client-side (surfacing the same messages the API would return), then `POST`s to `/api/vehicle-profiles` and adds the result to `savedProfiles` on success.

#### 4. Saved-profiles management list

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Give the user a way to see and remove their saved profiles independent of the select dropdown.

**Contract**: A compact list (one row per saved profile: label + dimensions + a delete/trash `Button`), styled consistently with the existing goods-row cards. Deleting calls `DELETE /api/vehicle-profiles/<id>` and removes the row from `savedProfiles` on success; a confirmation is not required (low-stakes, easily re-saved data).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds

#### Manual Verification:

- Saving the current vehicle fields under a label adds it to both the select group and the management list
- Selecting a saved profile from the select prefills length/width/height, and the fields remain editable afterward
- Deleting a saved profile removes it from both the select group and the management list
- Saving two profiles with the same label is allowed and both are distinguishable by their shown dimensions
- Signed-out visit to the fit-check page still redirects to sign-in (unchanged from M-1/M-2's S-02 baseline)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `vehicleProfileInputSchema`: valid input accepted; missing/empty label rejected; non-positive or non-numeric dimensions rejected

### Integration Tests:

- None automated for the API layer in this slice (no HTTP test harness exists yet in this repo, consistent with the fit-check feature's own Phase 3) — covered by the manual verification steps in Phase 2 instead, including the two-user RLS isolation check against the local Supabase instance.

### Manual Testing Steps:

1. Sign in, navigate to `/fit-check`.
2. Enter vehicle dimensions manually, save them as a profile under a label.
3. Confirm the profile appears in the "Saved profiles" select group and in the management list.
4. Reload the page (or navigate away and back); confirm the saved profile is still there (persisted, not just in-memory).
5. Select the saved profile from the dropdown; confirm it prefills the fields and they remain editable.
6. Delete the profile; confirm it disappears from both the select group and the management list.
7. Using the local Supabase instance, create a second test user and confirm they cannot see or delete the first user's profiles.

## Performance Considerations

Trivial — a handful of rows per user, no pagination or indexing beyond the default primary key needed at this scale.

## Migration Notes

Additive only — a new table with no existing data to migrate. Rolling back means dropping the table (or reverting the migration) and removing the new files and `PROTECTED_ROUTES` entry; no impact on the fit-check flow itself, which continues to work with manual entry and hardcoded presets regardless.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01, milestone M-2)
- PRD: `context/foundation/prd-v2.md` (FR-008)
- Existing preset-select pattern (extended, not replaced): `src/components/fit-check/GoodsFitForm.tsx:178-193`
- Existing JSON API + zod pattern: `src/pages/api/fit-check.ts`
- Existing middleware protection: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer, Types & Validation Schema

#### Automated

- [x] 1.1 `npx supabase start` succeeds and the migration applies cleanly — 72cfccc
- [x] 1.2 `npm run lint` passes — 72cfccc
- [x] 1.3 Type checking passes with new `VehicleProfile` type and schema in place — 72cfccc
- [x] 1.4 `npm run test` passes, including new `vehicleProfileInputSchema` unit tests — 72cfccc

#### Manual

- [x] 1.5 RLS enabled with exactly the three documented policies, confirmed in Supabase Studio — 72cfccc

### Phase 2: Vehicle Profiles API Routes

#### Automated

- [x] 2.1 `npm run lint` passes — 0496477
- [x] 2.2 Type checking passes — 0496477
- [x] 2.3 `npm run build` succeeds with the new routes present — 0496477

#### Manual

- [x] 2.4 Authenticated POST creates a profile (201 + created row) — 0496477
- [x] 2.5 Authenticated GET lists the created profile — 0496477
- [x] 2.6 Authenticated DELETE removes it; subsequent GET confirms removal — 0496477
- [x] 2.7 Invalid POST body returns 400 with a clear message — 0496477
- [x] 2.8 Unauthenticated request is redirected/rejected — 0496477
- [x] 2.9 Two-user RLS isolation confirmed against the local Supabase instance — 0496477

### Phase 3: UI Integration (Fit-Check Form)

#### Automated

- [x] 3.1 `npm run lint` passes
- [x] 3.2 Type checking passes
- [x] 3.3 `npm run build` succeeds

#### Manual

- [x] 3.4 Saving adds the profile to both the select group and the management list
- [x] 3.5 Selecting a saved profile prefills editable fields
- [x] 3.6 Deleting removes the profile from both places
- [x] 3.7 Duplicate labels allowed and visually distinguishable by dimensions
- [x] 3.8 Signed-out visit still redirects to sign-in
