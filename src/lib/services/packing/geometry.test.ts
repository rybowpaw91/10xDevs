import { describe, expect, it } from "vitest";
import { boxesOverlap, getEligibleOrientations } from "./geometry";

describe("getEligibleOrientations", () => {
  it("returns exactly the given orientation when not rotatable", () => {
    const orientations = getEligibleOrientations({ length: 10, width: 20, height: 30 }, false);
    expect(orientations).toEqual([{ length: 10, width: 20, height: 30 }]);
  });

  it("returns all 6 distinct orientations when rotatable with distinct dimensions", () => {
    const orientations = getEligibleOrientations({ length: 10, width: 20, height: 30 }, true);
    const keys = new Set(orientations.map((o) => `${o.length}x${o.width}x${o.height}`));
    expect(keys.size).toBe(6);
  });

  it("deduplicates orientations when two dimensions are equal", () => {
    const orientations = getEligibleOrientations({ length: 10, width: 10, height: 30 }, true);
    expect(orientations).toHaveLength(3);
  });

  it("deduplicates to a single orientation for a cube", () => {
    const orientations = getEligibleOrientations({ length: 10, width: 10, height: 10 }, true);
    expect(orientations).toHaveLength(1);
  });
});

describe("boxesOverlap", () => {
  it("detects overlapping boxes", () => {
    const a = { x: 0, y: 0, z: 0, length: 10, width: 10, height: 10 };
    const b = { x: 5, y: 5, z: 5, length: 10, width: 10, height: 10 };
    expect(boxesOverlap(a, b)).toBe(true);
  });

  it("treats face-touching boxes as non-overlapping", () => {
    const a = { x: 0, y: 0, z: 0, length: 10, width: 10, height: 10 };
    const b = { x: 10, y: 0, z: 0, length: 10, width: 10, height: 10 };
    expect(boxesOverlap(a, b)).toBe(false);
  });

  it("detects no overlap for disjoint boxes", () => {
    const a = { x: 0, y: 0, z: 0, length: 10, width: 10, height: 10 };
    const b = { x: 50, y: 50, z: 50, length: 10, width: 10, height: 10 };
    expect(boxesOverlap(a, b)).toBe(false);
  });
});
