<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Save Vehicle Profile Implementation Plan

- **Plan**: context/changes/save-vehicle-profile/plan.md
- **Scope**: Full plan (Phases 1-3, all complete)
- **Date**: 2026-09-11
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Unplanned "Back to dashboard" link added to fit-check.astro

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/fit-check.astro:11-12
- **Detail**: Not in the plan's "Changes Required" for any phase. Added during Phase 3 manual testing because the tester had no way to navigate back to `/dashboard` to reach the sign-out button, blocking the "signed-out visit redirects" check. This was disclosed live in the implementation conversation with the reason given at the time, not silent scope creep — but the plan document itself was never updated to reflect it.
- **Fix**: Add a one-line note to the plan's Phase 3 "Changes Required" (or a short addendum) documenting this file as an in-session addition, so the plan stays an accurate record of what shipped.
- **Decision**: FIXED

### F2 — RLS policies don't scope to the `authenticated` role explicitly

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260911092339_create_vehicle_profiles.sql:13-26
- **Detail**: The three policies apply to the default role rather than explicitly `to authenticated`. Functionally safe today — `auth.uid() = user_id` already excludes anonymous sessions (an anonymous session's `auth.uid()` is null, which never equals a real `user_id`) — but CLAUDE.md's "per-role policies" phrasing suggests explicit role scoping as defense-in-depth and self-documentation.
- **Fix**: Add `to authenticated` to each of the three `create policy` statements.
- **Decision**: FIXED (via new migration `20260911142338_scope_vehicle_profiles_policies_to_authenticated.sql`, verified applied against local Supabase)

### F3 — GET and DELETE routes lack the explicit `context.locals.user` guard that POST has

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/vehicle-profiles/index.ts:23 (GET), src/pages/api/vehicle-profiles/[id].ts:16 (DELETE)
- **Detail**: POST explicitly checks `context.locals.user` and returns 401 (index.ts:43-45) before doing anything else. GET and DELETE skip this check and rely entirely on middleware (redirects unauthenticated requests) plus RLS (returns empty/no-op results) for protection — which does work today, but leaves these two handlers with one fewer explicit guard layer than their sibling, an inconsistency a future reader could misread as an oversight.
- **Fix**: Add the same `if (!context.locals.user) return jsonResponse({ error: "Unauthorized" }, 401);` check to GET and DELETE for consistency with POST.
- **Decision**: FIXED

### F4 — `deleteProfile` silently swallows a failed delete with no user-facing feedback

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/fit-check/GoodsFitForm.tsx:203-214
- **Detail**: If the DELETE request fails (network error or non-OK response), the function returns quietly and the profile stays in the list with no error shown — inconsistent with `saveProfile`, which sets `profileError` on failure. A user clicking delete and seeing nothing happen (with no explanation) is a minor but real UX gap.
- **Fix**: Reuse the existing `profileError` state to surface a message on delete failure, mirroring `saveProfile`'s error handling.
- **Decision**: SKIPPED

### F5 — `jsonResponse` helper duplicated a third time across API routes

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/vehicle-profiles/index.ts:16-21, src/pages/api/vehicle-profiles/[id].ts:9-14 (identical to src/pages/api/fit-check.ts:8-13)
- **Detail**: The same small `jsonResponse(body, status)` function is now copy-pasted in three route files. Not a new problem introduced by this change (fit-check.ts already had it standalone) but the duplication has now tripled.
- **Fix**: Extract to a shared `src/lib/http.ts` (or similar) next time this pattern is touched — not urgent enough to justify a refactor-only commit right now.
- **Decision**: SKIPPED

## Additional verification

- **Automated success criteria**: `npm run test` (25/25 passing), `npm run lint` (clean across all changed files), `npx astro check` (0 errors), and `npm run build` all re-verified green against the final state of the branch.
- **Manual success criteria**: all 12 manual Progress rows across Phases 1-3 are `[x]` with commit SHAs; the drift-detection pass found corroborating evidence in the diff for each, including the two-user RLS isolation check (verified live against a local Supabase instance with two real test accounts — user2's GET returned `[]` and DELETE against user1's profile id returned 404 without side effects).
- **Plan Adherence**: all 13 planned changes across 3 phases verified MATCH — no DRIFT, no MISSING items.
- **Security deep-dive** (highest-priority check per this review's scope): confirmed the POST handler's `user_id: context.locals.user.id` cannot be overridden by a client-supplied `user_id` in the request body — zod strips unknown keys by default (no `.passthrough()` on the schema) and the insert object also places `user_id` after the spread, so even a same-named key would be overwritten. No privilege-escalation path found.
- **Performance**: GET has no `LIMIT` on the profiles list — explicitly accepted as fine at current scale in the plan's own "Performance Considerations" section; not treated as a new finding.
