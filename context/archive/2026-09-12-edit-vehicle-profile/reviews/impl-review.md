<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Edit Saved Vehicle Profile Implementation Plan

- **Plan**: context/changes/edit-vehicle-profile/plan.md
- **Scope**: Phase 1-3 of 3 (full plan, including the Phase 3 scope-revision addendum)
- **Date**: 2026-09-13
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — New UPDATE policy not scoped `to authenticated`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260912182208_add_vehicle_profiles_update_policy.sql:1-6
- **Detail**: The new `vehicle_profiles_update_own` policy has no `to authenticated` clause, unlike `vehicle_profiles_select_own`/`insert_own`/`delete_own`, which a prior migration (`20260911142338_scope_vehicle_profiles_policies_to_authenticated.sql`) explicitly re-scoped to `authenticated` as a hardening step — a fix this project already made once for the sibling policies. This new policy defaults to `public`, so it also applies to the `anon` role. Not currently exploitable (`using`/`with check` both require `auth.uid() = user_id`, and `user_id` is `NOT NULL`, so an anon request can never match a row), but it silently reverses the established per-role convention and violates CLAUDE.md's "granular per-operation, per-role policies" rule.
- **Fix**: Add a new migration: `alter policy "vehicle_profiles_update_own" on vehicle_profiles to authenticated;` (don't edit the already-applied migration file — additive, matching this project's migration convention).
- **Decision**: FIXED — added `supabase/migrations/20260912222319_scope_vehicle_profiles_update_policy_to_authenticated.sql`; verified directly via `supabase db query` that all four `vehicle_profiles` policies now show `roles: authenticated`.

### F2 — Switching to a payload-less profile silently keeps a stale max payload

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/fit-check/GoodsFitForm.tsx:223-238 (`handlePresetChange`)
- **Detail**: When switching from one preset/saved profile to another that has no `maxPayload` (a profile saved before this migration), the code deliberately keeps the *previous* `maxPayload` (`sourceMaxPayload != null ? String(sourceMaxPayload) : prev.maxPayload`) while `length`/`width`/`height` are unconditionally overwritten with the new selection's values. This can silently combine one vehicle's dimensions with a different vehicle's leftover payload capacity, producing a plausible-looking but incorrect fit-check result with no warning shown to the user.
- **Fix A ⭐ Recommended**: Clear `maxPayload` (to `""`) whenever the newly selected source lacks one, matching how length/width/height already get overwritten unconditionally in the same function.
  - Strength: Correctness — never silently mixes one vehicle's dimensions with another's leftover payload; consistent with the existing overwrite-unconditionally pattern for the other three fields in this same function.
  - Tradeoff: A user who picks an old preset for its dimensions only, after manually entering a payload, loses that entry and must re-enter it.
  - Confidence: HIGH — mirrors the existing behavior of the three sibling fields in the same function.
  - Blind spot: None significant.
- **Fix B**: Keep the carry-over behavior but surface a visible inline warning when the displayed max payload was carried over from a different selection.
  - Strength: Preserves manually-entered values while making the ambiguity visible instead of silent.
  - Tradeoff: Adds new UI state and a conditional warning message for one edge case (profiles saved before this migration).
  - Confidence: MEDIUM — no existing pattern in this codebase for a "stale field" indicator.
  - Blind spot: Haven't measured how often this edge case (an old payload-less profile) will actually recur in practice.
- **Decision**: FIXED via Fix A — `handlePresetChange` now clears `maxPayload` to `""` when the newly selected source has none, mirroring how length/width/height already get overwritten unconditionally.

### F3 — Profile/template delete failures fail silently

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/fit-check/GoodsFitForm.tsx:278-289 (`deleteProfile`), 422-430 (`deleteItemTemplate`)
- **Detail**: Delete flows swallow failures silently (`if (!response.ok) return;`, network errors caught with only a comment, no `setXError` call), whereas the sibling save flows (`saveProfile`, `saveProfileEdit`, `saveItemTemplate`) all set a user-visible error state on failure. A failed delete leaves the item in the list with no feedback that anything went wrong. This mirrors the pre-existing goods-item-templates delete pattern (predates this change), so it isn't a regression introduced here — flagging for a conscious skip-or-fix decision.
- **Fix**: Set a shared delete-error state (or reuse `profileError`/`itemTemplateError`) on a failed delete response or network error, mirroring the save flows' error handling.
- **Decision**: FIXED — `deleteProfile` now sets `profileError` and `deleteItemTemplate` now sets `itemTemplateError` on a failed response or network error, mirroring the existing save flows.

## Additional notes (not findings)

- **Automated checks**: `npm run lint` (scoped to the 9 files this change touched — clean), `npx astro check` (0 errors), `npm run test` (42/42 passed), `npm run build` (succeeded), `npx supabase migration list --local` (both new migrations applied cleanly). Running the bare `npm run lint` across the *whole* repo currently reports ~2000 errors from CRLF line-ending drift in files this change never touched (a pre-existing Windows/`core.autocrlf` environment issue, confirmed present before this change and unrelated to this diff) — not counted against this review.
- **Cosmetic observation (not a finding)**: the dropdown's visible profile label shows label + length×width×height but not max payload. The addendum says max payload is "threaded through... dropdown display," which is satisfied at the data level (the field exists on the object), but it isn't rendered into that label string. Low-severity and consistent with how vehicle presets are already displayed (dimensions only) — not raised as a formal finding.
- Plan-drift sub-agent found no DRIFT/MISSING/EXTRA across all three phases and the addendum; every planned contract (RLS policy shape, PATCH handler behavior, dropdown-only UI, modal dialog, max-payload threading, live-form sync, `dialog.tsx`'s `cn` import) matches what's implemented. No leftover artifacts from the superseded original Phase 3 design (`alert-dialog.tsx` confirmed removed, no dead state/imports).
