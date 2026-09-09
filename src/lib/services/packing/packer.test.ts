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
      vehicle: { length: 100, width: 100, height: 100 },
      items: [{ id: "crate", length: 100, width: 100, height: 100, quantity: 1, rotatable: false, stackable: true }],
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.utilizationPercent).toBe(100);
    assertNoOverlap(result.placements);
  });

  it("reports no-fit when total volume exceeds the vehicle", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100 },
      items: [{ id: "box", length: 60, width: 60, height: 60, quantity: 5, rotatable: false, stackable: true }],
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(false);
  });

  it("names a single item that is oversized in every orientation", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100 },
      items: [{ id: "too-big", length: 150, width: 50, height: 50, quantity: 1, rotatable: false, stackable: false }],
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(false);
    expect(result.oversizedItemIds).toEqual(["too-big"]);
  });

  it("stacks two full-footprint layers to exactly fill the vehicle", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100 },
      items: [
        { id: "bottom", length: 100, width: 100, height: 50, quantity: 1, rotatable: false, stackable: true },
        { id: "top", length: 100, width: 100, height: 50, quantity: 1, rotatable: false, stackable: true },
      ],
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.utilizationPercent).toBe(100);
    assertNoOverlap(result.placements);
  });

  it("respects a non-rotatable item's given orientation", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 50, height: 30 },
      items: [{ id: "plank", length: 80, width: 20, height: 10, quantity: 1, rotatable: false, stackable: false }],
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.placements[0].size).toEqual({ length: 80, width: 20, height: 10 });
  });

  it("places multiple identical items with mixed rotatable/stackable flags without overlap", () => {
    const request: FitCheckRequest = {
      vehicle: { length: 100, width: 100, height: 100 },
      items: [{ id: "widget", length: 40, width: 30, height: 20, quantity: 3, rotatable: true, stackable: true }],
    };
    const result = runFitCheck(request);
    expect(result.fits).toBe(true);
    expect(result.placements).toHaveLength(3);
    assertNoOverlap(result.placements);
  });
});
