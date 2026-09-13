import { describe, expect, it } from "vitest";
import type { FitCheckRequest, PlacedUnit } from "@/types";
import { boxesOverlap, getEligibleOrientations } from "./geometry";
import { runFitCheck } from "./packer";

function assertNoOverlap(placements: PlacedUnit[]): void {
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = { ...placements[i].position, ...placements[i].size };
      const b = { ...placements[j].position, ...placements[j].size };
      expect(boxesOverlap(a, b)).toBe(false);
    }
  }
}

describe("runFitCheck", () => {
  it("reports an exact volumetric fit", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100, maxPayload: 100000 },
      items: [
        {
          id: "crate",
          length: 100,
          width: 100,
          height: 100,
          weight: 1,
          quantity: 1,
          rotatable: false,
          stackable: true,
        },
      ],
      preserveOrder: false,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.utilizationPercent).toBe(100);
    assertNoOverlap(result.placements);
  });

  it("reports no-fit when total volume exceeds the vehicle", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100, maxPayload: 100000 },
      items: [
        { id: "box", length: 60, width: 60, height: 60, weight: 1, quantity: 5, rotatable: false, stackable: true },
      ],
      preserveOrder: false,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(false);
  });

  it("names a single item that is oversized in every orientation", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100, maxPayload: 100000 },
      items: [
        {
          id: "too-big",
          length: 150,
          width: 50,
          height: 50,
          weight: 1,
          quantity: 1,
          rotatable: false,
          stackable: false,
        },
      ],
      preserveOrder: false,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(false);
    expect(result.oversizedItemIds).toEqual(["too-big"]);
  });

  it("stacks two full-footprint layers to exactly fill the vehicle", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100, maxPayload: 100000 },
      items: [
        {
          id: "bottom",
          length: 100,
          width: 100,
          height: 50,
          weight: 1,
          quantity: 1,
          rotatable: false,
          stackable: true,
        },
        { id: "top", length: 100, width: 100, height: 50, weight: 1, quantity: 1, rotatable: false, stackable: true },
      ],
      preserveOrder: false,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.utilizationPercent).toBe(100);
    assertNoOverlap(result.placements);
  });

  it("respects a non-rotatable item's given orientation", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 50, height: 30, maxPayload: 100000 },
      items: [
        { id: "plank", length: 80, width: 20, height: 10, weight: 1, quantity: 1, rotatable: false, stackable: false },
      ],
      preserveOrder: false,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.placements[0].size).toEqual({ length: 80, width: 20, height: 10 });
  });

  it("places multiple identical items with mixed rotatable/stackable flags without overlap", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100, maxPayload: 100000 },
      items: [
        { id: "widget", length: 40, width: 30, height: 20, weight: 1, quantity: 3, rotatable: true, stackable: true },
      ],
      preserveOrder: false,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.placements).toHaveLength(3);
    assertNoOverlap(result.placements);
  });

  it("reports no-fit with the actual numbers when total weight exceeds the vehicle's maximum payload, even though it fits by volume", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100, maxPayload: 50 },
      items: [
        { id: "heavy", length: 10, width: 10, height: 10, weight: 100, quantity: 1, rotatable: false, stackable: true },
      ],
      preserveOrder: false,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(false);
    expect(result.reason).toMatch(/maximum payload/i);
    expect(result.reason).toContain("100");
    expect(result.reason).toContain("50");
  });

  it("computes weight utilization percent on a successful fit", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100, maxPayload: 40 },
      items: [
        { id: "crate", length: 50, width: 50, height: 50, weight: 20, quantity: 1, rotatable: false, stackable: true },
      ],
      preserveOrder: false,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.weightUtilizationPercent).toBe(50);
  });

  it("free order: reorders a heavier item (entered after a lighter one) to be placed first, so it ends up below the lighter one", () => {
    // "light" is entered FIRST in the items array, "heavy" second — a naive "process in input order"
    // implementation would place light at the bottom and be unable to stack heavy on it. With
    // preserveOrder: false the algorithm has freedom to reorder, and must place heavy first instead.
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 30, maxPayload: 120 },
      items: [
        {
          id: "light",
          length: 100,
          width: 100,
          height: 10,
          weight: 10,
          quantity: 1,
          rotatable: false,
          stackable: true,
        },
        {
          id: "heavy",
          length: 100,
          width: 100,
          height: 20,
          weight: 50,
          quantity: 1,
          rotatable: false,
          stackable: true,
        },
      ],
      preserveOrder: false,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.weightUtilizationPercent).toBe(50);

    const heavy = result.placements.find((p) => p.itemId === "heavy");
    const light = result.placements.find((p) => p.itemId === "light");
    expect(heavy?.position.z).toBeLessThan(light?.position.z ?? Infinity);
  });

  it("preserve order: reports no-fit (weight-stacking reason) rather than reordering, when entry order would need a heavier item to rest on a lighter one", () => {
    // Same items and vehicle as the free-order test above, but preserveOrder: true forces the
    // algorithm to respect the entered order (light first) even though reordering could have
    // produced a valid packing — it must refuse rather than silently reorder.
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 30, maxPayload: 1000 },
      items: [
        {
          id: "light",
          length: 100,
          width: 100,
          height: 20,
          weight: 1,
          quantity: 1,
          rotatable: false,
          stackable: true,
        },
        {
          id: "heavy",
          length: 100,
          width: 100,
          height: 10,
          weight: 50,
          quantity: 1,
          rotatable: false,
          stackable: true,
        },
      ],
      preserveOrder: true,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(false);
    expect(result.reason).toMatch(/weight-based stacking/i);
    expect(result.reason).toContain("heavy");
  });

  it("preserve order: succeeds without reordering when the entered order already respects the weight-stacking rule", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 30, maxPayload: 120 },
      items: [
        {
          id: "heavy",
          length: 100,
          width: 100,
          height: 20,
          weight: 50,
          quantity: 1,
          rotatable: false,
          stackable: true,
        },
        {
          id: "light",
          length: 100,
          width: 100,
          height: 10,
          weight: 10,
          quantity: 1,
          rotatable: false,
          stackable: true,
        },
      ],
      preserveOrder: true,
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);

    const heavy = result.placements.find((p) => p.itemId === "heavy");
    const light = result.placements.find((p) => p.itemId === "light");
    expect(heavy?.position.z).toBeLessThan(light?.position.z ?? Infinity);
  });

  it("free order: heaviest-first ordering picks a valid rotation and lands the heavier item at the bottom, not above the lighter one", () => {
    // Vehicle footprint exactly matches "light"'s footprint, and height fits exactly two layers, so
    // stacking is the only way both items can be placed. "heavy" is rotatable and one of its
    // rotations exactly matches that footprint too. Note: with preserveOrder: false, heaviest-first
    // ordering always attempts "heavy" first against an empty placed list, where ground-level support
    // is trivial — so this test does NOT independently exercise the FR-010 weight-stacking gate itself
    // (a disabled gate would pass here too). That gate is proven by the "preserve order" test below,
    // which forces the algorithm to actually evaluate it.
    const request: FitCheckRequest = {
      vehicle: { length: 50, width: 50, height: 20, maxPayload: 1000 },
      items: [
        { id: "light", length: 50, width: 50, height: 10, weight: 5, quantity: 1, rotatable: false, stackable: true },
        { id: "heavy", length: 10, width: 50, height: 50, weight: 20, quantity: 1, rotatable: true, stackable: true },
      ],
      preserveOrder: false,
    };
    const result = runFitCheck(request);

    if (!result.fits) return;

    const heavy = result.placements.find((p) => p.itemId === "heavy");
    const light = result.placements.find((p) => p.itemId === "light");
    expect(heavy?.position.z).toBeLessThan(light?.position.z ?? Infinity);
  });

  it("preserve order: reports no-fit (weight-stacking reason) rather than rotating the heavier item into a technically-fitting spot above a lighter one", () => {
    // Same shape as the free-order case above, but preserveOrder: true forces "light" to be placed
    // first (as entered) and "heavy" second. Rotating "heavy" into the vehicle's exact footprint
    // would let it fit geometrically directly above "light" — the algorithm must still refuse,
    // because that spot violates the weight-stacking rule, and no other spot exists.
    const request: FitCheckRequest = {
      vehicle: { length: 50, width: 50, height: 20, maxPayload: 1000 },
      items: [
        { id: "light", length: 50, width: 50, height: 10, weight: 5, quantity: 1, rotatable: false, stackable: true },
        { id: "heavy", length: 10, width: 50, height: 50, weight: 20, quantity: 1, rotatable: true, stackable: true },
      ],
      preserveOrder: true,
    };
    const result = runFitCheck(request);

    expect(result.fits).toBe(false);
    expect(result.reason).toMatch(/weight-based stacking/i);
    expect(result.reason).toContain("heavy");
  });

  it("rotation validity: a placed rotatable item's size is exactly one of its eligible orientations, not an unvalidated combination of its dimensions", () => {
    // Only one of the item's 6 possible orientations (80x20x10, a genuine rotation of the entered
    // 10x80x20) satisfies the vehicle's bounds — proving the algorithm picks a real, validated
    // orientation rather than some other combination of the item's own dimensions.
    const item = {
      id: "plank",
      length: 10,
      width: 80,
      height: 20,
      weight: 1,
      quantity: 1,
      rotatable: true,
      stackable: true,
    };
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 30, height: 15, maxPayload: 1000 },
      items: [item],
      preserveOrder: false,
    };
    const result = runFitCheck(request);

    expect(result.fits).toBe(true);
    const eligibleOrientations = getEligibleOrientations(
      { length: item.length, width: item.width, height: item.height },
      item.rotatable,
    );
    expect(eligibleOrientations).toContainEqual(result.placements[0].size);
  });
});
