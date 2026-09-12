<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Weight-Aware Fit Check Implementation Plan

- **Plan**: context/changes/weight-aware-fit-check/plan.md
- **Scope**: Full plan (Phases 1-2, all complete, including Phase 2's addendum)
- **Date**: 2026-09-12
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 warnings, 7 observations

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

### F1 — `EPSILON` constant duplicated across two files

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/packing/packer.ts:12, src/lib/services/packing/support.ts:3
- **Detail**: `EPSILON = 1e-9` is defined independently in both files rather than shared from one module. Both copies are currently consistent, so this is cosmetic, not a correctness bug.
- **Fix**: Optionally hoist to a shared constant (e.g. in `geometry.ts`) if these files are touched again.
- **Decision**: PENDING

### F2 — Oversized-item lookup uses `Array.find` by id, not unique-safe at the API layer

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/fit-check/FitCheckResult.tsx:33
- **Detail**: If two submitted items shared an `id`, the client-side dimension lookup would silently show the first match. The UI's own `buildRequest` already de-dupes labels before submit, so this can't happen through the shipped form — only a direct API caller could trigger it, and `fitCheckRequestSchema` doesn't enforce `items[].id` uniqueness.
- **Fix**: Not urgent given the only current client already guarantees uniqueness; add a `.refine` for unique ids if a second API consumer is ever added.
- **Decision**: PENDING

### F3 — Property tests use integer arbitraries, don't exercise fractional epsilon boundaries

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/services/packing/packer.property.test.ts
- **Detail**: Weight/dimension arbitraries use `fc.integer`, so the properties never generate near-tie fractional weights (e.g. 10 vs 10.0000000001) to stress the `EPSILON` boundary specifically. The exact-tie case is covered by dedicated unit tests in `packer.test.ts`/`support.test.ts` instead.
- **Fix**: Optional — add a fractional near-tie case if this boundary is ever suspected of a regression; not blocking.
- **Decision**: PENDING

### F4 — Confirmed safe: diagnostic second `tryPlace` call has no side effects

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/packing/packer.ts:220-229
- **Detail**: The `wouldFitIgnoringWeight` diagnostic call (using `Number.NEGATIVE_INFINITY` as the support weight) only reads `placed`/`candidates`, never mutates them, and runs at most once per `runFitCheck` call (on the single unit that ends the loop) — it cannot place a different unit than the real attempt already failed to place, and its cost is bounded by `TOTAL_UNIT_CAP` (200).
- **Fix**: None needed.
- **Decision**: no_change_needed

### F5 — Confirmed correct: epsilon comparisons implement inclusive "at least as heavy" / "must not exceed"

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/packing/support.ts:27, src/lib/services/packing/packer.ts:197
- **Detail**: `unit.weight + EPSILON < candidate.weight` correctly treats exact-tie weights as sufficient support (FR-010's "at least as heavy"); `totalWeight > vehicle.maxPayload + EPSILON` correctly allows exact payload equality rather than rejecting it (FR-009's "must not exceed").
- **Fix**: None needed.
- **Decision**: no_change_needed

### F6 — Confirmed safe: no injection risk from user-controlled item labels in reason strings

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/packing/packer.ts (reason strings), src/pages/api/fit-check.ts:9
- **Detail**: User-controlled item labels are interpolated into reason strings via template literals, then serialized with `JSON.stringify` (no string-concatenated JSON anywhere) and rendered as React text content, which auto-escapes — no XSS or injection vector.
- **Fix**: None needed.
- **Decision**: no_change_needed

### F7 — Confirmed not a bug: no race condition between in-flight submit and form edits

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/fit-check/GoodsFitForm.tsx (handleSubmit)
- **Detail**: `resultItems`/`resultVehicle` are set from `parsed.data` (the exact snapshot that was submitted), not from live `rows`/`vehicle` state — editing the form while a request is in flight cannot desync the displayed oversized-item dimensions from what was actually sent.
- **Fix**: None needed. Optionally disable inputs during `submitting` for UX clarity, but that's a polish item, not a correctness concern.
- **Decision**: no_change_needed

## Additional verification

- **Automated success criteria**: `npm run lint` (clean on every file this branch touched), `npx astro check` (0 errors), `npm run test` (40/40 passing), and `npm run build` all re-verified green against the final state of the branch, independent of the earlier per-phase checks.
- **Manual success criteria**: all 14 manual Progress rows across Phases 1-2 (Phase 1 has none; Phase 2 has 8) are `[x]` with commit SHAs; you confirmed the UI behavior directly ("ok it working") for the checkbox, weight input, and enriched failure messages.
- **Plan Adherence**: all planned file-level changes across both phases verified MATCH by an independent drift-detection sub-agent, including the addendum's two feedback-driven extensions (numeric failure detail, `preserveOrder` toggle) — both fully and correctly implemented as documented in `change.md`'s Notes and the plan's Phase 2 addendum. No undisclosed scope creep found; `vehicleDimensionsSchema` (shared with vehicle-profile validation) was confirmed untouched, exactly as the plan required.
- **Data safety**: confirmed this feature remains entirely stateless — no migrations, no new/changed API routes beyond the already-generic `src/pages/api/fit-check.ts` (which needed zero code changes, as the plan predicted), no auth surface touched.
- **Security deep-dive**: confirmed no injection path from user-controlled item labels into reason strings (F6), and no race condition between an in-flight submit and concurrent form edits (F7).
