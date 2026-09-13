<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Fit-Check Correctness Hardening

- **Plan**: context/changes/testing-fit-check-correctness/plan.md
- **Scope**: Full plan (Phase 1 of 2, Phase 2 of 2)
- **Date**: 2026-09-14
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — "Free order" rotation scenario overclaims what it proves (vacuous-pass path)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/packing/packer.test.ts:206-226
- **Detail**: The test/comment claims to prove "rotation flexibility alone is never used to bypass the weight-based stacking rule (FR-010)." It doesn't, independently. With `preserveOrder: false`, `expandUnits` (packer.ts:80) sorts heaviest-first regardless of the FR-010 gate, so "heavy" is always attempted first against an empty `placed` list, where `isFullySupported` trivially returns `true` at ground level (`support.ts:20`) — irrespective of whether the weight-support gate works, is broken, or is inverted. If that gate were disabled, this exact scenario would either still pass (gate irrelevant at ground level) or flip `result.fits` to `false`, silently absorbed by the early `if (!result.fits) return;` (packer.test.ts:221) — a vacuous pass, not a catch. The actual regression-catching work for this scenario shape is done entirely by the very next test (preserve-order, lines 228-246), which does force the gate to be evaluated.
- **Fix A ⭐ Recommended**: Reword the test name and inline comment to accurately scope the claim (proves heaviest-first ordering + valid rotation selection under free order; the FR-010 gate itself is proven by the companion preserve-order test below it) — no assertion-logic change.
  - Strength: Zero risk to the passing suite; makes the test's self-documentation accurate, which matters directly for a test-hardening phase whose entire point is not overclaiming what a test proves.
  - Tradeoff: The free-order scenario still doesn't independently exercise the FR-010 gate — that responsibility continues to rest entirely on the preserve-order companion test.
  - Confidence: HIGH — pure documentation/naming fix, no behavior change.
  - Blind spot: None significant.
- **Fix B**: Restructure the free-order scenario so it also genuinely forces an attempt to place "heavy" above "light" (e.g. a third, even-heavier item so heaviest-first doesn't trivially land the tested item on the ground first), so the assertion carries independent signal rather than duplicating the preserve-order test.
  - Strength: Removes the vacuous-pass path entirely; the free-order test would add real, independent coverage.
  - Tradeoff: More invasive change to a test that currently reads fine once relabeled; scenario design for forcing specific algorithm behavior has already proven trickier than expected once this phase (see F3 / the `stackForcingArb` history).
  - Confidence: MEDIUM — feasible, but unprototyped.
  - Blind spot: Haven't prototyped the restructured scenario to confirm it doesn't introduce its own vacuous-pass path.
- **Decision**: FIXED (via Fix A) — test name and comment reworded in packer.test.ts to accurately scope the claim; no assertion-logic change.

### F2 — `stackForcingArb`'s per-run sample size for the weight-order assertion is smaller than `numRuns` implies

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/packing/packer.property.test.ts:128-209
- **Detail**: Each forced-stack unit's `stackable` flag is an independent `fc.boolean()`. Whenever the bottom-most unit in the column is generated with `stackable: false`, `tryPlace` fails for the unit above it, `runFitCheck` returns `fits:false`, and `assertCombinedInvariant`'s early `if (!result.fits) return;` (line 163) exits before the weight-order assertion (lines 199-208) ever runs for that sample. This doesn't make the test incorrect — empirically it still measured a 10/10 catch rate for the reintroduced FR-010 bug — but the effective sample size actually reaching the weight-order check is smaller than the nominal `numRuns: 250`, which is worth knowing when reading the "10/10 catch rate" claim logged in `test-plan.md` §6.6.
- **Fix**: Add a one-line code comment near `stackForcingArb` noting that runs with a non-stackable bottom unit exit before the weight-order assertion, so the effective sample size for that sub-check is smaller than `numRuns`.
- **Decision**: FIXED — explanatory comment added in packer.property.test.ts.

### F3 — `stackForcingArb` added beyond the plan's literal Phase 1 contract (disclosed and approved during implementation)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/lib/services/packing/packer.property.test.ts:123-159, 216-218
- **Detail**: Phase 1's plan text (plan.md:65) specified the combined-invariant property using only the existing `requestArb`. While verifying Phase 1's manual criteria during Phase 2, empirical measurement showed that `requestArb`-only version caught a reintroduced FR-010 regression in under a third of runs (vehicle dims are generated independently of item dims, so genuine stacking is rare). A second, dedicated `stackForcingArb` was added — raising the catch rate to 10/10 — and disclosed to the user as a deviation before implementation, per the conversation record. Confirmed purely additive: the original `requestArb`-based `it` block is present and unmodified alongside the new one.
- **Fix**: None needed — already disclosed to and approved by the user. Recorded here only so this review's Scope Discipline verdict accurately reflects that content beyond the plan's literal Phase 1 text was added, and documents why.
- **Decision**: SKIPPED (confirmed already resolved — no code change; disclosed and approved prior to implementation).

## Automated Verification (re-run at review time)

| Command | Result |
|---|---|
| `npm run test` | ✅ PASS — 50/50 tests, 6 files |
| `npx eslint` on touched files (`packer.test.ts`, `packer.property.test.ts`) | ✅ PASS — 0 errors |
| `npx vitest run src/lib/services/packing/packer.property.test.ts` | ✅ PASS — 6/6 |

Note: repo-wide `npm run lint` still fails on pre-existing, unrelated CRLF line-ending drift (confirmed pre-existing via `git stash` during Phase 1, out of scope for this change — see Phase 1's disclosed mismatch resolution).

## Manual Verification

Both phases' manual items are `[x]` in the plan's Progress section. 1.4/1.5 (Phase 1) were confirmed by the user; 2.3 (listed as automated but manual in nature) and the historical-bug regression check were independently re-verified by the reviewer with concrete evidence (10-run empirical measurements) during Phase 2, not merely rubber-stamped. 2.4/2.5 (Phase 2) are directly confirmable from the diff itself (cookbook content exists and matches; scenario tests are readable).
