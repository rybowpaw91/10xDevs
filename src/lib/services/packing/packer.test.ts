import { describe, expect, it } from "vitest";
import type { FitCheckRequest, PlacedUnit } from "@/types";
import { boxesOverlap } from "./geometry";
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
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.placements).toHaveLength(3);
    assertNoOverlap(result.placements);
  });

  it("reports no-fit when total weight exceeds the vehicle's maximum payload, even though it fits by volume", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100, maxPayload: 50 },
      items: [
        { id: "heavy", length: 10, width: 10, height: 10, weight: 100, quantity: 1, rotatable: false, stackable: true },
      ],
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(false);
    expect(result.reason).toMatch(/maximum payload/i);
  });

  it("computes weight utilization percent on a successful fit", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100, maxPayload: 40 },
      items: [
        { id: "crate", length: 50, width: 50, height: 50, weight: 20, quantity: 1, rotatable: false, stackable: true },
      ],
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.weightUtilizationPercent).toBe(50);
  });

  it("places a heavier unit (processed first for having greater volume) below a lighter one stacked on it", () => {
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
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.weightUtilizationPercent).toBe(50);

    const heavy = result.placements.find((p) => p.itemId === "heavy");
    const light = result.placements.find((p) => p.itemId === "light");
    expect(heavy?.position.z).toBeLessThan(light?.position.z ?? Infinity);
  });

  it("reports no-fit (weight-stacking reason, not the generic volume reason) when the only geometric spot for a heavier unit is above a lighter one", () => {
    // "light" has the larger volume, so it's processed and placed first (occupying the vehicle's
    // entire footprint at ground level); "heavy" is smaller by volume but heavier, and the vehicle's
    // dimensions leave no room for it except directly on top of "light" — which the weight-based
    // stacking rule must refuse, even though the spot is otherwise geometrically valid.
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
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(false);
    expect(result.reason).toMatch(/weight-based stacking/i);
  });
});
