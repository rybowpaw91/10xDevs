# Edit Saved Goods-Item Template Implementation Plan

## Overview

Implement roadmap slice S-02 (milestone M-4: Editable saved data): a logged-in user can edit a previously saved goods-item template's label, dimensions, weight, and rotatable/stackable flags in place, instead of the current delete-and-re-save-only workflow. Covers MS-02. This is a direct structural mirror of S-01 (`edit-vehicle-profile`, archived at `context/archive/2026-09-12-edit-vehicle-profile/`), applied to `goods_item_templates`, plus a new `weight` field un-parked the same way `max_payload` was un-parked for vehicle profiles.

## Current State Analysis

- **`goods_item_templates` has RLS enabled with `SELECT`/`INSERT`/`DELETE` policies, all already scoped `to authenticated`** — confirmed via its only migration (`20260911174823_create_goods_item_templates.sql`). Unlike `vehicle_profiles`, this table never had a role-scoping gap; no hardening migration is needed here. No `UPDATE` policy exists, so updates are denied by default today.
- **Neither `src/pages/api/goods-item-templates/index.ts` nor `[id].ts` exports a `PATCH` handler** — confirmed by direct read; `index.ts` has `GET`/`POST`, `[id].ts` has `DELETE` only.
- **Goods-item templates are already dropdown-only** — `GoodsFitForm.tsx:740-788` renders each saved template as a raw `SelectPrimitive.Item` inside the "Add from saved item" `<Select>`, with a nested Delete (`Trash2`) icon button using the `onPointerDown`/`onPointerUp`/`onClick` + `e.stopPropagation()` pattern and a `Delete`/`Backspace` keyboard shortcut. There is no separate list to remove, unlike S-01's original (later superseded) design — this slice only *adds* an Edit affordance to the existing dropdown item, it doesn't need to rework the container.
- **`weight` is already a required field on individual goods rows** — `goodsItemSchema` (`src/lib/validation/fit-check-schema.ts:5-14`) has `weight: z.number().positive()`, and every row in the goods list already has a visible "Weight (kg)" `Input` (`GoodsFitForm.tsx`, the six-column row grid). `goodsItemTemplateInputSchema` (`src/lib/validation/goods-item-template-schema.ts`) currently `.pick()`s `length/width/height/rotatable/stackable` from `goodsItemSchema` and extends with `label` — it does not yet pick `weight`.
- **`saveItemTemplate(row: GoodsRowState)`** (`GoodsFitForm.tsx:361-397`) builds its POST payload from the row's own `length/width/height/rotatable/stackable` — extending this to include `row.weight` requires no new UI, since the row already has a weight input.
- **`loadItemTemplate(template: GoodsItemTemplate)`** (`GoodsFitForm.tsx:399-416`) always sets the new row's `weight: ""` unconditionally — this needs to prefill from `template.weight` once that field exists.
- **`GoodsItemTemplate` (`src/types.ts:66-74`) has no `weight` field.**

### Key Discoveries:

- The exact PATCH-handler shape to mirror is `src/pages/api/vehicle-profiles/[id].ts`'s `PATCH` (401 → id UUID check → JSON parse guard → schema `safeParse` with `z.treeifyError` → update via request-scoped Supabase client → 404 if no row updated → 200 with the updated row).
- The exact "add a required nullable-for-legacy-rows field" migration shape to mirror is `supabase/migrations/20260912204602_add_vehicle_profiles_max_payload.sql`: `alter table <table> add column <col> numeric check (<col> > 0);` — nullable, additive, no backfill.
- **Lesson learned in S-01's impl-review (F1)**: a new RLS policy must be scoped `to authenticated` in the *same* migration that creates it — do not let it default to `public`. `goods_item_templates`' existing policies already got this right from their first migration; the new `UPDATE` policy for this slice must match that same shape from the start.
- **Lesson learned in S-01's impl-review (F2)**: when a newly-selected source lacks a value for a field that a previous selection had, *clear* that field rather than silently carrying over the old value. This plan's `loadItemTemplate` always creates a **new** row rather than overwriting `vehicle`-style shared state, so there is no equivalent carry-over risk — prefilling `weight` from `template.weight` (or `""` if null) is safe as a straightforward assignment.
- **Confirmed no live-form-sync concept applies here**: unlike `vehicle.presetId`, which ties the main form to a currently-selected saved profile, `templateSelectValue` is reset to `""` immediately after `handleTemplateSelect` fires (`GoodsFitForm.tsx:418-424`) and added rows carry no back-reference to the template they came from. Editing a saved template therefore never needs to update already-added rows — this is a structural non-issue, not a scope cut.
- Delete-failure error surfacing (the F3 finding from S-01's review) is **already fixed** for `deleteItemTemplate` (`GoodsFitForm.tsx:426-437`, sets `itemTemplateError` on failure) — no further work needed there.

## Desired End State

In the "Add from saved item" dropdown, each template's entry shows both an Edit (pencil) and a Delete (trash) icon, mirroring the vehicle-profile dropdown exactly. Clicking Edit (or pressing `F2` on a focused entry) opens a modal dialog pre-filled with that template's label, dimensions, weight, rotatable, and stackable. Save sends the full updated object to `PATCH /api/goods-item-templates/[id]` directly (no confirmation step) and updates the dropdown entry on success; Cancel/close discards the draft with no request sent. The dropdown's visible label text includes weight (e.g. `Box (30x20x15 cm, 5kg)`). Saving a new template captures the row's current weight value; loading a template into a new row prefills that row's weight. Editing is private per user (RLS-enforced, verified against the local Supabase instance with two test accounts).

**Verification**: automated tests cover the extended zod validation path (new `weight` field, required, positive) plus confirmation that the new migration's `UPDATE` policy exists scoped `to authenticated`; manual verification confirms the dropdown's Edit/Delete icons and keyboard shortcuts, the modal dialog's pre-fill/save/cancel behavior, weight capture on save and prefill on load, and that a second test user cannot edit the first user's template.

## What We're NOT Doing

- No changes to `vehicle_profiles` or its dropdown — the cosmetic gap where its label text omits max payload (noted, not fixed, in S-01's impl-review) stays out of scope for this change, per your explicit decision to keep this strictly scoped to goods-item templates.
- No partial-field updates — the API always validates and replaces the full object (label, all three dimensions, weight, rotatable, stackable), matching create's validation exactly, per the same "full object, same schema" rule S-01 established.
- No confirmation step before save — matches S-01's final (post-addendum) decision; this is now the established convention for this app's edit-dialog pattern, not a fresh decision for this slice.
- No live-form-sync logic — there is no shared "currently selected template" state to sync back into (see Key Discoveries above).
- No uniqueness constraint on template labels, no cap on saved templates — unchanged from M-2's existing behavior.
- No backfill for existing `goods_item_templates` rows — the new `weight` column is nullable for rows saved before this migration, matching the `max_payload` precedent.

## Implementation Approach

Three phases, bottom-up: RLS policy + schema migration first (independently verifiable against the local Supabase instance before any API code exists), then the API route, then the UI — the exact phase shape S-01 used, now informed by S-01's own impl-review findings so the known pitfalls (RLS role-scoping, stale-field carry-over) are avoided from the start instead of being caught in review.

**Branching** (per CLAUDE.md's "Git workflow for changes"): all three phases are implemented on a branch named `edit-goods-item-template`, created off `master` when `/10x-implement` starts. This plan itself is created and committed on `master`. Once Phase 3 is complete (and reviewed, if `/10x-impl-review` runs), merge `edit-goods-item-template` back into `master` locally before archiving.

## Phase 1: Data Layer — UPDATE RLS Policy + weight Column

### Overview

Add the missing `UPDATE` policy to `goods_item_templates`, scoped `to authenticated` from the start, and add a nullable `weight` column.

### Changes Required:

#### 1. RLS policy migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_add_goods_item_templates_update_policy.sql` (new — generate the timestamp via `date -u +%Y%m%d%H%M%S` at creation time)

**Intent**: Allow a user to update their own goods-item templates, matching the existing per-operation, per-role RLS convention on this table.

**Contract**: `create policy "goods_item_templates_update_own" on goods_item_templates for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);` — `to authenticated` included in this same statement (per S-01's F1 lesson — do not omit it and rely on a follow-up migration).

#### 2. weight column migration

**File**: `supabase/migrations/<YYYYMMDDHHmmss>_add_goods_item_templates_weight.sql` (new, timestamp strictly after the policy migration's)

**Intent**: Let a template optionally record the item's weight, required for new saves going forward but nullable for rows that predate this column.

**Contract**: `alter table goods_item_templates add column weight numeric check (weight > 0);` — nullable, additive, no backfill, matching `vehicle_profiles.max_payload`'s precedent exactly.

### Success Criteria:

#### Automated Verification:

- `npx supabase start` succeeds and both new migrations apply cleanly
- `npm run lint` passes
- Type checking passes (no type changes expected yet, but confirm no regression)

#### Manual Verification:

- Inspect the applied migrations and confirm exactly four policies now exist on `goods_item_templates` (`SELECT`/`INSERT`/`DELETE`/`UPDATE`), all scoped `to authenticated` — this check can be done directly via `supabase db query` against `pg_policy`, no browser needed
- Confirm the `weight` column exists, is nullable, and has a `check (weight > 0)` constraint — also verifiable directly via `psql`/`supabase db query`, no browser needed

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Both manual checks above are directly verifiable by the implementer without a browser — per the established practice from S-01, run them yourself and report the result rather than asking the human to re-check something already confirmed programmatically.

---

## Phase 2: API Route — PATCH Handler + weight Threading

### Overview

Expose an authenticated update endpoint for a single goods-item template, and thread the new `weight` field through the existing GET/POST handlers and the new PATCH handler.

### Changes Required:

#### 1. Extend validation schema

**File**: `src/lib/validation/goods-item-template-schema.ts`

**Intent**: Require `weight` on every create/update going forward, reusing the same positive-number rule already defined on `goodsItemSchema`.

**Contract**: Add `weight: true` to the existing `.pick({...})` call, so `goodsItemTemplateInputSchema` picks `length/width/height/weight/rotatable/stackable` from `goodsItemSchema` and extends with `label`.

#### 2. Extend schema tests

**File**: `src/lib/validation/goods-item-template-schema.test.ts` (create if it doesn't already exist, mirroring `vehicle-profile-schema.test.ts`'s structure)

**Intent**: Cover the new required field the same way S-01 covered `maxPayload`.

**Contract**: Add `weight` to every existing valid-input test payload; add two new tests — "rejects a missing weight" and "rejects a non-positive weight".

#### 3. Extend types

**File**: `src/types.ts`

**Intent**: Reflect the new nullable-for-legacy-rows field on the shared type.

**Contract**: Add `weight: number | null;` to the `GoodsItemTemplate` interface, matching `VehicleProfile.maxPayload`'s shape exactly.

#### 4. Extend GET/POST routes

**File**: `src/pages/api/goods-item-templates/index.ts`

**Intent**: Return and accept `weight` the same way `vehicle-profiles/index.ts` handles `maxPayload`.

**Contract**: Add `weight: number | null;` to the local `GoodsItemTemplateRow` interface; add `weight` to the `.select()` column list in `GET` (no aliasing needed — `weight` is already the DB column name, unlike `max_payload`/`maxPayload`); in `POST`, `weight` is already camelCase-matching its DB column, so no destructure-then-rename is needed — pass `parsed.data` straight through to `.insert()` as today, just include `weight` in the `.select()` column list.

#### 5. Add PATCH route

**File**: `src/pages/api/goods-item-templates/[id].ts`

**Intent**: Let the signed-in user update one of their saved goods-item templates.

**Contract**: Add `export const PATCH: APIRoute`, mirroring `vehicle-profiles/[id].ts`'s `PATCH` exactly: explicit `context.locals.user` guard (401), `idSchema.safeParse` UUID check (400), JSON parse guard (400), `goodsItemTemplateInputSchema.safeParse` with `z.treeifyError` (400), update via the request-scoped Supabase client (RLS enforces ownership), `.select()` including `weight`, 404 if no row updated, 200 with the updated row otherwise. No column aliasing is needed here (unlike `vehicle-profiles`' `max_payload`/`maxPayload`), since every column on this table is already camelCase-compatible.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds with the new handler present
- `npm run test` passes, including the new `goods-item-template-schema.test.ts` cases

#### Manual Verification:

- Authenticated `PATCH /api/goods-item-templates/<id>` with a valid body (including `weight`) returns 200 and the updated template, and a subsequent `GET` reflects the change — verifiable directly via `curl` against the local Supabase-backed dev server, no browser needed
- An invalid `PATCH` body (missing `weight`, non-positive `weight`, missing label) returns 400 with a clear message — verifiable directly via `curl`
- `PATCH` on a nonexistent or non-UUID id returns 404 / 400 respectively — verifiable directly via `curl`
- An unauthenticated `PATCH` request is redirected/rejected — verifiable directly via `curl`
- Against the local Supabase instance: a second test user's `PATCH` against the first user's template id affects nothing and returns 404 — verifiable directly via `curl` with a second test account's session
- `POST` without `weight` now returns 400 (confirming the field is required going forward); `GET` on a template created before this migration still returns `weight: null` (backward compatibility) — both verifiable directly via `curl`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Every item above is directly verifiable by the implementer via `curl`/`psql` without a browser — run them yourself and report results rather than asking the human to re-check them.

---

## Phase 3: UI Integration (Dropdown Edit/Delete + weight)

### Overview

Add an Edit affordance to the existing goods-item-templates dropdown (Delete already exists), a modal dialog for editing, weight capture on save, weight prefill on load, and weight in the dropdown's visible label text.

### Changes Required:

#### 1. Edit state and dialog

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Let the user edit one saved template's full set of fields via a modal dialog, mirroring the vehicle-profile edit dialog exactly.

**Contract**: New state mirrors `editingProfileId`/`profileEditDraft`/`profileEditError`/`savingProfileEdit` — e.g. `editingTemplateId: string | null`, `templateEditDraft: { label: string; length: string; width: string; height: string; weight: string; rotatable: boolean; stackable: boolean } | null`, `templateEditError: string | null`, `savingTemplateEdit: boolean`. A new `<Dialog>` (reusing the already-installed `src/components/ui/dialog.tsx`) renders Label/Length/Width/Height/Weight `Input`s plus Rotatable/Stackable `Checkbox`es bound to the draft, with Cancel and Save `Button`s in its `DialogFooter` — no confirmation step, matching the established convention.

#### 2. Edit trigger, save, cancel

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Wire the Edit icon, keyboard shortcut, and dialog actions to the draft state and the new PATCH endpoint.

**Contract**: Add a `startEditTemplate(template)` (seeds the draft, mirroring `startEditProfile`), `cancelEditTemplate()`, and `saveTemplateEdit(id)` (validates the draft against `goodsItemTemplateInputSchema` client-side, `PATCH`es `/api/goods-item-templates/<id>`, on success replaces the template in `savedItemTemplates` and closes the dialog — no live-form-sync needed per Key Discoveries). In the dropdown's `SelectPrimitive.Item` (`GoodsFitForm.tsx:749-783`), add a second nested icon `<button>` (`Pencil`, matching the vehicle-profile Edit button's `text-blue-700 hover:text-blue-900` styling for contrast against the light popover) before the existing Delete button, with the same `onPointerDown`/`onPointerUp`/`onClick` + `e.stopPropagation()` pattern; extend the item's `onKeyDown` to also handle `F2` → `startEditTemplate(template)`.

#### 3. Weight capture on save, prefill on load, dropdown label text

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Thread `weight` through the existing create/load flow with no new create-time UI (the row's own Weight input already exists).

**Contract**: `saveItemTemplate` adds `weight: Number(row.weight)` to its `goodsItemTemplateInputSchema.safeParse` payload. `loadItemTemplate` sets the new row's `weight: template.weight != null ? String(template.weight) : ""` instead of the current unconditional `""`. The dropdown's `SelectPrimitive.ItemText` label text becomes `{template.label} ({template.length}x{template.width}x{template.height} cm, {template.weight}kg)` when `template.weight != null`, falling back to the current dimensions-only text when it's `null` (legacy row).

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds
- `npm run test` passes

#### Manual Verification:

- The templates dropdown shows working Edit (pencil) and Delete (trash) icon buttons per entry that don't trigger template selection when clicked
- Clicking Edit (or pressing `F2` on a focused entry) opens a modal dialog pre-filled with that template's label, dimensions, weight, rotatable, and stackable
- Pressing `Delete`/`Backspace` on a focused entry deletes it without opening the dialog (regression check — this already worked before this phase)
- Changing values in the dialog and clicking Save persists the change and closes the dialog; the dropdown reflects the new label/dimensions/weight immediately, including the updated label text
- Cancel (or closing the dialog) discards the in-progress edit with no request sent
- Saving a new template from a goods row captures that row's current weight value
- Loading a saved template into a new row prefills that row's weight field from the template
- Weight is required and editable in both the create-template flow (via the row's existing Weight input) and the edit dialog
- Signed-out visit to the fit-check page still redirects to sign-in (unchanged baseline)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. These are genuinely browser-only checks (dropdown rendering, icon-button click isolation, keyboard behavior, modal open/close, visual label text) — hand these to the human rather than attempting to verify them programmatically.

---

## Testing Strategy

### Unit Tests:

- `goods-item-template-schema.test.ts` covers the new required `weight` field: valid input, missing weight, non-positive weight — mirroring `vehicle-profile-schema.test.ts`'s structure exactly.

### Integration Tests:

- None automated for the API layer in this slice (same rationale as every prior saved-entity slice — no HTTP test harness in this repo yet) — covered by Phase 2's manual verification, all of which is directly verifiable via `curl`/`psql` without a browser, including the two-user RLS isolation check.

### Manual Testing Steps:

1. Sign in, navigate to `/fit-check`.
2. Add a goods row, fill in its dimensions and weight, click "Save as template" under a label.
3. Confirm the new template appears in the "Add from saved item" dropdown with weight shown in its label text.
4. Click the template's Edit (pencil) icon; change the label, one dimension, and the weight; click Save.
5. Confirm the dropdown entry now shows the updated values.
6. Select the template from the dropdown to add it as a new row; confirm the new row's weight field is prefilled from the template.
7. Focus the template's dropdown entry and press `F2`; confirm the edit dialog opens; press Cancel; confirm nothing changed.
8. Using the local Supabase instance, confirm a second test user cannot edit the first user's template (PATCH returns 404, no change).

## Performance Considerations

Trivial — a handful of rows per user, a single-row update.

## Migration Notes

Additive only — a new RLS policy and a new nullable column on an existing table, no data migration. Rolling back means dropping the policy, dropping the column, and removing the `PATCH` handler and edit UI; no impact on save/list/delete, which continue to work unchanged.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-02, milestone M-4)
- Sibling implementation (structural precedent, including its impl-review lessons applied proactively in this plan): `context/archive/2026-09-12-edit-vehicle-profile/plan.md`, `context/archive/2026-09-12-edit-vehicle-profile/reviews/impl-review.md`
- Existing JSON API + zod pattern: `src/pages/api/goods-item-templates/index.ts`, `src/pages/api/vehicle-profiles/[id].ts` (PATCH shape to mirror)
- Existing dropdown Edit/Delete pattern to extend: `src/components/fit-check/GoodsFitForm.tsx:740-788` (current Delete-only dropdown), `:641-726` (vehicle-profile edit dialog, structural template for this slice's dialog)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Layer — UPDATE RLS Policy + weight Column

#### Automated

- [x] 1.1 `npx supabase start` succeeds and both new migrations apply cleanly — ea1cdfa
- [x] 1.2 `npm run lint` passes — ea1cdfa
- [x] 1.3 Type checking passes — ea1cdfa

#### Manual

- [x] 1.4 Exactly four policies exist on `goods_item_templates`, all scoped `to authenticated` — ea1cdfa
- [x] 1.5 The `weight` column exists, is nullable, and has a `check (weight > 0)` constraint — ea1cdfa

### Phase 2: API Route — PATCH Handler + weight Threading

#### Automated

- [x] 2.1 `npm run lint` passes
- [x] 2.2 Type checking passes
- [x] 2.3 `npm run build` succeeds with the new handler present
- [x] 2.4 `npm run test` passes, including the new schema test cases

#### Manual

- [x] 2.5 Authenticated PATCH updates a template (200 + updated row, including weight); subsequent GET reflects the change
- [x] 2.6 Invalid PATCH body (missing/non-positive weight, missing label) returns 400 with a clear message
- [x] 2.7 PATCH on a nonexistent/non-UUID id returns 404/400
- [x] 2.8 Unauthenticated PATCH is redirected/rejected
- [x] 2.9 Two-user RLS isolation confirmed against the local Supabase instance
- [x] 2.10 POST without weight returns 400; GET on a pre-migration template returns weight: null

### Phase 3: UI Integration (Dropdown Edit/Delete + weight)

#### Automated

- [x] 3.1 `npm run lint` passes
- [x] 3.2 Type checking passes
- [x] 3.3 `npm run build` succeeds
- [x] 3.4 `npm run test` passes

#### Manual

- [x] 3.5 Dropdown shows working Edit/Delete icon buttons that don't trigger selection
- [x] 3.6 Edit (click or F2) opens the modal dialog pre-filled correctly
- [x] 3.7 Delete/Backspace still deletes without opening the dialog (regression check)
- [x] 3.8 Save persists the change and updates the dropdown, including label text; Cancel discards with no request sent
- [x] 3.9 Saving a new template captures the row's current weight
- [x] 3.10 Loading a template prefills the new row's weight
- [x] 3.11 Weight required and editable in both create and edit flows
- [x] 3.12 Signed-out visit still redirects to sign-in
