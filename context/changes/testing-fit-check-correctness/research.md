---
date: 2026-09-13T20:48:30Z
researcher: Pawel Rybowicz
git_commit: cd9721b43a6fc672ec5007cde3e31fe02ab6f63f
branch: master
repository: rybowpaw91/10xDevs
topic: "Fit-check packing correctness: FR-010 weight-stacking invariant survival under heuristic refactor (#1), and the exact point geometry + weight combine into the `fits` flag (#2)"
tags: [research, codebase, packing, fit-check, fr-010, property-testing]
status: complete
last_updated: 2026-09-13
last_updated_by: Pawel Rybowicz
---

# Research: Fit-check correctness guarantees (Test Plan §3 Phase 1, Risks #1 and #2)

**Date**: 2026-09-13T20:48:30Z
**Researcher**: Pawel Rybowicz
**Git Commit**: cd9721b43a6fc672ec5007cde3e31fe02ab6f63f
**Branch**: master
**Repository**: rybowpaw91/10xDevs

## Research Question

Ground `context/foundation/test-plan.md` §3 Phase 1 ("Twardnienie gwarancji poprawności fit-check") in the current code so tests can be planned for two risks without assuming the plan's own risk-response guidance blind:

- **Risk #1**: a packing-heuristic refactor could pass all existing tests yet break the FR-010 weight-ordering rule, because current tests may assert *current behavior* rather than *the invariant*. Where does the invariant actually live, and is it order-dependent?
- **Risk #2**: `fits` could be `true` despite a rotation/stacking violation or a payload overrun, because geometric and weight checks might be computed separately and merged incorrectly. Where, precisely, do they combine into the single `fits` boolean?

## Summary

**Risk #1 — FR-010 lives in one place, independent of sort order.** The weight-stacking rule is enforced entirely inside `isFullySupported` ([support.ts:27](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/support.ts#L27)): `if (!unit.stackable || unit.weight + EPSILON < candidate.weight) continue;`. The heaviest-first sort in `expandUnits` ([packer.ts:77-80](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L77-L80)) is only a *placement-heuristic aid* that makes the rule easier to satisfy — it is not itself the guarantee. This is confirmed by the existing `preserveOrder` unit tests ([packer.test.ts:153, 192, 228](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.test.ts#L153)), which show the rule holds (or cleanly reports no-fit) regardless of `preserveOrder`. **This means the correctness invariant a Phase 1 property test must express is order-independent** — exactly what the risk-response guidance in test-plan.md asks for, and exactly the kind of test that would survive a future heuristic refactor (a change to the sort/search order) without needing to change.

**Risk #2 — there is no "geometry flag AND weight flag"; it's one sequential gate.** `tryPlace` ([packer.ts:141-180](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L141-L180)) is the single function a candidate placement must pass through: bounds check (`fitsWithinVehicle`, line 151) → no-overlap (`boxesOverlap`, line 154) → weight-aware support (`isFullySupported`, lines 157-168). `runFitCheck`'s per-unit loop ([packer.ts:216-240](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L216-L240)) returns `fits: false` on the *first* unit that fails to find a valid spot via `tryPlace`, and `fits: true` only after every unit clears it ([packer.ts:248-255](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L248-L255)). There is also a payload short-circuit *before* the loop ([packer.ts:196-201](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L196-L201)). **Practical consequence for test design**: the correctness invariant must be asserted against `runFitCheck`'s output end-to-end (black-box on `FitCheckResult`), not by unit-testing `isFullySupported`/`fitsWithinVehicle` in isolation and assuming their conjunction is wired correctly — a wiring bug in the loop (e.g. skipping the support check for the first unit of each layer) would not be caught by isolated unit tests but would be caught by an end-to-end no-false-fits property.

**FR-010's exact wording lives in `prd-v3.md`, not `prd.md`.** Important discrepancy: `context/foundation/prd.md` (the path both CLAUDE.md's test-plan lesson and `test-plan.md` implicitly point to) is stale — PRD v1, no FR-009/FR-010, and its Guardrails/Non-Goals sections still say weight checking is an explicit v2 candidate. The actual current requirements (FR-009, FR-010, FR-011, amended FR-001/FR-002, and the weight-aware Guardrails clause) live in `context/foundation/prd-v3.md`, which is what the `weight-aware-fit-check` change's own plan.md cites. **This is a data hygiene gap, not a code gap** — flagged here so the upcoming `/10x-plan` step cites `prd-v3.md` explicitly rather than the stale `prd.md`.

**Existing coverage already covers the "obvious" halves of both risks — the gap is the combined/order-independent framing the test-plan calls out.** `packer.property.test.ts` already has three separate property blocks: no-overlap/in-bounds ([:56-80](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.property.test.ts#L56-L80)), weight cap ([:83-96](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.property.test.ts#L83-L96)), and weight-based stacking ([:98-121](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.property.test.ts#L98-L121)). None of them: (a) assert rotation validity of the placed orientation against `getEligibleOrientations`, (b) run with `preserveOrder: true` as well as the default, or (c) use fractional/near-`EPSILON` boundary values (`fc.integer` only — flagged by the prior impl-review as F3, a real boundary-case gap given the risk-response's explicit "nawet dla wejść granicznych").

## Detailed Findings

### Combination point for the `fits` flag (Risk #2)

- `runFitCheck` — [packer.ts:182-256](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L182-L256) — sole exported entry point.
  - Empty-items short-circuit: `fits: true` trivially for zero items ([packer.ts:185-194](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L185-L194)) — bypasses both weight cap and geometry. Worth an explicit test pinning this as intended behavior, not an oversight.
  - Payload short-circuit ([packer.ts:196-201](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L196-L201)): `totalWeight > vehicle.maxPayload + EPSILON` → immediate `fits: false` via `emptyNoFitResult` ([packer.ts:128-139](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L128-L139)).
  - Oversized-dimension short-circuit ([packer.ts:203-209](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L203-L209)), fed by `findOversizedItemIds` ([packer.ts:48-61](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L48-L61)).
  - Main loop ([packer.ts:216-240](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L216-L240)): for each expanded unit, tries orientations (`getEligibleOrientations`, line 217) × extreme points (sorted by `compareExtremePoints`, line 218) via `tryPlace`; first unit that can't be placed triggers a diagnostic re-check ignoring weight ([packer.ts:220-229](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L220-L229)) to produce a weight-specific vs. generic no-fit reason, then returns `fits: false`.
  - Success path ([packer.ts:248-255](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L248-L255)): `fits: true` only if the loop completes without early return.
- `tryPlace` — [packer.ts:141-180](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L141-L180) — the actual gate: bounds (`fitsWithinVehicle`, line 151) → overlap (`boxesOverlap`, line 154) → weight-aware support (`isFullySupported`, lines 157-168), in that order, all required to accept a candidate spot (lines 170-176).
- `isFullySupported` — [support.ts:19-40](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/support.ts#L19-L40) — ground level always supported (line 20); disqualifies non-stackable or lighter-than-candidate support units (line 27); requires coverage area to sum to full footprint (lines 29-39).

### FR-010 weight-stacking mechanism and order-independence (Risk #1)

- Disqualifying condition — [support.ts:27](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/support.ts#L27): `if (!unit.stackable || unit.weight + EPSILON < candidate.weight) continue;` — equal weight is allowed (matches PRD FR-010 "at least as heavy").
- Heaviest-first heuristic sort — [packer.ts:63-81](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L63-L81), specifically line 78-80: only applied when `preserveOrder` is `false`. When `true`, entry order is kept exactly and a violation is reported as no-fit rather than silently reordered ([packer.test.ts:192](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.test.ts#L192)) — confirms the invariant does not depend on which sort/search strategy is used, only on the `support.ts:27` gate.
- `EPSILON` is duplicated as a literal in both `packer.ts:12` and `support.ts:3` (not shared from one constant) — a future refactor changing one without the other would desynchronize near-tie boundary behavior. Worth a note for anyone touching this during the planned heuristic refactor.

### Rotation and stacking geometry

- `getEligibleOrientations` — [geometry.ts:13-36](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/geometry.ts#L13-L36): non-rotatable → single given orientation; rotatable → up to 6 deduplicated permutations.
- `fitsWithinVehicle` — [packer.ts:40-46](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L40-L46) — bounds check per orientation × candidate point.
- `boxesOverlap` — [geometry.ts:38-47](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/geometry.ts#L38-L47) — pairwise AABB overlap, independent of stacking rules.
- `stackable` flag is consulted **only** inside `isFullySupported` ([support.ts:27](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/support.ts#L27)) — a non-stackable placed unit can never support anything above it, independent of weight.

### Existing test coverage (baseline to extend, not to snapshot)

- `packer.test.ts` (11 unit tests) — covers exact fit, volume no-fit, oversized-item naming, layered stacking, non-rotatable orientation, mixed flags, payload no-fit with real numbers, weight-utilization %, and three `preserveOrder`-focused cases (free-order reordering, preserve-order no-fit, preserve-order success) — [packer.test.ts:1-260ish](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.test.ts).
- `packer.property.test.ts` — three property blocks (no-overlap/in-bounds, weight cap, weight-stacking) at [:56-121](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.property.test.ts#L56-L121); arbitraries `goodsItemArb`/`requestArb` at [:12-37](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.property.test.ts#L12-L37) use `fc.integer`-range values only (no fractional/near-`EPSILON` boundary values), and none of the three vary `preserveOrder`.
- `geometry.test.ts` and `support.test.ts` — unit-level coverage of orientation enumeration and support-area logic in isolation, including the FR-010 boundary case "equal weight allowed" ([support.test.ts:32](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/support.test.ts#L32)) and "heavier-on-lighter rejected" ([support.test.ts:37](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/support.test.ts#L37)).
- No test file yet for `src/pages/api/fit-check.ts` or `fit-check-schema.ts` — out of scope for this phase (Phase 3 covers input validation per test-plan.md), noted only for completeness.

### API surface and validation (context, not this phase's target)

- `src/pages/api/fit-check.ts:15-30` — `POST` handler: parses JSON, validates via `fitCheckRequestSchema.safeParse`, calls `runFitCheck` directly with no extra business logic, returns the raw `FitCheckResult`.
- `src/lib/validation/fit-check-schema.ts` — `TOTAL_UNIT_CAP = 200` ([:3](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/validation/fit-check-schema.ts#L3)), cross-field `.refine()` enforcing the cap ([:28-31](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/validation/fit-check-schema.ts#L28-L31)); this cap is the subject of the CPU-benchmarking lesson (see below) and Phase 3's risk #6, not this phase.

### Types

- `src/types.ts:1-55` — `GoodsItemInput`, `VehicleDimensionsInput`, `FitCheckRequest`, `PlacedUnit`, `LayerFootprint`, `LayerGrid`, `FitCheckResult` (the shape returned verbatim by the API and consumed by `GoodsFitForm.tsx`).

## Code References

- [src/lib/services/packing/packer.ts:141-180](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L141-L180) — `tryPlace`, the single combined geometry+weight gate (Risk #2 crux).
- [src/lib/services/packing/packer.ts:182-256](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L182-L256) — `runFitCheck`, the exported entry point and only place `fits` is set.
- [src/lib/services/packing/packer.ts:63-81](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L63-L81) — `expandUnits`, the order/heuristic layer (Risk #1: not itself the guarantee).
- [src/lib/services/packing/support.ts:19-40](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/support.ts#L19-L40) — `isFullySupported`, where FR-010 is actually enforced (line 27).
- [src/lib/services/packing/geometry.ts:13-47](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/geometry.ts#L13-L47) — `getEligibleOrientations`, `boxesOverlap`.
- [src/lib/services/packing/packer.property.test.ts:56-121](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.property.test.ts#L56-L121) — existing property blocks to extend, not replace.
- [src/lib/services/packing/packer.test.ts:153-260](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.test.ts#L153) — `preserveOrder` unit tests proving order-independence today (baseline for the property test's order-independence framing).
- [context/foundation/prd-v3.md:39-41,79-84](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/context/foundation/prd-v3.md#L39-L41) — FR-009, FR-010, FR-011, Guardrails (the actual current PRD; `prd.md` is stale).
- [context/foundation/lessons.md:5-10](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/context/foundation/lessons.md#L5-L10) — CPU-cap benchmarking lesson (Phase 3 concern, not this phase, but same file family).

## Architecture Insights

- **The `fits` flag is procedural, not a boolean conjunction.** `runFitCheck` never computes "geometryFits && weightFits" as two independent values merged at the end; it's a single sequential accept/reject per unit inside `tryPlace`. Tests aimed at Risk #2 must exercise `runFitCheck` end-to-end rather than trusting that unit tests on `isFullySupported` and `fitsWithinVehicle` in isolation compose correctly — a wiring bug in the loop itself (e.g., a future refactor that reorders the checks inside `tryPlace` or short-circuits before reaching `isFullySupported`) would only be caught by an assertion against the final `FitCheckResult`.
- **The FR-010 guarantee point and the heuristic are cleanly separated already.** `support.ts:27` is the only place that can reject a placement for weight-stacking reasons; `expandUnits`'s sort is a best-effort ordering aid consumed by the search, not a second enforcement path. This is good news for Risk #1: a property test written against `runFitCheck`'s output (not against the sort order or the intermediate `packingOrder` array) will naturally survive a heuristic refactor that changes *how* units are ordered/searched, as long as it doesn't touch `support.ts:27`.
- **`preserveOrder` is the built-in "change the heuristic" lever already in the codebase.** Since it flips between heaviest-first sorting and exact-entry-order, running the same combined-invariant property test under both `preserveOrder: true` and `preserveOrder: false` is a cheap, already-available proxy for "the heuristic changed" — directly useful for proving Risk #1's "independent of reordering" requirement without waiting for an actual future refactor.
- **Diagnostic weight-reason re-check is side-effect-free.** The second `tryPlace` call with `Number.NEGATIVE_INFINITY` as support weight ([packer.ts:220-229](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.ts#L220-L229)) only produces a reason string; it cannot itself cause a false `fits: true` (confirmed by prior impl-review, findings F4/F5).
- **Known boundary gap**: property arbitraries are integer-only ([packer.property.test.ts:12-37](https://github.com/rybowpaw91/10xDevs/blob/cd9721b43a6fc672ec5007cde3e31fe02ab6f63f/src/lib/services/packing/packer.property.test.ts#L12-L37)), so near-`EPSILON` boundary cases (e.g., weight differences of 1e-10) are exercised only by hand-written unit tests (`support.test.ts:32,37`), never by the properties. The risk-response guidance's "nawet dla wejść granicznych" (even for boundary inputs) is not yet satisfied at the property layer.

## Historical Context (from prior changes)

- `context/archive/2026-09-12-weight-aware-fit-check/` — introduced FR-009/FR-010 into the packer. Implemented the weight-stacking rule by extending `isFullySupported`'s disqualifying condition (previously `!unit.stackable` only), added the payload short-circuit, and added `preserveOrder` mid-implementation based on manual-testing feedback (explicitly flagged in that change's own addendum as "the accurate record of what shipped" vs. the original plan). Its impl-review (APPROVED) flagged the same integer-only-arbitraries gap (F3) this research confirms is still open.
- `context/archive/2026-09-09-single-trip-fit-check/` — original fit-check: extreme-point heuristic, first-fit-decreasing-by-volume ordering, 100%-support stacking rule (pre-weight), 200-unit cap chosen from algorithmic estimate (this is the origin of the `lessons.md` CPU-benchmarking rule, relevant to Phase 3 not Phase 1). Its own core correctness guardrail language ("`runFitCheck` never returns `fits: true` if any pairwise overlap or unsupported placement exists") is the direct ancestor of this phase's Risk #2.
- `context/foundation/roadmap.md:116,121,124` — M-1 (single-trip-fit-check) and M-3 (weight-aware-loading) milestone closures corroborate both archived changes above; no additional undiscovered decisions.
- `context/foundation/lessons.md:5-10` — CPU-cap-benchmarking rule, same code family (`packer.ts`) but scoped to Phase 3's risk #6, not this phase.

**Data hygiene flag (not a code risk, but affects the next step):** `context/foundation/prd.md` is PRD v1 and does not contain FR-009/FR-010 at all — it still lists weight/max-load checking as an explicit Non-Goal. The canonical current PRD is `context/foundation/prd-v3.md`. `/10x-plan` for this phase should cite `prd-v3.md` explicitly; the stale `prd.md` should probably be reconciled or archived at some point, but that's outside this phase's scope.

## Related Research

- `context/archive/2026-09-12-weight-aware-fit-check/plan.md` and `reviews/impl-review.md`
- `context/archive/2026-09-09-single-trip-fit-check/plan.md` and `reviews/impl-review.md`
- `context/foundation/test-plan.md` §2 (Risk Map, Risk Response Guidance) and §3 Phase 1

## Open Questions

1. Should the Phase 1 plan explicitly point at `prd-v3.md` rather than `prd.md` when citing FR-009/FR-010 (given `prd.md` is stale and contradicts them)? This research treats `prd-v3.md` as ground truth per the `weight-aware-fit-check` change's own precedent.
2. Should the property arbitraries move from `fc.integer` to a mix including `fc.float`/near-`EPSILON` deltas to close the boundary-case gap the prior impl-review already flagged (F3), given the risk-response guidance explicitly calls for boundary inputs?
3. Should the combined-invariant property test for Risk #2 also vary `preserveOrder` (both `true`/`false`) in the same property, to directly operationalize Risk #1's "survives reordering" requirement using the lever already in the codebase, rather than treating it as a separate property?
