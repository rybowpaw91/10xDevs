# Fit-Check Correctness Hardening Implementation Plan

## Overview

Harden the fit-check packing test suite so that (Risk #1) a future refactor of the packing heuristic cannot silently break the FR-010 weight-stacking rule, and (Risk #2) no combination of rotation, stacking, and weight can ever produce a false `fits: true`. This is rollout Phase 1 of `context/foundation/test-plan.md` §3.

## Current State Analysis

The packing engine (`src/lib/services/packing/{packer,geometry,support}.ts`) already enforces both rules correctly today, and already has meaningful test coverage:

- FR-010 (weight-stacking) is enforced in exactly one place — `isFullySupported` (`src/lib/services/packing/support.ts:27`) — independent of pack order. The heaviest-first sort in `expandUnits` (`src/lib/services/packing/packer.ts:77-80`) is a placement heuristic, not a second enforcement path; the `preserveOrder` unit tests (`src/lib/services/packing/packer.test.ts:153-261`) already prove the rule holds regardless of which ordering strategy is used.
- The `fits` flag is not two booleans ANDed together — it's the outcome of a single sequential gate, `tryPlace` (`src/lib/services/packing/packer.ts:141-180`), called once per unit from `runFitCheck`'s loop (`src/lib/services/packing/packer.ts:216-240`). `fits: true` only if every unit clears bounds (`fitsWithinVehicle`), no-overlap (`boxesOverlap`), and weight-aware support (`isFullySupported`) together.
- `src/lib/services/packing/packer.property.test.ts` already has three property blocks: no-overlap/in-bounds (`:56-80`), weight cap (`:83-96`), and weight-based stacking (`:98-121`). Its `requestArb` (`:23-37`) already randomizes `preserveOrder`, so order-independence is already implicitly exercised on every run.
- Two real gaps exist, confirmed by direct code reading (not present anywhere today):
  1. No test — property or unit — asserts that a placed unit's orientation is actually one of `getEligibleOrientations` for that item. Rotation validity is currently untested.
  2. The property arbitraries (`packer.property.test.ts:9-21`) are integer-only (`fc.integer`). The `EPSILON`-boundary behavior (equal-weight-allowed, per `support.ts:27`) is only exercised by hand-written cases in `support.test.ts:32,37` — never by the randomized layer, which is exactly where an unanticipated boundary bug would otherwise surface.

## Desired End State

`packer.property.test.ts` and `packer.test.ts` contain tests that would fail if:
- a future heuristic refactor broke the weight-stacking rule regardless of how it reorders units, or
- any placement's orientation were not a valid rotation of its item, or
- a near-tie weight comparison (within the production `EPSILON`) were mishandled, or
- rotation flexibility were used to route around the weight-stacking gate.

Verify by running `npm run test` — all packing test files pass, including the new combined property block, the new boundary-focused property, and the new scenario-table unit tests — and by confirming `context/foundation/test-plan.md` §6.1 now documents this phase's pattern instead of `TBD`.

### Key Discoveries:

- `src/lib/services/packing/packer.ts:196-201` and `:203-209` — payload and oversized-dimension short-circuits return before the main loop; the combined property must account for these (skip assertions when `fits: false`, same as existing blocks).
- `src/lib/services/packing/packer.property.test.ts:7` defines a **local** `EPSILON = 1e-6` for test assertions (floating-point tolerance on positions), which is three orders of magnitude looser than the **production** `EPSILON = 1e-9` used in `packer.ts:12` and `support.ts:3`. This matters directly for the new boundary work (see Critical Implementation Details).
- `context/foundation/prd-v3.md:79-84` (not `prd.md`, which is stale v1) is the source of truth for FR-009/FR-010's exact wording — cited here so this plan and the resulting tests reference the right document.

## What We're NOT Doing

- Not touching `context/foundation/prd.md`'s staleness (v1 vs. `prd-v3.md`) — logged as a follow-up outside this change's scope, per explicit decision.
- Not changing any production code in `packer.ts` / `support.ts` / `geometry.ts` — this phase only adds test coverage for behavior that is already correct today.
- Not deduplicating the `EPSILON` constant currently repeated across `packer.ts:12` / `support.ts:3` / `packer.property.test.ts:7` — noted as a discovered wrinkle, not fixed here, since fixing it would touch production code paths outside this phase's risk scope. The new boundary tests are written to be correct despite the duplication (see below).
- Not adding an API/integration test for `src/pages/api/fit-check.ts` or `fit-check-schema.ts` — that's Phase 3 of the test-plan rollout (input validation and limits), not this phase.
- Not adding rotation/stacking coverage for the empty-items or oversized-item short-circuit paths beyond what already exists — those are geometry-only paths untouched by this phase's two risks.

## Implementation Approach

Two phases. Phase 1 extends the property-based layer (the cheapest test that gives real signal for "does this hold across many inputs, including inputs nobody thought to hand-write"). Phase 2 adds the deterministic unit-test counterpart change.md explicitly asked for (`unit (niezmiennik łączony)`) — concrete, readable scenarios a reviewer can eyeball — and closes out the phase by updating the test-plan cookbook.

## Critical Implementation Details

- **EPSILON mismatch between test file and production code.** `packer.property.test.ts:7` declares its own `EPSILON = 1e-6`, used today only for floating-point position/overlap tolerance. The new boundary-focused property in Phase 1 must generate weight deltas relative to the *production* `EPSILON = 1e-9` (from `packer.ts` / `support.ts`), and its assertions must use that same `1e-9` tolerance — not the file's existing `1e-6` constant — otherwise the test would validate the wrong boundary (three orders of magnitude off from what `support.ts:27`'s `unit.weight + EPSILON < candidate.weight` actually checks). Introduce a second, clearly-named constant (e.g. `PROD_EPSILON = 1e-9`) scoped to the new boundary block rather than changing the existing `EPSILON = 1e-6` used elsewhere in the file.
- **Keep near-boundary noise out of the rotation-validity check.** The new combined property (below) asserts each placement's `size` is exactly one of `getEligibleOrientations(item, item.rotatable)` for its source item — an exact-value set-membership check. The near-EPSILON boundary work must only perturb the *weight* arbitrary (or a dedicated weight-delta arbitrary), never the dimension arbitraries, or the rotation-validity assertion would start failing on floating-point noise unrelated to what it's testing.

## Phase 1: Combined property-based correctness invariant

### Overview

Add the randomized-testing half of this phase's deliverable: one new property proving rotation + stacking + weight + bounds hold together on every `fits: true` result from the general randomized packer search, plus one new, narrowly-scoped property that directly probes the production `EPSILON` tie-breaking boundary (something the general random search over integer dimensions/weights cannot reliably reach on its own). Also raises `numRuns` on the blocks most tied to this phase's two risks.

### Changes Required:

#### 1. Combined correctness invariant property

**File**: `src/lib/services/packing/packer.property.test.ts`

**Intent**: Prove that whenever `runFitCheck` reports `fits: true` against the existing general `requestArb`, every placement is simultaneously in-bounds, non-overlapping, geometrically a valid rotation of its source item, and weight-stacking-compliant — one property standing in for the "niezmiennik łączony" change.md names, so a future heuristic refactor that satisfies any one sub-check while breaking another is caught.

**Contract**: New `describe("runFitCheck property: combined correctness invariant (rotation + stacking + weight)")` block, using the existing `requestArb`. For each `fits: true` result, build an `itemById` lookup (same pattern as the existing `weightById` map at `packer.property.test.ts:105`) carrying each item's `rotatable`/`stackable`/`weight`/dims, then for every placement assert: (a) bounds and pairwise non-overlap (reuse `overlaps`/existing bounds logic), (b) `placement.size` is a member of `getEligibleOrientations(item, item.rotatable)` for its source item (exact-value membership, exported from `./geometry`), (c) for every pair where one placement is directly above another (reuse `isDirectlyBelow`), the below unit's weight is not less than the above unit's weight (within production `EPSILON`). Leave the three existing property blocks (`:56-80`, `:83-96`, `:98-121`) unchanged and in place alongside this new one.

#### 2. Boundary-focused property for the production EPSILON tie

**File**: `src/lib/services/packing/packer.property.test.ts`

**Intent**: Exercise the exact tie-breaking boundary `support.ts:27` implements (`unit.weight + EPSILON < candidate.weight`), which today is only covered by two hand-written cases in `support.test.ts`, never by the randomized layer — closing the gap the prior impl-review flagged.

**Contract**: New arbitrary generating a controlled two-unit vertical-stack scenario (a fixed vehicle and two same-footprint stackable items sized so the only valid arrangement is one stacked on the other) plus a weight delta drawn from a range spanning below, at, and above `PROD_EPSILON = 1e-9` (see Critical Implementation Details). New `describe`/`it` block asserting, via `runFitCheck`'s output, that the upper unit is placed (stacking succeeds) iff `lowerWeight + PROD_EPSILON >= upperWeight`, matching `support.ts:27`'s own comparison exactly.

#### 3. Raise `numRuns` on risk-critical blocks

**File**: `src/lib/services/packing/packer.property.test.ts`

**Intent**: Give the properties most tied to this phase's two risks (a confirmed past incident per test-plan interview Q2) more input coverage, without inflating CI time for blocks unrelated to those risks.

**Contract**: Set `numRuns: 250` on: the new combined-invariant block (item 1), the new boundary block (item 2), the existing weight-cap block (`:83-96`), and the existing weight-based-stacking block (`:98-121`). Leave the existing bounds/overlap block (`:56-80`) at `numRuns: 100`.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- All tests pass: `npm run test`
- Targeted file passes in isolation: `npx vitest run src/lib/services/packing/packer.property.test.ts`

#### Manual Verification:

- Temporarily reintroducing the historical bug this phase guards against (e.g. locally commenting out the `unit.weight + EPSILON < candidate.weight` clause in `support.ts:27`) causes the new combined-invariant and boundary properties to fail, confirming they actually catch the regression they're meant to catch.
- CI runtime for `npm run test` does not regress noticeably from the `numRuns` increase (spot-check local run time before/after).

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Deterministic combined-scenario unit tests + cookbook close-out

### Overview

Add the deterministic counterpart change.md names alongside "property-based" — concrete, hand-picked scenarios combining rotation, stacking, and weight that a reviewer can read and verify by eye — then close out this rollout phase by updating the test-plan cookbook per the standing rule that every rollout phase's plan ends with a §6 update.

### Changes Required:

#### 1. Scenario-table unit tests

**File**: `src/lib/services/packing/packer.test.ts`

**Intent**: Pin three concrete combined scenarios that the property tests cover statistically but that are worth a reviewer being able to read directly, especially the case at the heart of Risk #2: rotation flexibility must never be used to route around the weight-stacking gate.

**Contract**: Three new `it(...)` cases appended to the existing `describe("runFitCheck", ...)` block (`packer.test.ts:16`):
1. A rotatable, heavier item that has a geometrically valid rotated orientation matching a lighter stackable item's footprint, in a vehicle where stacking is the only way to fit both — expect `fits: false` (or a successful fit that does *not* place the heavier item above the lighter one), never a false `fits: true` produced by trying a different rotation.
2. The same shape as (1) but with `preserveOrder: true` and the heavier item entered second — expect `fits: false` with the existing weight-stacking reason string, proving `preserveOrder` and rotation don't combine to bypass the rule either.
3. A non-cube rotatable item in a vehicle sized so only one specific orientation fits — assert `result.placements[0].size` equals exactly one member of `getEligibleOrientations` for that item, not some other unvalidated combination of its dimensions.

#### 2. Cookbook update

**File**: `context/foundation/test-plan.md`

**Intent**: Fulfil the standing rule that each rollout phase's plan ends with a sub-phase updating the relevant §6 cookbook entry, so `/10x-tdd` (Lesson 2) and future contributors have a concrete answer for "how do I add a test for the packing invariants in this project."

**Contract**: Replace the `TBD — see §3 Phase 1 (...)` placeholder under §6.1 "Adding a unit test" with: location (`src/lib/services/packing/`), naming convention (`*.test.ts` for deterministic unit tests, `*.property.test.ts` for fast-check property tests, colocated with the module under test), a reference test (point at the new combined-invariant property block from Phase 1 and the rotation/weight scenario unit test from this phase), and the run command (`npm run test`, or `npx vitest run <path>` for a single file). Also add one line noting the `numRuns` convention this phase established (default 100, raised to ~250 for properties tied to a confirmed past-incident risk) so future phases know why blocks in this file differ.

### Success Criteria:

#### Automated Verification:

- All tests pass: `npm run test`
- Lint passes: `npm run lint`
- New scenario tests fail as expected when the historical bug is reintroduced locally (same manual check as Phase 1, repeated against the new unit tests)

#### Manual Verification:

- `context/foundation/test-plan.md` §6.1 no longer reads `TBD` and accurately describes where/how to add a packing test
- A reviewer unfamiliar with the property tests can read the three new unit-test scenarios in `packer.test.ts` and understand, without running anything, what correctness guarantee each one pins

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to close out the change.

---

## Testing Strategy

### Unit Tests:

- Three new scenario-table cases in `packer.test.ts` (Phase 2) combining rotation, weight, and stacking in ways the existing 11 cases don't.

### Integration Tests:

- None added in this phase — `src/pages/api/fit-check.ts` integration/contract testing is Phase 3 of the test-plan rollout, not this phase.

### Manual Testing Steps:

1. Temporarily comment out the weight-stacking clause in `support.ts:27`, run `npm run test`, confirm the new combined-invariant property, the new boundary property, and the new Phase 2 unit tests all fail.
2. Restore `support.ts:27`, re-run `npm run test`, confirm everything passes again.
3. Time `npm run test` before and after the `numRuns` increase to sanity-check CI runtime impact.

## Performance Considerations

Raising `numRuns` from 100 to 250 on four property blocks roughly 2.5x's their iteration count; each iteration runs `runFitCheck` against small inputs (≤4 items × ≤3 quantity, dims ≤120), so the expected CI time impact is on the order of a few extra seconds, not a meaningful regression to the `npm run test` step in `ci.yml`.

## Migration Notes

Not applicable — test-only change, no data or schema migration.

## References

- Research: `context/changes/testing-fit-check-correctness/research.md`
- Test-plan rollout entry: `context/foundation/test-plan.md` §3 Phase 1, §2 Risk Response Guidance rows #1/#2
- PRD ground truth: `context/foundation/prd-v3.md:39-41,79-84` (FR-009, FR-010, FR-011, Guardrails)
- Prior related work: `context/archive/2026-09-12-weight-aware-fit-check/plan.md`, `context/archive/2026-09-09-single-trip-fit-check/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Combined property-based correctness invariant

#### Automated

- [x] 1.1 Lint passes: `npm run lint`
- [x] 1.2 All tests pass: `npm run test`
- [x] 1.3 Targeted file passes in isolation: `npx vitest run src/lib/services/packing/packer.property.test.ts`

#### Manual

- [x] 1.4 Reintroducing the historical bug locally causes the new combined-invariant and boundary properties to fail
- [x] 1.5 CI runtime for `npm run test` does not regress noticeably from the `numRuns` increase

### Phase 2: Deterministic combined-scenario unit tests + cookbook close-out

#### Automated

- [ ] 2.1 All tests pass: `npm run test`
- [ ] 2.2 Lint passes: `npm run lint`
- [ ] 2.3 New scenario tests fail as expected when the historical bug is reintroduced locally

#### Manual

- [ ] 2.4 `context/foundation/test-plan.md` §6.1 no longer reads `TBD` and accurately describes where/how to add a packing test
- [ ] 2.5 A reviewer unfamiliar with the property tests can read the three new unit-test scenarios and understand the guarantee each one pins
