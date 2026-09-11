# Save Goods Item Implementation Plan

## Overview

Implement roadmap slice S-02 (milestone M-2: Save and reuse): a logged-in user saves a single goods item — label, dimensions, whether it can be rotated, and whether other items can be stacked on it — as a reusable template from the fit-check page, sees a list of their saved item templates, and loads one back into the goods list (as a new row) on a later visit. This mirrors S-01 (`save-vehicle-profile`, already shipped and reviewed) closely, applying the same migration/RLS/API/UI pattern to a second, per-user entity.

This corrects an earlier misreading of FR-007: an initial implementation attempt (under the change-id `save-goods-list`) built list-level persistence — saving a whole goods list as one named set. That was discarded before any UI shipped (branch reset, orphaned table dropped) once it became clear the actual intent is item-level persistence — one saved row per reusable goods item, mirroring FR-008's vehicle-profile pattern.

## Current State Analysis

- **The vehicle-profile slice (S-01) already established the full pattern this plan reuses**: a small table with per-operation RLS policies scoped `to authenticated` (`supabase/migrations/20260911092339_create_vehicle_profiles.sql`, `20260911142338_scope_vehicle_profiles_policies_to_authenticated.sql`), a JSON API route pair (`src/pages/api/vehicle-profiles/{index,[id]}.ts`), and UI integration inside `GoodsFitForm.tsx` (fetch-on-mount, save control, management list with delete). This plan is a close structural mirror, not a new pattern.
- **The one real difference from S-01**: a vehicle profile prefills a single field group (one `<Select>` covers it), but a goods item template needs to become a *new row* in a list of rows — there's no single "the vehicle fields" to overwrite. `GoodsFitForm.tsx`'s `GoodsRowState`/`createRow`/`addRow` (lines 23-58, 140-144) already manage row creation via the `nextRowId` counter; loading a template means constructing one new `GoodsRowState` from the saved template and appending it via that same mechanism.
- **`src/types.ts`'s `GoodsItemInput` and `src/lib/validation/fit-check-schema.ts`'s `goodsItemSchema` already validate dimensions/rotatable/stackable for one item**, but include `id` (a client-side row key, not a template concern) and `quantity` (deliberately excluded from the template per this plan's Fields decision — quantity varies per shipment, so baking a stale value into a "reusable template" would be a footgun). The new template schema reuses `goodsItemSchema`'s dimension/flag validation via `.pick()` rather than redefining it, and adds `label`.
- **The S-01 impl-review recorded two fixes worth applying from the start here, not as a follow-up**: RLS policies scoped explicitly `to authenticated`, and an explicit `context.locals.user` guard on every handler (not just the mutating ones). It also flagged (F5, SKIPPED) a duplicated `jsonResponse` helper across route files as "not urgent enough to justify a refactor-only commit right now" — this plan keeps that helper local to its own two new route files rather than expanding scope to touch three existing, unrelated files.

### Key Discoveries:

- `src/lib/validation/fit-check-schema.ts` exports `goodsItemSchema` — its `length`/`width`/`height`/`rotatable`/`stackable` fields are reusable via `.pick()` for the template schema, avoiding re-declaring the same positive-number rules.
- `GoodsFitForm.tsx:140-144` (`addRow`) and `nextRowId` (`useRef(1)`, line 106) are the existing mechanism for appending a new row with a unique key; loading a template reuses this exact mechanism rather than inventing a second one.
- `GoodsFitForm.tsx:47-58` (`createRow`) shows a new row's default shape (`quantity: "1"`) — a row created from a loaded template starts with this same default quantity, since the template itself carries no quantity.
- The S-01 impl-review (`context/archive/2026-09-11-save-vehicle-profile/reviews/impl-review.md`) recorded the RLS-`to authenticated` and explicit-auth-guard fixes as findings applied after the fact; this plan builds both in from the first migration/route instead.

## Desired End State

On the fit-check page, each goods row gets a small "Save as template" action (alongside its existing Remove button) that persists that row's label, dimensions, rotatable, and stackable flags as a named, reusable template — quantity is not saved, since it varies per shipment. Saved templates appear in a compact management list (label + dimensions, a "Load" action, and a delete action) near the goods-list section header. Clicking "Load" appends a brand-new row to the goods list, prefilled from the template (quantity defaults to 1, same as any new row) — no existing row is touched or overwritten. Templates are private per user (RLS-enforced). No editing of a saved template, no cap on how many a user can save, duplicate labels allowed — full parity with S-01.

**Verification**: automated tests cover the new zod schema (valid input accepted; missing label, non-positive dimensions rejected); manual verification confirms save-from-a-row → appears in the management list → load appends a new row with dimensions/rotatable/stackable intact → delete removes it → a signed-out visit to the API is rejected → RLS scopes rows to the owning user (verified against the local Supabase instance, same as S-01).

## What We're NOT Doing

- No `quantity` field in the saved template — it's entered fresh on the row every time, since a stored quantity would usually be wrong for the current shipment.
- No editing of an existing saved template's contents (delete + re-save covers it, matching S-01's precedent).
- No cap on the number of saved templates per user, and no uniqueness constraint on labels (matching S-01).
- No "fill the current/focused row" loading mode — loading always appends a new row; there is no toggle, no row-targeting UI, and no confirmation dialog, since appending is non-destructive by construction.
- No per-row dropdown/inline "load from template" control — templates are loaded exclusively from the management list's "Load" action.
- Extracting the shared `jsonResponse` helper into `src/lib/http.ts` — S-01's own impl-review explicitly deferred this (F5, SKIPPED) as "not urgent enough to justify a refactor-only commit"; this plan keeps a local copy in its two new route files, consistent with the existing three call sites.
- No changes to the vehicle-profile slice (S-01), the packing algorithm, the fit-check API's request/response shape, or the weight-aware fit-check work queued for M-3.

## Implementation Approach

Structural mirror of S-01's three-phase, bottom-up approach (data layer → API → UI), reusing `goodsItemSchema`'s dimension/flag validation via `.pick()` instead of redefining it. Unlike S-01 (which extends the existing preset `<Select>`), this UI integration adds a new per-row action and a new management list, since goods items live in a list of rows rather than a single field group.

**Branching** (per CLAUDE.md's "Git workflow for changes"): all three phases are implemented on a branch named `save-goods-item`, created off `master` when `/10x-implement` starts. `/10x-new` and this plan itself were created directly on `master`, per that same convention. Once Phase 3 is complete (and reviewed, if `/10x-impl-review` runs), merge `save-goods-item` back into `master` locally before archiving.

## Critical Implementation Details

### RLS and auth-guard pattern (apply from the start, not as a follow-up)

Per the S-01 impl-review, this migration must scope its three policies (`SELECT`, `INSERT`, `DELETE`) explicitly `to authenticated` from the first version — no separate follow-up migration this time. Likewise, every route handler (including `GET` and `DELETE`, not just `POST`) must check `context.locals.user` explicitly and return 401 if absent, even though middleware and RLS already provide defense in depth.

### Loading a template reuses the existing row-key counter

`GoodsFitForm.tsx`'s `nextRowId` ref is the single source of unique row keys. Loading a template must draw its new row's key from this same counter (not a separate one), so keys never collide with manually-added rows regardless of what order the user adds/loads things in.

## Phase 1: Data Layer, Types & Validation Schema

### Overview

Stand up the `goods_item_templates` table with RLS and the shared type/schema every later phase builds on, reusing `goodsItemSchema`'s dimension/flag validation for the per-item shape.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_create_goods_item_templates.sql` (new — generate the timestamp via `date -u +%Y%m%d%H%M%S` at creation time)

**Intent**: Create the table backing saved goods-item templates, scoped per-user via RLS from the moment it exists, with policies scoped `to authenticated` from the start.

**Contract**: Table `goods_item_templates` with columns `id` (uuid, primary key, default `gen_random_uuid()`), `user_id` (uuid, references `auth.users`, not null), `label` (text, not null), `length`, `width`, `height` (numeric, not null, positive — a `CHECK` constraint mirroring the zod schema's `.positive()` rule), `rotatable` (boolean, not null), `stackable` (boolean, not null), `created_at` (timestamptz, default `now()`). RLS enabled; three policies (`SELECT`, `INSERT`, `DELETE`), each `to authenticated` with `using`/`with check (auth.uid() = user_id)`. No `UPDATE` policy (denies edits by default, matching "no editing" scope).

#### 2. Domain type

**File**: `src/types.ts`

**Intent**: Define the shared shape for a saved goods-item template.

**Contract**: Export `GoodsItemTemplate` (id, label, length, width, height, rotatable, stackable) alongside the existing types — same field set as `VehicleProfile` plus the two boolean flags, no `quantity`.

#### 3. Validation schema

**File**: `src/lib/validation/goods-item-template-schema.ts` (new)

**Intent**: Validate template-creation requests once, reusable by both the API route and the client-side per-row save action.

**Contract**: Export `goodsItemTemplateInputSchema` as `goodsItemSchema.pick({ length: true, width: true, height: true, rotatable: true, stackable: true }).extend({ label: z.string().min(1) })`, importing `goodsItemSchema` from `@/lib/validation/fit-check-schema` — no dimension/flag validation redefined.

### Success Criteria:

#### Automated Verification:

- `npx supabase start` succeeds and the new migration applies cleanly
- `npm run lint` passes
- Type checking passes with the new `GoodsItemTemplate` type and schema in place
- `npm run test` passes, including new unit tests for `goodsItemTemplateInputSchema` (valid input accepted; missing/empty label rejected; non-positive dimension rejected)

#### Manual Verification:

- Inspect the applied migration and confirm RLS is enabled with exactly the three documented policies, each scoped `to authenticated`, on `goods_item_templates`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Goods Item Templates API Routes

### Overview

Expose authenticated CRUD (create, list, delete — no update) for goods-item templates behind the validation schema and RLS from Phase 1.

### Changes Required:

#### 1. List & create route

**File**: `src/pages/api/goods-item-templates/index.ts` (new)

**Intent**: Let the signed-in user list their saved item templates and create a new one.

**Contract**: `export const prerender = false;`. Both `GET` and `POST` check `context.locals.user` explicitly and return 401 if absent (apply from the start, not as a follow-up). `GET` returns the current user's `goods_item_templates` rows (RLS-filtered), ordered newest-first. `POST` validates the body against `goodsItemTemplateInputSchema`, inserts a row with `user_id` from `context.locals.user.id` (never from the request body — same rule as S-01's `user_id` handling), returns the created row as JSON 201; validation failure returns 400 with `z.treeifyError`-style field messages. Includes a local `jsonResponse(body, status)` helper, matching the existing pattern in `vehicle-profiles/index.ts`.

#### 2. Delete route

**File**: `src/pages/api/goods-item-templates/[id].ts` (new)

**Intent**: Let the signed-in user delete one of their saved item templates.

**Contract**: `export const prerender = false;`. `DELETE` checks `context.locals.user` explicitly (401 if absent), validates `context.params.id` is a UUID via `z.uuid()` (400 if not), deletes via RLS-scoped query; if no row was actually deleted (not found or not owned), returns 404. Includes a local `jsonResponse` helper, matching `vehicle-profiles/[id].ts`.

#### 3. Route protection

**File**: `src/middleware.ts`

**Intent**: Ensure the new endpoints are only reachable by authenticated users.

**Contract**: Add `/api/goods-item-templates` to the `PROTECTED_ROUTES` array.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds with the new routes present

#### Manual Verification:

- Authenticated `POST /api/goods-item-templates` with a valid body returns 201 and the created template
- Authenticated `GET /api/goods-item-templates` returns the created template
- Authenticated `DELETE /api/goods-item-templates/<id>` removes it; subsequent `GET` no longer lists it
- An invalid `POST` body (missing label, non-positive dimension) returns 400 with a clear message
- An unauthenticated request to either route is redirected/rejected
- Against the local Supabase instance: a second test user cannot see or delete the first user's templates

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI Integration (Fit-Check Form)

### Overview

Wire saved goods-item templates into the existing goods-list UI on the fit-check page: fetch on load, per-row save, load-as-new-row, and delete.

### Changes Required:

#### 1. Fetch saved templates on mount

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Load the user's saved item templates once when the form mounts, mirroring the existing saved-profiles `useEffect`.

**Contract**: A second `useEffect` (alongside the existing saved-profiles one) fetches `GET /api/goods-item-templates` on mount into a new `savedItemTemplates` state array, with the same cancellation-on-unmount guard as the existing effect.

#### 2. Per-row "Save as template" action

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Let the user persist a specific row's label, dimensions, rotatable, and stackable flags as a reusable template, directly from that row.

**Contract**: A small icon `Button` (e.g. `Save` from `lucide-react`, matching the existing `Trash2` Remove button's placement/style) added to each row's action area. Clicking it validates that row's label/length/width/height/rotatable/stackable against `goodsItemTemplateInputSchema` client-side (surfacing errors the same way `saveProfile` does), then `POST`s to `/api/goods-item-templates` and adds the result to `savedItemTemplates` on success.

#### 3. Saved-item-templates management list with load and delete

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Give the user a way to see, load, and remove their saved item templates.

**Contract**: A compact list (one row per saved template: label + dimensions + a "Load" `Button` + a delete/trash `Button`), placed near the goods-list section header, styled consistently with the existing saved-profiles list. "Load" constructs one new `GoodsRowState` from the template (quantity defaults to `"1"`, same as `createRow`), draws its key from the existing `nextRowId` counter (per Critical Implementation Details), and appends it via the same mechanism `addRow` uses — no replacement of existing rows, no confirmation dialog. Delete calls `DELETE /api/goods-item-templates/<id>` and removes the row from `savedItemTemplates` on success.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds

#### Manual Verification:

- Saving a row's current values under a label adds it to the saved-item-templates management list
- Loading a saved template appends a new row with dimensions, rotatable, and stackable intact, and quantity defaulted to 1
- Loading a template when the form already has other rows correctly appends rather than overwriting them
- Deleting a saved template removes it from the management list
- Saving two templates with the same label is allowed
- Signed-out visit to the fit-check page still redirects to sign-in

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `goodsItemTemplateInputSchema`: valid input accepted; missing/empty label rejected; non-positive dimension rejected

### Integration Tests:

- None automated for the API layer in this slice (same rationale as S-01 — no HTTP test harness in this repo yet) — covered by Phase 2's manual verification, including the two-user RLS isolation check against the local Supabase instance.

### Manual Testing Steps:

1. Sign in, navigate to `/fit-check`.
2. Enter a goods row with dimensions and flags set; click its "Save as template" action under a label.
3. Confirm the template appears in the saved-item-templates management list with the correct dimensions.
4. Click "Load" on the saved template; confirm a new row is appended (existing rows untouched) with dimensions, rotatable, and stackable intact, and quantity defaulted to 1.
5. Delete the saved template; confirm it disappears from the management list.
6. Using the local Supabase instance, confirm a second test user cannot see or delete the first user's templates.

## Performance Considerations

Trivial — a handful of templates per user, each a small flat row; no pagination or indexing beyond the default primary key needed at this scale.

## Migration Notes

Additive only — a new table with no existing data to migrate. Rolling back means dropping the table and removing the new files and `PROTECTED_ROUTES` entry; no impact on the fit-check flow itself or on the vehicle-profile slice.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-02, milestone M-2)
- PRD: `context/foundation/prd-v3.md` (FR-007)
- Sibling implementation (structural precedent): `context/archive/2026-09-11-save-vehicle-profile/plan.md`
- Sibling impl-review (source of the RLS-role and auth-guard fixes applied here from the start): `context/archive/2026-09-11-save-vehicle-profile/reviews/impl-review.md`
- Existing JSON API + zod pattern: `src/pages/api/fit-check.ts`
- Existing middleware protection: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer, Types & Validation Schema

#### Automated

- [x] 1.1 `npx supabase start` succeeds and the migration applies cleanly
- [x] 1.2 `npm run lint` passes
- [x] 1.3 Type checking passes with new `GoodsItemTemplate` type and schema in place
- [x] 1.4 `npm run test` passes, including new `goodsItemTemplateInputSchema` unit tests

#### Manual

- [x] 1.5 RLS enabled with exactly the three documented policies, each scoped `to authenticated`

### Phase 2: Goods Item Templates API Routes

#### Automated

- [ ] 2.1 `npm run lint` passes
- [ ] 2.2 Type checking passes
- [ ] 2.3 `npm run build` succeeds with the new routes present

#### Manual

- [ ] 2.4 Authenticated POST creates a template (201 + created row)
- [ ] 2.5 Authenticated GET lists the created template
- [ ] 2.6 Authenticated DELETE removes it; subsequent GET confirms removal
- [ ] 2.7 Invalid POST body returns 400 with a clear message
- [ ] 2.8 Unauthenticated request is redirected/rejected
- [ ] 2.9 Two-user RLS isolation confirmed against the local Supabase instance

### Phase 3: UI Integration (Fit-Check Form)

#### Automated

- [ ] 3.1 `npm run lint` passes
- [ ] 3.2 Type checking passes
- [ ] 3.3 `npm run build` succeeds

#### Manual

- [ ] 3.4 Saving a row adds it to the management list
- [ ] 3.5 Loading appends a new row with dimensions/rotatable/stackable intact and quantity defaulted to 1
- [ ] 3.6 Loading with pre-existing rows appends rather than overwrites
- [ ] 3.7 Deleting removes the template from the management list
- [ ] 3.8 Duplicate labels allowed
- [ ] 3.9 Signed-out visit still redirects to sign-in
