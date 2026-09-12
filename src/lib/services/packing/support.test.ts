import { describe, expect, it } from "vitest";
import { isFullySupported } from "./support";

describe("isFullySupported", () => {
  it("allows placement on the ground regardless of placed units", () => {
    expect(isFullySupported({ x: 10, y: 10, z: 0, length: 20, width: 20, weight: 5 }, [])).toBe(true);
  });

  it("supports a candidate fully covered by a single stackable unit below", () => {
    const placed = [{ x: 0, y: 0, z: 0, length: 50, width: 50, height: 20, stackable: true, weight: 10 }];
    expect(isFullySupported({ x: 10, y: 10, z: 20, length: 20, width: 20, weight: 5 }, placed)).toBe(true);
  });

  it("supports a candidate covered by multiple co-planar stackable units summing to full coverage", () => {
    const placed = [
      { x: 0, y: 0, z: 0, length: 20, width: 40, height: 10, stackable: true, weight: 10 },
      { x: 20, y: 0, z: 0, length: 20, width: 40, height: 10, stackable: true, weight: 10 },
    ];
    expect(isFullySupported({ x: 0, y: 0, z: 10, length: 40, width: 40, weight: 5 }, placed)).toBe(true);
  });

  it("rejects a candidate with only partial support", () => {
    const placed = [{ x: 0, y: 0, z: 0, length: 30, width: 30, height: 10, stackable: true, weight: 10 }];
    expect(isFullySupported({ x: 0, y: 0, z: 10, length: 40, width: 40, weight: 5 }, placed)).toBe(false);
  });

  it("ignores non-stackable units even if geometrically aligned", () => {
    const placed = [{ x: 0, y: 0, z: 0, length: 50, width: 50, height: 20, stackable: false, weight: 10 }];
    expect(isFullySupported({ x: 10, y: 10, z: 20, length: 20, width: 20, weight: 5 }, placed)).toBe(false);
  });

  it("supports a candidate resting on a unit of exactly equal weight", () => {
    const placed = [{ x: 0, y: 0, z: 0, length: 50, width: 50, height: 20, stackable: true, weight: 10 }];
    expect(isFullySupported({ x: 10, y: 10, z: 20, length: 20, width: 20, weight: 10 }, placed)).toBe(true);
  });

  it("rejects a candidate heavier than the stackable unit below it, even if geometrically aligned", () => {
    const placed = [{ x: 0, y: 0, z: 0, length: 50, width: 50, height: 20, stackable: true, weight: 5 }];
    expect(isFullySupported({ x: 10, y: 10, z: 20, length: 20, width: 20, weight: 10 }, placed)).toBe(false);
  });
});
