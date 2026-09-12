# Weight-Aware Fit Check Implementation Plan

## Overview

Extend the stateless fit-check feature (M-1) so weight is a first-class feasibility constraint alongside volume: each goods item gets a weight, each vehicle gets a maximum payload, a "fits" result requires both the volume-based packing to succeed AND total weight to stay within the payload cap, the packing order never places a heavier item above a lighter one, and the user sees a weight-utilization percentage alongside the existing volume-utilization one. Covers FR-001 (amended), FR-002 (amended), FR-009, FR-010, FR-011.

## Current State Analysis

- **The packing algorithm has zero weight awareness today**, confirmed by direct read of `src/lib/services/packing/packer.ts` and `src/lib/services/packing/support.ts`. `isFullySupported` (`support.ts:17-38`) checks only footprint overlap and the `stackable` flag — no mass comparison anywhere.
- **`GoodsItemInput`/`VehicleDimensionsInput`/`FitCheckResult` (`src/types.ts`) have no weight/payload/weight-utilization fields.** `goodsItemSchema`/`vehicleDimensionsSchema` (`src/lib/validation/fit-check-schema.ts`) validate none of them either.
- **A schema-sharing gotcha**: `vehicleDimensionsSchema` is reused by `src/lib/validation/vehicle-profile-schema.ts` via `.extend({ label: ... })`. Adding `maxPayload` directly to `vehicleDimensionsSchema` would silently force the already-shipped vehicle-profile save endpoint to require it too — contradicting the explicit decision (this session) to leave saved vehicle profiles and goods-item templates untouched. `goodsItemSchema` has no equivalent risk: `goods-item-template-schema.ts` builds its schema via `.pick({ length, width, height, rotatable, stackable })`, an explicit whitelist that simply won't pull in a new `weight` field.
- **`src/pages/api/fit-check.ts` needs zero code changes** — it already validates generically against `fitCheckRequestSchema` and calls `runFitCheck`; schema/algorithm changes flow through automatically.
- **The test suite already has a property-testing precedent for exactly this class of invariant**: `src/lib/services/packing/packer.property.test.ts` uses `fast-check` to assert "never a false positive" over generated inputs. The two new weight guardrails (never exceed payload, never stack heavier-over-lighter) get the same treatment.
- **Vehicle presets (`src/lib/constants/vehicle-presets.ts`) have no payload values** and need illustrative ones added so selecting a preset still means zero manual entry for weight-capacity, matching how their dimensions are already illustrative rather than sourced.

### Key Discoveries:

- `src/lib/services/packing/support.ts:17` `isFullySupported(candidate, placed)` — the exact function to extend with a weight comparison; `placed` units already carry `stackable`, adding `weight` alongside it is a minimal, targeted change.
- `src/lib/services/packing/packer.ts:47-60` `findOversizedItemIds` and `packer.ts:125-135` `emptyNoFitResult` are the established pattern for early, specific no-fit reasons — the new weight-cap check follows the same shape.
- `src/lib/services/packing/packer.ts:62-78` `expandUnits` already carries per-unit `stackable`/`rotatable`/`volume` derived from the parent item — `weight` joins this list the same way (each unit of a multi-quantity item shares the item's per-unit weight).
- `src/components/fit-check/GoodsFitForm.tsx` — `GoodsRowState`/`VehicleState`/`buildRequest`/`createRow` are the exact places a new field slots into, following the existing length/width/height convention (string state, `Number(...)` at submission).
- `context/foundation/lessons.md`'s only rule (benchmark compute-heavy caps against real runtime) does not trigger here — this change adds O(1) extra work per placement candidate, it does not raise `TOTAL_UNIT_CAP` or change the algorithm's asymptotic complexity.

## Desired End State

A user enters a weight for every goods item (alongside length/width/height/quantity/rotatable/stackable) and a maximum payload for the vehicle (alongside length/width/height, prefillable via preset or saved profile as before). Submitting returns: `fits: false` with a reason of "Total goods weight exceeds the vehicle's maximum payload" whenever total weight exceeds the cap, regardless of volume fit; `fits: false` with a reason naming the weight-based stacking rule specifically when a load fails only because no arrangement could keep every item's support heavy enough; `fits: false` with the existing volume-only reason when neither weight rule is the blocker; and on success, a weight-utilization percentage displayed next to the existing volume-utilization percentage, with a packing order that never places a heavier unit directly above a lighter one.

**Verification**: automated unit + property tests cover both new invariants (weight-cap hard limit, heavier-below-lighter stacking) the same way the existing volume invariant is covered; manual verification includes a scenario where a light item is entered before a heavy one, confirming the heavy item still ends up lower (proving the rule works, not just input-order luck).

## What We're NOT Doing

- No weight/max-payload field on saved goods-item templates (FR-007) or vehicle profiles (FR-008) — confirmed deferred; loading a saved item/profile still leaves weight/payload for fresh manual entry every time. Recorded in the roadmap's `## Parked` as a candidate follow-up.
- No change to `src/pages/api/fit-check.ts`, `src/middleware.ts`, or any persistence/auth surface — this feature remains fully stateless, same as M-1.
- No change to the packing algorithm's unit-ordering heuristic (still sorted by volume descending) — weight is enforced as a placement-time filter only, not a new sort key.
- No relaxing or raising of `TOTAL_UNIT_CAP` (`fit-check-schema.ts`) — out of scope and unrelated to this change.
- No exact numeric breakdown of *why* a load is over payload (e.g., "you're 12kg over") — the reason states the constraint was violated, matching the existing volume-failure reason's level of detail.

## Implementation Approach

Two phases, bottom-up: business logic first (types → schema → algorithm → tests), fully verifiable via `npm run test` without any UI; then UI integration wiring the new fields into the existing form and result view. This mirrors M-1's original phase shape and keeps the algorithmic change — the highest-risk part — isolated and testable before any UI work depends on it.

## Critical Implementation Details

### Extending shared schemas without leaking into vehicle profiles

`vehicleDimensionsSchema` must NOT gain `maxPayload` directly (see Current State Analysis) — `fitCheckRequestSchema`'s `vehicle` field must instead use `vehicleDimensionsSchema.extend({ maxPayload: z.number().positive() })` as an inline (or separately named, implementer's choice) schema local to `fit-check-schema.ts`, leaving the exported `vehicleDimensionsSchema` itself untouched so `vehicleProfileInputSchema`'s `.extend()` in `vehicle-profile-schema.ts` keeps working exactly as before.

### Weight-based stacking via a reused support check

`isFullySupported`'s `SupportCandidate`/`SupportingUnit` both gain a `weight: number` field. The covered-area loop's disqualifying condition changes from `if (!unit.stackable) continue;` to `if (!unit.stackable || unit.weight + EPSILON < candidate.weight) continue;` — the `+ EPSILON` makes equal weights qualify (FR-010: "at least as heavy"), consistent with this file's existing epsilon-tolerant float comparisons.

### Classifying a placement failure as weight-blocked vs volume-blocked

When the placement loop for a unit exhausts every candidate/orientation without success, re-run the identical geometric+overlap checks with `isFullySupported` called using `weight: Number.NEGATIVE_INFINITY` as the candidate's weight (so the weight condition can never disqualify a support unit). If that diagnostic pass finds a spot that the real pass didn't, the failure is specifically weight-stacking-blocked; otherwise it's the existing volume/geometry no-fit reason. This diagnostic pass is for reason classification only — it must not affect what actually gets placed.

### Per-unit weight, not per-item

Each item's `weight` is a per-unit value: with `quantity: 3` and `weight: 10`, each of the 3 expanded units weighs 10 (contributing 30 to the total payload sum), mirroring how `length`/`width`/`height` already describe one unit, not the batch.

## Phase 1: Data Model & Packing Algorithm

### Overview

Add weight/max-payload to the type and validation layers (via the safe-extension pattern above), implement the hard weight cap, the weight-aware support check, three-way reason differentiation, and weight-utilization computation in the packing algorithm, with unit and property test coverage for both new invariants.

### Changes Required:

#### 1. Domain types

**File**: `src/types.ts`

**Intent**: Add the new fields the rest of the layer needs.

**Contract**: `GoodsItemInput` gains `weight: number`. `VehicleDimensionsInput` gains `maxPayload: number`. `FitCheckResult` gains `weightUtilizationPercent: number` (present on every result, `0` on any no-fit path, matching how `utilizationPercent` already behaves today).

#### 2. Validation schema

**File**: `src/lib/validation/fit-check-schema.ts`

**Intent**: Validate the two new inputs without leaking a required field into the shared `vehicleDimensionsSchema` that vehicle-profile validation also extends.

**Contract**: `goodsItemSchema` gains `weight: z.number().positive()`. `fitCheckRequestSchema`'s `vehicle` field changes from `vehicleDimensionsSchema` to `vehicleDimensionsSchema.extend({ maxPayload: z.number().positive() })` — `vehicleDimensionsSchema` itself is exported unchanged.

#### 3. Weight-aware support check

**File**: `src/lib/services/packing/support.ts`

**Intent**: Enforce "an item may only be placed on top of another item if the item below is at least as heavy" (FR-010).

**Contract**: `SupportCandidate` and `SupportingUnit` both gain `weight: number`. `isFullySupported`'s per-unit disqualifying condition becomes `!unit.stackable || unit.weight + EPSILON < candidate.weight` (per Critical Implementation Details).

#### 4. Packing algorithm: weight cap, unit weight propagation, reason differentiation, weight utilization

**File**: `src/lib/services/packing/packer.ts`

**Intent**: Wire weight through the whole computation and produce the three distinct no-fit reasons plus the weight-utilization percentage.

**Contract**: `ExpandedUnit` and `PlacedUnitInternal` gain `weight: number`, populated per-unit in `expandUnits` from the parent item's `weight` (per Critical Implementation Details' per-unit note). Early in `runFitCheck`, after the empty-items check, compute `totalWeight` (sum of `item.weight * item.quantity` across all items) and return `emptyNoFitResult("Total goods weight exceeds the vehicle's maximum payload.")` when `totalWeight > vehicle.maxPayload + EPSILON`, before the existing oversized-dimension check. Every call site building a `SupportingUnit`/`SupportCandidate` for `isFullySupported` passes the unit's/candidate's `weight`. When the placement loop for a unit fails to find a spot, apply the diagnostic re-check from Critical Implementation Details to choose between the existing volume reason and a new one naming the weight-based stacking rule specifically. On success, compute `weightUtilizationPercent` the same way `utilizationPercent` is computed (`totalWeight / vehicle.maxPayload * 100`, rounded to 2 decimals); `emptyNoFitResult` and the empty-items trivial-fit path both set `weightUtilizationPercent: 0`.

#### 5. Unit tests

**File**: `src/lib/services/packing/packer.test.ts`

**Intent**: Cover the new behavior with concrete examples, mirroring the file's existing style.

**Contract**: New `it(...)` cases: total weight over payload → `fits: false` with the weight-cap reason regardless of volume fit; a two-item scenario where the lighter item is entered first but the heavier one must end up lower — assert via `result.placements`' `position.z` ordering that the heavier unit's `z` is `<=` the lighter one's; a scenario engineered so the only geometrically-available spot for a unit is directly above a lighter one — assert `fits: false` with the weight-stacking reason (not the generic volume reason); a successful scenario asserting `weightUtilizationPercent` is computed correctly.

#### 6. Property tests

**File**: `src/lib/services/packing/packer.property.test.ts`

**Intent**: Extend the existing "never a false positive" property-testing approach to the two new guardrails, verified from `result.placements` alone (not from packer internals), matching how the existing property test independently re-checks `boxesOverlap` rather than trusting the packer.

**Contract**: The generated-item arbitrary (`goodsItemArb`) gains a `weight` field; the vehicle arbitrary gains `maxPayload`. Two new properties: (1) `runFitCheck` never returns `fits: true` when the sum of `item.weight * item.quantity` across `request.items` exceeds `request.vehicle.maxPayload`; (2) for every pair of returned `placements` where one unit's footprint (by position/size) touches directly on top of another's (z-adjacent with x/y overlap), the unit below's weight (looked up from `request.items` by `itemId`) is not less than the unit above's weight, within the same epsilon tolerance used elsewhere in the file.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes with the new fields in place
- `npm run test` passes, including the new unit tests (item 5) and property tests (item 6)

#### Manual Verification:

- None — this phase is pure business logic, fully covered by automated tests; manual verification happens end-to-end in Phase 2.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: UI Integration (Fit-Check Form & Result)

### Overview

Wire weight and max-payload into the existing goods-row and vehicle-section UI, add illustrative payload values to the hardcoded presets, and display weight utilization in the result view.

### Changes Required:

#### 1. Vehicle presets

**File**: `src/lib/constants/vehicle-presets.ts`

**Intent**: Keep presets fully usable with the new mandatory field.

**Contract**: `VehiclePreset` gains `maxPayload: number`; each of the 4 existing presets gets an illustrative value in the same approximate, non-sourced spirit as their existing dimensions (e.g., small panel van ~800, LWB high-roof van ~1200, 3.5t box truck ~1300, 7.5t truck ~3500 — implementer's call on exact figures).

#### 2. Goods row: weight input

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Let the user enter each item's weight alongside its existing dimension fields.

**Contract**: `GoodsRowState` gains `weight: string` (default `""`, matching length/width/height's convention — not quantity's `"1"` default, since weight has no sensible universal default). `createRow` initializes it accordingly. A new `Input` (type="number", min="0") added to each row's field grid, following the existing Length/Width/Height/Quantity pattern; the row grid's column count grows to fit (currently `sm:grid-cols-6`). `buildRequest` maps `weight: Number(row.weight)` into the request item.

#### 3. Vehicle section: max-payload input

**File**: `src/components/fit-check/GoodsFitForm.tsx`

**Intent**: Let the user enter the vehicle's max payload, prefillable from a preset.

**Contract**: `VehicleState` gains `maxPayload: string` (default `""`). A new `Input` added to the vehicle section alongside Length/Width/Height. `handlePresetChange` sets `maxPayload` from `preset.maxPayload` when a hardcoded preset is selected; when a saved profile is selected (`savedProfiles` has no `maxPayload` field per the deferred-scope decision) or `"custom"` is chosen, `maxPayload` is left as whatever the user already has typed (not cleared, not overwritten) — mirroring how other fields already fall back to `prev.<field>` when `source` doesn't cover them. `buildRequest` maps `vehicle.maxPayload: Number(vehicle.maxPayload)` into the request.

#### 4. Result view: weight utilization

**File**: `src/components/fit-check/FitCheckResult.tsx`

**Intent**: Show the new weight-utilization percentage alongside the existing volume one.

**Contract**: On the `fits: true` branch, add a line below the existing "Volume utilization (volume-only): …%" line reading something like "Weight utilization: {result.weightUtilizationPercent}%". No change needed to the `fits: false` branch — the three distinct reasons from Phase 1 already flow through the existing `{result.reason}` text.

#### Addendum (in-session extension, requested during Phase 2 manual testing, documented here after the fact)

Two pieces of feedback surfaced once weight-aware fit checking was visible end-to-end, both implemented as part of Phase 2 rather than deferred:

1. **Failure detail must show the actual numbers, not just descriptive text.** `packer.ts`'s weight-cap and weight-stacking-blocked reason strings now embed the real values directly (e.g. `Total goods weight (100 kg) exceeds the vehicle's maximum payload (50 kg).` and `Item "heavy" (50 kg) has no sufficiently heavy item to rest on: ...`) — single source of truth, no client-side recomputation. The oversized-dimensions case is enriched client-side instead: `FitCheckResultView` now takes an `items: GoodsItemInput[]` prop (the submitted request's items, tracked in a new `resultItems` state in `GoodsFitForm.tsx`) and looks up each oversized item's own dimensions to display alongside the vehicle's cargo dimensions — no backend response-shape change needed for that case.
2. **Whether entry order matters is a user choice, not a fixed algorithm behavior.** `FitCheckRequest`/`fitCheckRequestSchema` gain a required `preserveOrder: boolean`. In `packer.ts`, `expandUnits` either preserves the exact input order (skips sorting entirely — the push order already is that order) when `preserveOrder` is true, or sorts by weight descending (heaviest unit first, replacing the old volume-descending default) when false, so heavier items get placed first and lighter ones can rest on them. A `Checkbox` in `GoodsFitForm.tsx` ("Preserve the exact order shown below when packing"), unchecked by default, drives this. This is a genuine behavior change from Phase 1's original volume-descending default — Phase 1's own `## Changes Required` text above still describes the shape as originally planned; this addendum is the accurate record of what shipped.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- Type checking passes
- `npm run build` succeeds

#### Manual Verification:

- Entering a goods list whose total weight exceeds the vehicle's max payload shows "doesn't fit" with a reason naming the payload limit **and showing the actual total-weight and max-payload numbers**, even when the same goods would fit by volume alone
- An oversized-item no-fit shows each oversized item's own dimensions alongside the vehicle's cargo dimensions, not just a bare item name
- On a successful fit, the weight-utilization percentage is shown alongside the volume-utilization percentage and looks correct for the entered values
- **"Preserve entry order" unchecked (default)**: enter a light item first, then a heavier item second; submit and confirm the heavier item still ends up placed lower (not stacked above the lighter one) — the algorithm reorders for you
- **"Preserve entry order" checked**: same light-then-heavy input; submit and confirm it now reports "doesn't fit" with a reason naming the weight-based stacking rule and the specific item, rather than silently reordering
- Selecting a vehicle preset prefills its max payload alongside its dimensions
- Selecting a saved vehicle profile prefills dimensions but leaves whatever max payload was already entered untouched (not cleared)
- Signed-out visit to the fit-check page still redirects to sign-in (unchanged baseline)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- `packer.test.ts`: weight-cap hard limit overriding volume fit; heavier-below-lighter placement ordering; weight-stacking-specific no-fit reason distinguished from the generic volume reason; `weightUtilizationPercent` computed correctly on success

### Integration Tests:

- None automated — this feature has no API/persistence surface beyond the already-tested generic JSON+zod route pattern; covered by Phase 2's manual verification instead.

### Property Tests:

- `packer.property.test.ts`: never `fits: true` when total weight exceeds max payload; never a placed unit sitting directly atop another placed unit that's lighter than it (checked independently from `result.placements`, not from packer internals)

### Manual Testing Steps:

1. Sign in, navigate to `/fit-check`.
2. Enter goods whose total weight exceeds a vehicle's max payload but which would easily fit by volume; submit; confirm "doesn't fit" with a payload-specific reason.
3. Enter a light item first, then enter a heavier item second; choose dimensions/vehicle such that the heavier item could geometrically go either above or beside the light one; submit; confirm the packing order/layers show the heavier item lower, never stacked on the lighter one.
4. Enter a load that fits comfortably by both volume and weight; submit; confirm both volume-utilization and weight-utilization percentages are shown and look numerically correct.
5. Select each vehicle preset in turn; confirm max payload prefills alongside dimensions.
6. Select a saved vehicle profile (from M-2); confirm dimensions prefill but max payload is left as whatever was already typed.

## Performance Considerations

Negligible — the weight cap is a single O(n) sum computed once per request; the support-check change adds one comparison per candidate unit pair, not a new loop nesting level. Per `context/foundation/lessons.md`'s only rule, this doesn't raise or remove `TOTAL_UNIT_CAP`, so no new benchmark is required.

## Migration Notes

None — this feature is entirely stateless (no new tables, no schema migration). Rolling back means reverting the type/schema/algorithm/UI changes; no data cleanup needed.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01, milestone M-3)
- PRD: `context/foundation/prd-v3.md` (FR-001, FR-002, FR-009, FR-010, FR-011, US-01)
- Existing packing algorithm (extended, not replaced): `src/lib/services/packing/packer.ts`, `src/lib/services/packing/support.ts`
- Existing property-test precedent: `src/lib/services/packing/packer.property.test.ts`
- Existing JSON API + zod pattern (unchanged by this plan): `src/pages/api/fit-check.ts`
- Sibling schema-sharing pattern to avoid disturbing: `src/lib/validation/vehicle-profile-schema.ts`, `src/lib/validation/goods-item-template-schema.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Model & Packing Algorithm

#### Automated

- [x] 1.1 `npm run lint` passes — 3fdd729
- [x] 1.2 Type checking passes with the new fields in place — 3fdd729
- [x] 1.3 `npm run test` passes, including new unit and property tests — 3fdd729

### Phase 2: UI Integration (Fit-Check Form & Result)

#### Automated

- [x] 2.1 `npm run lint` passes — 2eda54c
- [x] 2.2 Type checking passes — 2eda54c
- [x] 2.3 `npm run build` succeeds — 2eda54c

#### Manual

- [x] 2.4 Weight-over-payload load reports "doesn't fit" with a payload-specific reason showing the actual numbers, even when it fits by volume — 2eda54c
- [x] 2.5 Oversized-item no-fit shows each item's own dimensions alongside the vehicle's cargo dimensions — 2eda54c
- [x] 2.6 Successful fit shows both volume-utilization and weight-utilization percentages, numerically correct — 2eda54c
- [x] 2.7 "Preserve entry order" unchecked (default): heavier item ends up placed lower via reordering, never stacked above the lighter one — 2eda54c
- [x] 2.8 "Preserve entry order" checked: same input reports doesn't-fit naming the weight-based stacking rule, instead of reordering — 2eda54c
- [x] 2.9 Vehicle preset selection prefills max payload alongside dimensions — 2eda54c
- [x] 2.10 Saved vehicle profile selection prefills dimensions but leaves max payload untouched — 2eda54c
- [x] 2.11 Signed-out visit still redirects to sign-in — 2eda54c
