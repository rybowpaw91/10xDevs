# Save Goods Item — Plan Brief

> Full plan: `context/changes/save-goods-item/plan.md`

## What & Why

Roadmap slice S-02 of milestone M-2 (Save and reuse): a logged-in user saves a single goods item — label, dimensions, rotatable, stackable — as a reusable template from a goods row, and loads it back into the form as a new row later, instead of retyping those fields. This corrects an earlier misreading of FR-007 that built list-level persistence (save a whole goods list as one named set); that attempt was discarded before any UI shipped once the actual per-item intent became clear.

## Starting Point

S-01 (`save-vehicle-profile`, shipped and reviewed) already established the full pattern this plan reuses: a small table with per-operation RLS, a JSON API route pair, and UI integration (fetch-on-mount, save control, management list with delete). The only structural difference: a vehicle profile prefills one field group via a `<Select>`, but a goods-item template becomes a brand-new row in a list — so this plan adds a per-row save action and a management list instead of extending a select.

## Desired End State

On the fit-check page, each goods row has a small "Save as template" action next to Remove. Saved templates show in a compact management list (label + dimensions, Load + Delete) near the goods-list header. Clicking "Load" appends a new row prefilled from the template (quantity defaults to 1, since quantity isn't part of the template) — existing rows are never touched.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Template fields | label + dimensions + rotatable + stackable, no `quantity` | Quantity varies per shipment; baking it into a "reusable template" would usually be stale/wrong. | Plan (user-confirmed) |
| Load interaction | Load always appends a new row | Non-destructive by construction — no ambiguity about which row is the target, no confirmation dialog needed. | Plan (user-confirmed) |
| Save-source | Per-row "Save as template" action | Unambiguous — saves exactly the row the user is looking at, matching the original ask to save "a marked item." | Plan (user-confirmed) |
| Management UI placement | Compact list near the goods-list header | Direct visual precedent from S-01's saved-profiles list; users already know this pattern. | Plan (user-confirmed) |
| Delete / cap / label uniqueness / editing | Same as S-01: delete included, no cap, duplicates allowed, no editing | Direct parity with the already-shipped, already-reviewed sibling slice. | Plan (user-confirmed) |
| RLS role scoping + auth guards | Applied from the start, not as a follow-up | S-01's impl-review (F2, F3) found these worth adding after the fact; this plan builds them in from the first migration/route. | Plan |
| `jsonResponse` helper | Kept local to the two new route files, not extracted | S-01's impl-review (F5) explicitly deferred the extraction as "not urgent enough" — this plan doesn't expand scope to touch 3 unrelated files. | Plan |

## Scope

**In scope:**
- `goods_item_templates` table + RLS (select/insert/delete, `to authenticated`)
- `GET`/`POST /api/goods-item-templates`, `DELETE /api/goods-item-templates/[id]`
- Per-row "Save as template" action, saved-item-templates management list with Load (append new row) + Delete, inside the existing fit-check form

**Out of scope:**
- `quantity` in the saved template
- Editing a saved template's contents, any cap or uniqueness constraint on templates
- A "fill current/focused row" loading mode, per-row load dropdowns, or confirmation dialogs
- Extracting the shared `jsonResponse` helper
- Changes to S-01 (vehicle profiles), the packing algorithm, or the weight-aware fit-check work queued for M-3

## Architecture / Approach

Structural mirror of S-01's three-phase, bottom-up approach (data layer → API → UI), reusing `goodsItemSchema`'s dimension/flag validation via `.pick()` instead of redefining it. The UI diverges from S-01 only where the shape demands it: a per-row save action and an append-only load, since goods items live in a list rather than a single field group.

**Branching:** implemented on branch `save-goods-item` (created off `master` at `/10x-implement` start, per CLAUDE.md's "Git workflow for changes"), merged back locally once complete.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Layer, Types & Validation Schema | `goods_item_templates` table + RLS, `GoodsItemTemplate` type, `goodsItemTemplateInputSchema` | Low — direct mirror of S-01's now-battle-tested pattern |
| 2. Goods Item Templates API Routes | GET/POST/DELETE endpoints | Low — same shape as S-01's routes, one entity swapped for another |
| 3. UI Integration | Per-row save action, management list, append-on-load in `GoodsFitForm.tsx` | Getting the per-row save action's validation and the `nextRowId` reuse right |

**Prerequisites:** None beyond the existing auth baseline and local Supabase/Docker (both already in place from S-01).
**Estimated effort:** ~2-3 focused sessions, one per phase, for a solo after-hours developer — direct precedent makes this faster than S-01 itself.

## Open Risks & Assumptions

- None beyond the standard RLS-verification gap already accepted for S-01: two-user RLS isolation is verified manually against the local Supabase instance (no automated HTTP-level test harness in this repo yet).

## Success Criteria (Summary)

- A user can save a row as a template, see it, load it as a new row (all fields intact except quantity, which defaults to 1), and delete it from the fit-check page
- Saved templates are genuinely private per user — RLS-enforced and verified with a real second test account
- No regression to the existing goods-row add/remove/edit flow or to the vehicle-profile slice
