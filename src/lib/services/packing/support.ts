import type { PlacedBox } from "./geometry";

const EPSILON = 1e-9;

export interface SupportCandidate {
  x: number;
  y: number;
  z: number;
  length: number;
  width: number;
}

export interface SupportingUnit extends PlacedBox {
  stackable: boolean;
}

export function isFullySupported(candidate: SupportCandidate, placed: SupportingUnit[]): boolean {
  if (candidate.z <= EPSILON) return true;

  const candidateArea = candidate.length * candidate.width;
  if (candidateArea <= 0) return false;

  let covered = 0;
  for (const unit of placed) {
    if (!unit.stackable) continue;

    const topZ = unit.z + unit.height;
    if (Math.abs(topZ - candidate.z) > EPSILON) continue;

    const overlapX = Math.min(candidate.x + candidate.length, unit.x + unit.length) - Math.max(candidate.x, unit.x);
    const overlapY = Math.min(candidate.y + candidate.width, unit.y + unit.width) - Math.max(candidate.y, unit.y);
    if (overlapX > 0 && overlapY > 0) {
      covered += overlapX * overlapY;
    }
  }

  return covered >= candidateArea - EPSILON;
}
