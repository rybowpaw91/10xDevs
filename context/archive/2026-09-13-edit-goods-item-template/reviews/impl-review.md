<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Edit Saved Goods-Item Template Implementation Plan

- **Plan**: context/changes/edit-goods-item-template/plan.md
- **Scope**: Phase 1-3 of 3 (full plan)
- **Date**: 2026-09-13
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Duplicated `GoodsItemTemplateRow` interface across route files

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/goods-item-templates/index.ts:8-17, src/pages/api/goods-item-templates/[id].ts:10-19
- **Detail**: Both files locally redeclare an identical `GoodsItemTemplateRow` interface rather than sharing one definition. This exactly mirrors the pre-existing duplication in `vehicle-profiles/index.ts` / `[id].ts` — consistent with established project convention, not a new problem introduced by this change.
- **Fix**: Not required now; if ever addressed, do it for both table's route pairs together (a shared `types.ts`-adjacent row-type module), not just this one.
- **Decision**: SKIPPED — matches established project convention, not a new problem to fix now.

### F2 — `weight` column has no backfill for pre-existing rows

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260912231152_add_goods_item_templates_weight.sql:2
- **Detail**: The new `weight numeric check (weight > 0)` column is nullable with no default, so all pre-existing rows get `NULL`. This is intentional and consistent with `GoodsItemTemplateRow.weight: number | null` and the UI's `template.weight != null ? ... : ""` handling throughout — flagging only as a design note, not a defect.
- **Fix**: None needed — by-design, matches the `max_payload` precedent from the sibling `edit-vehicle-profile` change.
- **Decision**: ACCEPTED — intentional design choice, not a defect.

## Additional notes (not findings)

- **Automated checks**: `npm run lint` (scoped to the 6 files this change touched — clean), `npx astro check` (0 errors), `npm run test` (44/44 passed), `npm run build` (succeeded), `npx supabase migration list --local` (both new migrations applied cleanly).
- **Plan-drift sub-agent**: no DRIFT, MISSING, or EXTRA found across any of the 8 changed files. All three phases match plan intent precisely, including the two anti-patterns the plan explicitly called out avoiding: the sibling `edit-vehicle-profile` change's F1 (RLS policy missing `to authenticated`) and F2 (stale-field carryover on selection change) findings were both proactively avoided here — confirmed directly in code, not just by absence of a new bug.
- **Safety/quality sub-agent**: no CRITICAL or WARNING findings. Confirmed: the new PATCH handler's auth guard is the first statement in the function; RLS is relied on for ownership with no explicit `user_id` filter (matching the sibling pattern); the new Edit button in the dropdown correctly stops event propagation and carries an aria-label; the new dialog's `text-foreground` contrast fix (found necessary in the sibling change's manual testing) was proactively applied here; no copy-paste/field-misrouting bugs found between the profile-edit and template-edit function pairs.
