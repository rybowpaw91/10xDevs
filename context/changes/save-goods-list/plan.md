# Save Goods List Implementation Plan

## Overview

Implement roadmap slice S-02 (milestone M-2: Save and reuse): a logged-in user saves the current goods list — all line items, including their dimensions, quantity, and rotatable/stackable flags — as a named set from the fit-check page, sees a list of their saved goods lists, and loads one back into the form (appended to whatever's already there) on a later visit. This mirrors S-01 (`save-vehicle-profile`, already shipped and reviewed) almost exactly, applying the same migration/RLS/API/UI pattern to a second entity.

## Current State Analysis

- **The vehicle-profile slice (S-01) already established the full pattern this plan reuses**: a small table with per-operation RLS policies (`supabase/migrations/20260911092339_create_vehicle_profiles.sql`, `20260911142338_scope_vehicle_profiles_policies_to_authenticated.sql`), a JSON API route pair (`src/pages/api/vehicle-profiles/{index,[id]}.ts`), and UI integration inside `GoodsFitForm.tsx` (fetch-on-mount, save control, management list with delete). This plan is a close structural mirror, not a new pattern.
- **The one real difference**: a vehicle profile is a flat row (3 numbers + a label); a goods list is a *list* of line items. `src/types.ts` already defines `GoodsItemInput` (id, length, width, height, quantity, rotatable, stackable) — the exact shape each saved line item needs — and `src/lib/validation/fit-check-schema.ts` already exports `goodsItemSchema`, the zod schema for one such item. Both are reusable directly; no new item-level type or schema needed.
- **The goods-list section of the UI already exists and is well-understood**: `src/components/fit-check/GoodsFitForm.tsx`'s `GoodsRowState`/`createRow`/`addRow`/`removeRow`/`updateRow` (lines 23-58, 140-152) manage the in-form goods rows. Loading a saved list means constructing new `GoodsRowState` entries from saved data and appending them via the same `nextRowId` counter mechanism already in place — not a new state-management approach.
- **The impl-review of S-01 flagged one pattern-consistency gap worth fixing here, not deferring again**: the small `jsonResponse(body, status)` helper is now duplicated across `src/pages/api/fit-check.ts` and both `vehicle-profiles` route files. That review's own recommendation was to extract it "next time this pattern is touched" — this plan is that next time.

### Key Discoveries:

- `src/lib/validation/fit-check-schema.ts` exports `goodsItemSchema` — reusable via `z.array(goodsItemSchema)` for the saved list's items, avoiding a near-duplicate schema.
- `src/types.ts` exports `GoodsItemInput` — reusable directly as the saved list's item type; no new per-item type needed.
- The S-01 impl-review (`context/archive/2026-09-11-save-vehicle-profile/reviews/impl-review.md`) recorded two fixes worth applying from the start here rather than as a follow-up: RLS policies scoped explicitly `to authenticated`, and an explicit `context.locals.user` guard on every handler (not just the mutating ones).
- `GoodsFitForm.tsx:107` — `nextRowId` (a `useRef(1)` counter) is the existing mechanism for generating unique row keys; loading a saved list's items reuses this same counter rather than inventing a second one.

## Desired End State

On the fit-check page, a user can type a label and click "Save current goods list" to persist whatever line items are currently in the goods-list section. Their saved lists appear in a management list (label + item count, a "Load" action, and a delete action) near the goods-list section. Clicking "Load" appends that saved list's items to whatever rows are already in the form — nothing already entered is replaced or lost, and no confirmation dialog is needed since appending is non-destructive. Lists are private per user (RLS-enforced). No editing of a saved list's contents, no cap on how many a user can save, duplicate labels allowed.

**Verification**: automated tests cover the new zod schema (a list needs at least one item, each item validated the same way `fitCheckRequestSchema` already validates one); manual verification confirms save → appears in the management list → load appends the correct rows with all fields intact (dimensions, quantity, rotatable, stackable) → delete removes it → a signed-out visit to the API is rejected → RLS scopes rows to the owning user (verified against the local Supabase instance, same as S-01).

## What We're NOT Doing

- No editing of an existing saved list's contents (delete + re-save covers it, matching S-01's precedent).
- No cap on the number of saved lists per user, and no uniqueness constraint on labels (matching S-01).
- No "replace" mode for loading — loading always appends; there is no toggle or confirmation dialog, since append is non-destructive by construction.
- No per-item editing within a saved list before loading — the whole list loads as-is; the user edits the resulting form rows afterward if needed, same as they would with manually-entered rows.
- No changes to the vehicle-profile slice (S-01), the packing algorithm, the fit-check API's request/response shape, or the weight-aware fit-check work queued for M-3.

## Implementation Approach

Structural mirror of S-01's three-phase, bottom-up approach (data layer → API → UI), reusing existing types/schemas wherever the shape already matches (`GoodsItemInput`, `goodsItemSchema`) instead of redefining them. Phase 2 also extracts the shared `jsonResponse` helper other routes already use, addressing the one pattern-consistency gap S-01's review surfaced, so all four JSON API routes converge on one implementation.

**Branching** (per CLAUDE.md's "Git workflow for changes"): all three phases are implemented on a branch named `save-goods-list`, created off `master` when `/10x-implement` starts. `/10x-new` and this plan itself were created directly on `master`, per that same convention. Once Phase 3 is complete (and reviewed, if `/10x-impl-review` runs), merge `save-goods-list` back into `master` locally before archiving.

## Critical Implementation Details

### Storage shape: one table, JSONB items column

A goods list is a label plus an ordered array of items — normalizing this into a parent `goods_lists` table plus a child `goods_list_items` table would add joins and multi-statement writes for zero benefit, since editing individual saved items is explicitly out of scope (delete + re-save is the only mutation path, same as S-01). A single `goods_lists` table with an `items jsonb` column stores the whole list atomically in one insert and one delete — no child table.

### RLS and auth-guard pattern (apply from the start, not as a follow-up)

Per the S-01 impl-review, this migration must scope its three policies (`SELECT`, `INSERT`, `DELETE`) explicitly `to authenticated` from the first version — no separate follow-up migration this time. Likewise, every route handler (including `GET` and `DELETE`, not just `POST`) must check `context.locals.user` explicitly and return 401 if absent, even though middleware and RLS already provide defense in depth — consistency across all four route handlers (two existing, two new) is the point.

### Loading a saved list reuses the existing row-key counter

`GoodsFitForm.tsx`'s `nextRowId` ref is the single source of unique row keys. Loading a saved list's items must draw new keys from this same counter (not a separate one), so keys never collide with manually-added rows regardless of what order the user adds/loads things in.

## Phase 1: Data Layer, Types & Validation Schema

### Overview

Stand up the `goods_lists` table with RLS and the shared type/schema every later phase builds on, reusing `GoodsItemInput`/`goodsItemSchema` for the per-item shape.

### Changes Required:

#### 1. Migration

**File**: `supabase/migrations/20260911145107_create_goods_lists.sql` (new)

**Intent**: Create the table backing saved goods lists, scoped per-user via RLS from the moment it exists, with policies scoped `to authenticated` from the start (per Critical Implementation Details — no follow-up migration needed this time).

**Contract**: Table `goods_lists` with columns `id` (uuid, primary key, default `gen_random_uuid()`), `user_id` (uuid, references `auth.users`, not null), `label` (text, not null), `items` (jsonb, not null), `created_at` (timestamptz, default `now()`). RLS enabled; three policies (`SELECT`, `INSERT`, `DELETE`), each `to authenticated` with `using`/`with check (auth.uid() = user_id)`. No `UPDATE` policy (denies edits by default, matching "no editing" scope).

#### 2. Domain type

**File**: `src/types.ts`

**Intent**: Define the shared shape for a saved goods list, reusing `GoodsItemInput` for its items.

**Contract**: Export `SavedGoodsList` (id, label, items: `GoodsItemInput[]`) alongside the existing types.

#### 3. Validation schema

**File**: `src/lib/validation/goods-list-schema.ts` (new)

**Intent**: Validate list-creation requests once, reusable by both the API route and the client-side save control.

**Contract**: Export `goodsListInputSchema` as `z.object({ label: z.string().min(1), items: z.array(goodsItemSchema).min(1) })`, importing `goodsItemSchema` from `@/lib/validation/fit-check-schema` — no per-item validation redefined.

### Success Criteria:

#### Automated Verification:

- `npx supabase start` succeeds and the new migration applies cleanly
- `npm run lint` passes
- Type checking passes with the new `SavedGoodsList` type and schema in place
- `npm run test` passes, including new unit tests for `goodsListInputSchema` (valid input accepted; empty items array rejected; missing label rejected; an invalid item within the array rejected)

#### Manual Verification:

- Inspect the applied migration and confirm RLS is enabled with exactly the three documented policies, each scoped `to authenticated`, on `goods_lists`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Goods Lists API Routes

### Overview

Expose authenticated CRUD (create, list, delete — no update) for goods lists behind the validation schema and RLS from Phase 1, and extract the shared `jsonResponse` helper other routes already duplicate.

### Changes Required:

#### 1. Shared JSON response helper

**File**: `src/lib/http.ts` (new)

**Intent**: Stop the third copy-paste of the same small helper (flagged in S-01's impl-review as F5) — extract it once, here, since this phase touches the exact pattern.

**Contract**: Export `jsonResponse(body: unknown, status: number): Response`, identical in behavior to the existing copies in `src/pages/api/fit-check.ts` and `src/pages/api/vehicle-profiles/{index,[id]}.ts`. Update all three existing call sites to import from here instead of defining their own copy.

#### 2. List & create route

**File**: `src/pages/api/goods-lists/index.ts` (new)

**Intent**: Let the signed-in user list their saved goods lists and create a new one.

**Contract**: `export const prerender = false;`. Both `GET` and `POST` check `context.locals.user` explicitly and return 401 if absent (per Critical Implementation Details — apply from the start, not as a follow-up). `GET` returns the current user's `goods_lists` rows (RLS-filtered), ordered newest-first. `POST` validates the body against `goodsListInputSchema`, inserts a row with `user_id` from `context.locals.user.id` (never from the request body — same rule as S-01's `user_id` handling), returns the created row as JSON 201; validation failure returns 400 with `z.treeifyError`-style field messages.

#### 3. Delete route

**File**: `src/pages/api/goods-lists/[id].ts` (new)

**Intent**: Let the signed-in user delete one of their saved goods lists.

**Contract**: `export const prerender = false;`. `DELETE` checks `context.locals.user` explicitly (401 if absent), validates `context.params.id` is a UUID (400 if not), deletes via RLS-scoped query; if no row was actually deleted (not found or not owned), returns 404.

#### 4. Route protection

**File**: `src/middleware.ts`

**Intent**: Ensure the new endpoints are only reachable by authenticated users.

**Contract**: Add `/api/goods-lists` to the `PROTECTED_ROUTES` array.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds with the new routes present, and the three existing routes still build correctly after switching to the shared `jsonResponse` import

#### Manual Verification:

- Authenticated `POST /api/goods-lists` with a valid body (label + items array) returns 201 and the created list
- Authenticated `GET /api/goods-lists` returns the created list
- Authenticated `DELETE /api/goods-lists/<id>` removes it; subsequent `GET` no longer lists it
- An invalid `POST` body (empty items array, missing label, an invalid item) returns 400 with a clear message
- An unauthenticated request to either route is redirected/rejected
- Against the local Supabase instance: a second test user cannot see or delete the first user's goods lists

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI Integration (Fit-Check Form)

### Overview

Wire saved goods lists into the existing goods-list UI on the fit-check page: fetch on load, save-current, load-by-appending, and delete.

### Changes Required:

#### 1. Fetch saved goods lists on mount

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Load the user's saved goods lists once when the form mounts, mirroring the existing saved-profiles `useEffect`.

**Contract**: A second `useEffect` (alongside the existing saved-profiles one) fetches `GET /api/goods-lists` on mount into a new `savedGoodsLists` state array, with the same cancellation-on-unmount guard as the existing effect.

#### 2. Save-current-goods-list control

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Let the user persist whatever goods rows are currently in the form under a label they choose.

**Contract**: A label `Input` plus a "Save goods list" `Button` near the goods-list section header; on click, maps the current `rows` state to `GoodsItemInput`-shaped objects (same mapping `buildRequest` already does for the fit-check submission), validates against `goodsListInputSchema` client-side, then `POST`s to `/api/goods-lists` and adds the result to `savedGoodsLists` on success.

#### 3. Saved-goods-lists management list with load and delete

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Give the user a way to see, load, and remove their saved goods lists.

**Contract**: A compact list (one row per saved list: label + item count + a "Load" `Button` + a delete/trash `Button`), styled consistently with the existing saved-profiles list. "Load" constructs new `GoodsRowState` entries from the saved list's items (drawing keys from the existing `nextRowId` counter, per Critical Implementation Details) and appends them to the current `rows` array — no replacement, no confirmation dialog. Delete calls `DELETE /api/goods-lists/<id>` and removes the row from `savedGoodsLists` on success.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds

#### Manual Verification:

- Saving the current goods rows under a label adds it to the management list
- Loading a saved list appends its items to the existing rows (existing rows are untouched, not replaced) with all fields intact — dimensions, quantity, rotatable, stackable
- Loading a saved list when the form already has manually-entered rows correctly appends rather than overwriting them
- Deleting a saved list removes it from the management list
- Saving two lists with the same label is allowed
- Signed-out visit to the fit-check page still redirects to sign-in

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `goodsListInputSchema`: valid input accepted; empty `items` array rejected; missing/empty `label` rejected; an invalid item within `items` (e.g., non-positive dimension) rejected

### Integration Tests:

- None automated for the API layer in this slice (same rationale as S-01 — no HTTP test harness in this repo yet) — covered by Phase 2's manual verification, including the two-user RLS isolation check against the local Supabase instance.

### Manual Testing Steps:

1. Sign in, navigate to `/fit-check`.
2. Enter several goods rows with varied dimensions/quantity/flags; save them as a list under a label.
3. Confirm the list appears in the saved-goods-lists management list with the correct item count.
4. Clear or modify the form's rows, then click "Load" on the saved list; confirm its items are appended (not replacing whatever was already there) with all fields intact.
5. Delete the saved list; confirm it disappears from the management list.
6. Using the local Supabase instance, confirm a second test user cannot see or delete the first user's goods lists.

## Performance Considerations

Trivial — a handful of lists per user, each a small JSON blob; no pagination or indexing beyond the default primary key needed at this scale.

## Migration Notes

Additive only — a new table with no existing data to migrate. Rolling back means dropping the table and removing the new files and `PROTECTED_ROUTES` entry; no impact on the fit-check flow itself or on the vehicle-profile slice.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-02, milestone M-2)
- PRD: `context/foundation/prd-v2.md` (FR-007)
- Sibling implementation (structural precedent): `context/archive/2026-09-11-save-vehicle-profile/plan.md`
- Sibling impl-review (source of the RLS-role and auth-guard fixes applied here from the start): `context/archive/2026-09-11-save-vehicle-profile/reviews/impl-review.md`
- Existing JSON API + zod pattern: `src/pages/api/fit-check.ts`
- Existing middleware protection: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer, Types & Validation Schema

#### Automated

- [ ] 1.1 `npx supabase start` succeeds and the migration applies cleanly
- [ ] 1.2 `npm run lint` passes
- [ ] 1.3 Type checking passes with new `SavedGoodsList` type and schema in place
- [ ] 1.4 `npm run test` passes, including new `goodsListInputSchema` unit tests

#### Manual

- [ ] 1.5 RLS enabled with exactly the three documented policies, each scoped `to authenticated`

### Phase 2: Goods Lists API Routes

#### Automated

- [ ] 2.1 `npm run lint` passes
- [ ] 2.2 Type checking passes
- [ ] 2.3 `npm run build` succeeds with the new routes present and existing routes still building after the `jsonResponse` extraction

#### Manual

- [ ] 2.4 Authenticated POST creates a goods list (201 + created row)
- [ ] 2.5 Authenticated GET lists the created goods list
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

- [ ] 3.4 Saving adds the list to the management list
- [ ] 3.5 Loading appends items with all fields intact
- [ ] 3.6 Loading with pre-existing rows appends rather than overwrites
- [ ] 3.7 Deleting removes the list from the management list
- [ ] 3.8 Duplicate labels allowed
- [ ] 3.9 Signed-out visit still redirects to sign-in
