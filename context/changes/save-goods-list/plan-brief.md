# Save Goods List — Plan Brief

> Full plan: `context/changes/save-goods-list/plan.md`

## What & Why

Roadmap slice S-02 of milestone M-2 (Save and reuse): a logged-in user saves the current goods list as a named set and loads it back into the fit-check form later, instead of re-entering every line item. This is a close structural mirror of S-01 (`save-vehicle-profile`, already shipped and reviewed), applying the same migration/RLS/API/UI pattern to a second, list-shaped entity.

## Starting Point

S-01 already established the full pattern this plan reuses: a small table with per-operation RLS, a JSON API route pair, and UI integration in `GoodsFitForm.tsx` (fetch-on-mount, save control, management list with delete). The only real difference here is that a goods list holds multiple items, not one flat row — and `GoodsItemInput`/`goodsItemSchema` already exist and describe exactly one such item, so no new item-level type is needed.

## Desired End State

On the fit-check page, a user saves the current goods rows under a label, sees saved lists in a management list (label + item count, Load + Delete actions), and clicking "Load" appends that list's items to whatever's already in the form — nothing is replaced or lost, no confirmation dialog needed since appending can't destroy data.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Storage shape | One table, `items jsonb` column | Editing individual saved items is out of scope (delete + re-save only), so a child table would add joins for zero benefit. |
| Saved item fields | Full `GoodsItemInput` shape (label, dimensions, quantity, rotatable, stackable) | User confirmed: save everything needed to avoid re-entering any field, not just dimensions. |
| Loading behavior | Append to existing form rows, never replace | User's explicit choice — non-destructive by construction, so no confirmation dialog is needed either. |
| Delete / limit / label uniqueness / editing | Same as S-01: delete included, no cap, duplicates allowed, no editing | Direct precedent from the just-shipped sibling slice — no new tradeoff to weigh. |
| RLS role scoping + auth guards | Applied from the start, not as a follow-up | S-01's impl-review (F2, F3) found these worth adding after the fact; this plan builds them in from the first migration/route. |
| `jsonResponse` helper | Extracted to `src/lib/http.ts`, used by all four routes | S-01's impl-review (F5) flagged the third duplication and recommended fixing it "next time this pattern is touched" — this is that time. |

## Scope

**In scope:**
- `goods_lists` table + RLS (select/insert/delete, `to authenticated`)
- `GET`/`POST /api/goods-lists`, `DELETE /api/goods-lists/[id]`
- Save-current-list control, management list with Load (append) + Delete, inside the existing fit-check form
- Extracting the shared `jsonResponse` helper (touches `fit-check.ts` and both `vehicle-profiles` routes too)

**Out of scope:**
- Editing a saved list's contents, any cap or uniqueness constraint on lists
- A "replace" loading mode or confirmation dialog
- Changes to S-01 (vehicle profiles), the packing algorithm, or the weight-aware fit-check work queued for M-3

## Architecture / Approach

Structural mirror of S-01's three-phase, bottom-up approach (data layer → API → UI), maximizing reuse of existing types (`GoodsItemInput`) and schemas (`goodsItemSchema`) instead of redefining them for the list context.

**Branching:** implemented on branch `save-goods-list` (created off `master` at `/10x-implement` start, per CLAUDE.md's "Git workflow for changes"), merged back locally once complete.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Layer, Types & Validation Schema | `goods_lists` table + RLS, `SavedGoodsList` type, `goodsListInputSchema` | Low — same pattern as S-01, RLS role-scoping applied from the start this time |
| 2. Goods Lists API Routes | GET/POST/DELETE endpoints, `src/lib/http.ts` extraction | Slightly wider blast radius than S-01 alone — the helper extraction touches 3 existing route files |
| 3. UI Integration | Save/Load/Delete UI in `GoodsFitForm.tsx` | Getting append-not-replace right, and reusing `nextRowId` correctly for loaded rows |

**Prerequisites:** None beyond the existing auth baseline and local Supabase/Docker (both already in place from S-01).
**Estimated effort:** ~3 focused sessions, one per phase, for a solo after-hours developer — likely faster than S-01 given the direct precedent.

## Open Risks & Assumptions

- The `jsonResponse` extraction (Phase 2) modifies `fit-check.ts` and both `vehicle-profiles` route files even though they're not otherwise part of this slice — a deliberate, small, low-risk refactor directly addressing a recorded review finding, not incidental scope creep.
- Two-user RLS isolation is verified manually against the local Supabase instance, same gap as S-01 (no automated HTTP-level test harness in this repo yet).

## Success Criteria (Summary)

- A user can save, see, load (append), and delete a goods list from the fit-check page, with every field (dimensions, quantity, rotatable, stackable) intact after loading
- Saved lists are genuinely private per user — RLS-enforced and verified with a real second test account
- No regression to the existing goods-row add/remove/edit flow or to the vehicle-profile slice
