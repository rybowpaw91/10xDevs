import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { FitCheckRequest, PlacedUnit } from "@/types";
import { boxesOverlap } from "./geometry";
import { runFitCheck } from "./packer";

const dimensionArb = fc.integer({ min: 5, max: 50 });

const goodsItemArb = fc.record({
  id: fc.constant(""),
  length: dimensionArb,
  width: dimensionArb,
  height: dimensionArb,
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
    }),
  })
  .map((request) => ({
    ...request,
    items: request.items.map((item, index) => ({ ...item, id: `item-${index}` })),
  }));

function overlaps(a: PlacedUnit, b: PlacedUnit): boolean {
  return boxesOverlap({ ...a.position, ...a.size }, { ...b.position, ...b.size });
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
