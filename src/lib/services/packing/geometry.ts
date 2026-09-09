export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export interface PlacedBox extends Dimensions {
  x: number;
  y: number;
  z: number;
}

export function getEligibleOrientations(dims: Dimensions, rotatable: boolean): Dimensions[] {
  if (!rotatable) {
    return [{ length: dims.length, width: dims.width, height: dims.height }];
  }

  const permutations: Dimensions[] = [
    { length: dims.length, width: dims.width, height: dims.height },
    { length: dims.length, width: dims.height, height: dims.width },
    { length: dims.width, width: dims.length, height: dims.height },
    { length: dims.width, width: dims.height, height: dims.length },
    { length: dims.height, width: dims.length, height: dims.width },
    { length: dims.height, width: dims.width, height: dims.length },
  ];

  const seen = new Set<string>();
  const orientations: Dimensions[] = [];
  for (const orientation of permutations) {
    const key = `${orientation.length}x${orientation.width}x${orientation.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    orientations.push(orientation);
  }
  return orientations;
}

export function boxesOverlap(a: PlacedBox, b: PlacedBox): boolean {
  return (
    a.x < b.x + b.length &&
    b.x < a.x + a.length &&
    a.y < b.y + b.width &&
    b.y < a.y + a.width &&
    a.z < b.z + b.height &&
    b.z < a.z + a.height
  );
}
