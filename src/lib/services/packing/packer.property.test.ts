import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { FitCheckRequest, GoodsItemInput, PlacedUnit } from "@/types";
import { boxesOverlap, getEligibleOrientations } from "./geometry";
import { runFitCheck } from "./packer";

const EPSILON = 1e-6;

const dimensionArb = fc.integer({ min: 5, max: 50 });
const weightArb = fc.integer({ min: 1, max: 50 });

const goodsItemArb = fc.record({
  id: fc.constant(""),
  length: dimensionArb,
  width: dimensionArb,
  height: dimensionArb,
  weight: weightArb,
  quantity: fc.integer({ min: 1, max: 3 }),
  rotatable: fc.boolean(),
  stackable: fc.boolean(),
});

const requestArb: fc.Arbitrary<FitCheckRequest> = fc
  .record({
    items: fc.array(goodsItemArb, { minLength: 1, maxLength: 4 }),
    vehicle: fc.record({
      length: fc.integer({ min: 20, max: 120 }),
      width: fc.integer({ min: 20, max: 120 }),
      height: fc.integer({ min: 20, max: 120 }),
      maxPayload: fc.integer({ min: 10, max: 500 }),
    }),
    preserveOrder: fc.boolean(),
  })
  .map((request) => ({
    ...request,
    items: request.items.map((item, index) => ({ ...item, id: `item-${index}` })),
  }));

function overlaps(a: PlacedUnit, b: PlacedUnit): boolean {
  return boxesOverlap({ ...a.position, ...a.size }, { ...b.position, ...b.size });
}

function isDirectlyBelow(below: PlacedUnit, above: PlacedUnit): boolean {
  const touchesZ = Math.abs(below.position.z + below.size.height - above.position.z) < EPSILON;
  if (!touchesZ) return false;

  const overlapX =
    Math.min(above.position.x + above.size.length, below.position.x + below.size.length) -
    Math.max(above.position.x, below.position.x);
  const overlapY =
    Math.min(above.position.y + above.size.width, below.position.y + below.size.width) -
    Math.max(above.position.y, below.position.y);
  return overlapX > 0 && overlapY > 0;
}

describe("runFitCheck property: no false positives", () => {
  it("never reports fits:true with overlapping or out-of-bounds placements", () => {
    fc.assert(
      fc.property(requestArb, (request) => {
        const result = runFitCheck(request);
        if (!result.fits) return;

        for (const unit of result.placements) {
          expect(unit.position.x).toBeGreaterThanOrEqual(0);
          expect(unit.position.y).toBeGreaterThanOrEqual(0);
          expect(unit.position.z).toBeGreaterThanOrEqual(0);
          expect(unit.position.x + unit.size.length).toBeLessThanOrEqual(request.vehicle.length + 1e-9);
          expect(unit.position.y + unit.size.width).toBeLessThanOrEqual(request.vehicle.width + 1e-9);
          expect(unit.position.z + unit.size.height).toBeLessThanOrEqual(request.vehicle.height + 1e-9);
        }

        for (let i = 0; i < result.placements.length; i++) {
          for (let j = i + 1; j < result.placements.length; j++) {
            expect(overlaps(result.placements[i], result.placements[j])).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe("runFitCheck property: weight cap", () => {
  it("never reports fits:true when total weight exceeds the vehicle's maximum payload", () => {
    fc.assert(
      fc.property(requestArb, (request) => {
        const totalWeight = request.items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
        const result = runFitCheck(request);
        if (totalWeight > request.vehicle.maxPayload + EPSILON) {
          expect(result.fits).toBe(false);
        }
      }),
      { numRuns: 250 },
    );
  });
});

describe("runFitCheck property: weight-based stacking", () => {
  it("never places a unit directly above another unit that is lighter than it", () => {
    fc.assert(
      fc.property(requestArb, (request) => {
        const result = runFitCheck(request);
        if (!result.fits) return;

        const weightById = new Map<string, number>(request.items.map((item: GoodsItemInput) => [item.id, item.weight]));

        for (const above of result.placements) {
          for (const below of result.placements) {
            if (above === below) continue;
            if (!isDirectlyBelow(below, above)) continue;

            const belowWeight = weightById.get(below.itemId) ?? 0;
            const aboveWeight = weightById.get(above.itemId) ?? 0;
            expect(belowWeight + EPSILON).toBeGreaterThanOrEqual(aboveWeight);
          }
        }
      }),
      { numRuns: 250 },
    );
  });
});

describe("runFitCheck property: combined correctness invariant (rotation + stacking + weight)", () => {
  it("never reports fits:true unless every placement is in-bounds, non-overlapping, a valid rotation of its item, weight-stacking-compliant, and within the payload cap", () => {
    fc.assert(
      fc.property(requestArb, (request) => {
        const result = runFitCheck(request);
        if (!result.fits) return;

        const itemById = new Map<string, GoodsItemInput>(request.items.map((item) => [item.id, item]));
        const totalWeight = request.items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
        expect(totalWeight).toBeLessThanOrEqual(request.vehicle.maxPayload + EPSILON);

        for (const unit of result.placements) {
          expect(unit.position.x).toBeGreaterThanOrEqual(0);
          expect(unit.position.y).toBeGreaterThanOrEqual(0);
          expect(unit.position.z).toBeGreaterThanOrEqual(0);
          expect(unit.position.x + unit.size.length).toBeLessThanOrEqual(request.vehicle.length + EPSILON);
          expect(unit.position.y + unit.size.width).toBeLessThanOrEqual(request.vehicle.width + EPSILON);
          expect(unit.position.z + unit.size.height).toBeLessThanOrEqual(request.vehicle.height + EPSILON);

          const item = itemById.get(unit.itemId);
          if (!item) throw new Error(`placement references unknown item "${unit.itemId}"`);

          const eligibleOrientations = getEligibleOrientations(
            { length: item.length, width: item.width, height: item.height },
            item.rotatable,
          );
          const isValidOrientation = eligibleOrientations.some(
            (orientation) =>
              orientation.length === unit.size.length &&
              orientation.width === unit.size.width &&
              orientation.height === unit.size.height,
          );
          expect(isValidOrientation).toBe(true);
        }

        for (let i = 0; i < result.placements.length; i++) {
          for (let j = i + 1; j < result.placements.length; j++) {
            expect(overlaps(result.placements[i], result.placements[j])).toBe(false);
          }
        }

        for (const above of result.placements) {
          for (const below of result.placements) {
            if (above === below) continue;
            if (!isDirectlyBelow(below, above)) continue;

            const belowWeight = itemById.get(below.itemId)?.weight ?? 0;
            const aboveWeight = itemById.get(above.itemId)?.weight ?? 0;
            expect(belowWeight + EPSILON).toBeGreaterThanOrEqual(aboveWeight);
          }
        }
      }),
      { numRuns: 250 },
    );
  });
});

describe("runFitCheck property: EPSILON weight-tie boundary", () => {
  it("stacks the upper unit iff its weight is within the production EPSILON of the lower unit's weight", () => {
    // support.ts's own tie-break uses a production EPSILON of 1e-9 — three orders of magnitude
    // tighter than this file's EPSILON (1e-6, used above for floating-point position tolerance).
    // This property must probe that exact production boundary, not the looser local one.
    const PROD_EPSILON = 1e-9;

    const lowerWeightArb = fc.integer({ min: 1, max: 50 });
    const deltaArb = fc.oneof(
      fc.constant(-PROD_EPSILON * 2),
      fc.constant(-PROD_EPSILON),
      fc.constant(0),
      fc.constant(PROD_EPSILON),
      fc.constant(PROD_EPSILON * 2),
      fc.double({ min: -1e-3, max: 1e-3, noNaN: true }),
    );

    fc.assert(
      fc.property(lowerWeightArb, deltaArb, (lowerWeight, delta) => {
        const upperWeight = lowerWeight + delta;
        // Vehicle footprint exactly matches both items' footprint, and height fits exactly two
        // layers: the only geometrically valid spot for the second unit is directly on top of the
        // first, isolating the weight-stacking gate as the sole variable under test.
        const request: FitCheckRequest = {
          vehicle: { length: 50, width: 50, height: 20, maxPayload: 1_000_000 },
          items: [
            {
              id: "lower",
              length: 50,
              width: 50,
              height: 10,
              weight: lowerWeight,
              quantity: 1,
              rotatable: false,
              stackable: true,
            },
            {
              id: "upper",
              length: 50,
              width: 50,
              height: 10,
              weight: upperWeight,
              quantity: 1,
              rotatable: false,
              stackable: false,
            },
          ],
          preserveOrder: true,
        };

        const result = runFitCheck(request);
        const shouldStack = upperWeight <= lowerWeight + PROD_EPSILON;
        expect(result.fits).toBe(shouldStack);
      }),
      { numRuns: 250 },
    );
  });
});
