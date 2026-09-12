# Edit Saved Goods-Item Template — Plan Brief

> Full plan: `context/changes/edit-goods-item-template/plan.md`

## What & Why

Let a logged-in user edit a previously saved goods-item template's label, dimensions, weight, and rotatable/stackable flags in place, instead of the current delete-and-re-save-only workflow. This is roadmap slice S-02 (milestone M-4: Editable saved data) — the sibling of S-01 (`edit-vehicle-profile`), applied to the other saved-entity table, plus un-parking a `weight` field the same way `max_payload` was un-parked for vehicle profiles.

## Starting Point

`goods_item_templates` already has `SELECT`/`INSERT`/`DELETE` RLS policies (correctly scoped `to authenticated` from its first migration — no role-scoping gap like `vehicle_profiles` had). The API has `GET`/`POST` but no `PATCH`. The UI already shows saved templates in a dropdown-only list with a working Delete icon — there's no separate list to remove, unlike S-01's original design. `weight` already exists as a required field on individual goods rows and already has its own visible input; it's simply never been threaded into the saved-template shape.

## Desired End State

Each template's dropdown entry shows both Edit (pencil) and Delete (trash) icons. Clicking Edit (or pressing `F2`) opens a modal dialog pre-filled with every field, including weight; Save updates it directly (no confirmation step); Cancel discards. The dropdown's label text now shows weight too. Saving a new template captures the row's current weight; loading a template prefills a new row's weight.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Weight required or optional | Required going forward (nullable only for pre-migration rows) | Consistent with every other numeric field on this schema; matches the `max_payload` precedent | Plan (user confirmed) |
| Edit dialog scope | Full object, including rotatable/stackable | Matches the "full object, same schema as create" rule S-01 established | Plan (user confirmed) |
| Dropdown label text | Show weight in the visible label | Weight is often the deciding factor between similar templates | Plan (user confirmed) |
| Cross-table scope | Stay scoped to goods-item templates only; leave the vehicle-profile dropdown's cosmetic label gap untouched | Keeps this change's diff focused, one concern per change | Plan (user confirmed) |
| RLS policy shape | `to authenticated` in the same migration that creates it | S-01's impl-review (F1) found this omitted once — applied proactively here | Sibling impl-review |
| Stale-field carry-over | Not applicable — `loadItemTemplate` always creates a new row, no shared state to carry over | S-01's impl-review (F2) found a carry-over bug specific to `vehicle.presetId`-tied shared state; confirmed structurally absent here | Sibling impl-review |

## Scope

**In scope:**
- `UPDATE` RLS policy + nullable `weight` column on `goods_item_templates`
- `PATCH /api/goods-item-templates/[id]`, weight threaded through GET/POST/PATCH
- Edit (pencil) icon + `F2` shortcut in the existing dropdown, modal edit dialog
- Weight capture on save, weight prefill on load, weight in the dropdown label text

**Out of scope:**
- Any change to `vehicle_profiles` or its dropdown
- Partial-field updates, confirmation-before-save, live-form-sync (none apply here)
- Backfilling existing rows' weight

## Architecture / Approach

Three phases, bottom-up, mirroring S-01 exactly: RLS + schema migration (Phase 1) → PATCH handler + weight threading (Phase 2) → dropdown Edit icon + modal dialog + weight capture/prefill (Phase 3). Every phase applies a lesson from S-01's own impl-review proactively instead of waiting to be caught in review again.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Data Layer | `UPDATE` policy (`to authenticated` from the start) + nullable `weight` column | Low — same shape as S-01's Phase 1, with its one gap already fixed |
| 2. API Route | `PATCH` handler, `weight` in GET/POST/PATCH | Low — no column aliasing needed (weight is already camelCase) |
| 3. UI Integration | Edit icon + dialog + weight capture/prefill/label | Low — dropdown and dialog patterns are already established and reviewed |

**Prerequisites:** none — `goods_item_templates`, its RLS, and its API/UI already exist from M-2's S-02.
**Estimated effort:** small — a direct mirror of an already-implemented and reviewed sibling change.

## Open Risks & Assumptions

- Assumes no other code reads `GoodsItemTemplate` without expecting a `weight` field — a quick grep during Phase 2 should confirm this before extending the type.

## Success Criteria (Summary)

- A user can edit a saved goods-item template's full field set (including weight) via the dropdown's Edit icon and a modal dialog, with the change reflected immediately.
- A second user cannot edit another user's template (RLS-enforced, verified against local Supabase).
- Saving and loading templates correctly captures and prefills weight, including graceful handling of pre-migration templates with `weight: null`.
