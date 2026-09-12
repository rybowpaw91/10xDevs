import type {
  FitCheckRequest,
  FitCheckResult,
  GoodsItemInput,
  LayerGrid,
  PlacedUnit,
  VehicleDimensionsInput,
} from "@/types";
import { boxesOverlap, getEligibleOrientations, type Dimensions, type PlacedBox } from "./geometry";
import { isFullySupported } from "./support";

const EPSILON = 1e-9;

interface ExpandedUnit {
  itemId: string;
  unitIndex: number;
  dims: Dimensions;
  rotatable: boolean;
  stackable: boolean;
  weight: number;
  volume: number;
}

interface PlacedUnitInternal extends PlacedBox {
  itemId: string;
  unitIndex: number;
  stackable: boolean;
  weight: number;
}

interface ExtremePoint {
  x: number;
  y: number;
  z: number;
}

function unitId(itemId: string, unitIndex: number): string {
  return `${itemId}#${unitIndex}`;
}

function fitsWithinVehicle(orientation: Dimensions, ep: ExtremePoint, vehicle: VehicleDimensionsInput): boolean {
  return (
    ep.x + orientation.length <= vehicle.length + EPSILON &&
    ep.y + orientation.width <= vehicle.width + EPSILON &&
    ep.z + orientation.height <= vehicle.height + EPSILON
  );
}

function findOversizedItemIds(items: GoodsItemInput[], vehicle: VehicleDimensionsInput): string[] {
  const oversized: string[] = [];
  for (const item of items) {
    const orientations = getEligibleOrientations(item, item.rotatable);
    const hasFit = orientations.some(
      (orientation) =>
        orientation.length <= vehicle.length + EPSILON &&
        orientation.width <= vehicle.width + EPSILON &&
        orientation.height <= vehicle.height + EPSILON,
    );
    if (!hasFit) oversized.push(item.id);
  }
  return oversized;
}

function expandUnits(items: GoodsItemInput[]): ExpandedUnit[] {
  const units: ExpandedUnit[] = [];
  for (const item of items) {
    const volume = item.length * item.width * item.height;
    for (let unitIndex = 0; unitIndex < item.quantity; unitIndex++) {
      units.push({
        itemId: item.id,
        unitIndex,
        dims: { length: item.length, width: item.width, height: item.height },
        rotatable: item.rotatable,
        stackable: item.stackable,
        weight: item.weight,
        volume,
      });
    }
  }
  return units.sort((a, b) => b.volume - a.volume);
}

function compareExtremePoints(a: ExtremePoint, b: ExtremePoint): number {
  if (a.z !== b.z) return a.z - b.z;
  if (a.y !== b.y) return a.y - b.y;
  return a.x - b.x;
}

function addExtremePoint(points: ExtremePoint[], point: ExtremePoint): void {
  const exists = points.some(
    (p) => Math.abs(p.x - point.x) < EPSILON && Math.abs(p.y - point.y) < EPSILON && Math.abs(p.z - point.z) < EPSILON,
  );
  if (!exists) points.push(point);
}

function toPlacedUnit(unit: PlacedUnitInternal): PlacedUnit {
  return {
    itemId: unit.itemId,
    unitIndex: unit.unitIndex,
    position: { x: unit.x, y: unit.y, z: unit.z },
    size: { length: unit.length, width: unit.width, height: unit.height },
  };
}

function buildLayers(placed: PlacedUnitInternal[]): LayerGrid[] {
  const byZ = new Map<number, PlacedUnitInternal[]>();
  for (const unit of placed) {
    const bucket = byZ.get(unit.z) ?? [];
    bucket.push(unit);
    byZ.set(unit.z, bucket);
  }

  return Array.from(byZ.entries())
    .sort(([a], [b]) => a - b)
    .map(([z, units]) => ({
      z,
      footprints: units.map((unit) => ({
        unitId: unitId(unit.itemId, unit.unitIndex),
        itemId: unit.itemId,
        x: unit.x,
        y: unit.y,
        length: unit.length,
        width: unit.width,
      })),
    }));
}

function emptyNoFitResult(reason: string, oversizedItemIds?: string[]): FitCheckResult {
  return {
    fits: false,
    reason,
    oversizedItemIds,
    packingOrder: [],
    placements: [],
    layers: [],
    utilizationPercent: 0,
    weightUtilizationPercent: 0,
  };
}

function tryPlace(
  unit: ExpandedUnit,
  orientations: Dimensions[],
  candidates: ExtremePoint[],
  placed: PlacedUnitInternal[],
  vehicle: VehicleDimensionsInput,
  supportWeight: number,
): PlacedUnitInternal | null {
  for (const ep of candidates) {
    for (const orientation of orientations) {
      if (!fitsWithinVehicle(orientation, ep, vehicle)) continue;

      const candidateBox: PlacedBox = { x: ep.x, y: ep.y, z: ep.z, ...orientation };
      const overlapsExisting = placed.some((existing) => boxesOverlap(candidateBox, existing));
      if (overlapsExisting) continue;

      const supported = isFullySupported(
        {
          x: ep.x,
          y: ep.y,
          z: ep.z,
          length: orientation.length,
          width: orientation.width,
          weight: supportWeight,
        },
        placed,
      );
      if (!supported) continue;

      return {
        itemId: unit.itemId,
        unitIndex: unit.unitIndex,
        stackable: unit.stackable,
        weight: unit.weight,
        ...candidateBox,
      };
    }
  }
  return null;
}

export function runFitCheck(request: FitCheckRequest): FitCheckResult {
  const { items, vehicle } = request;

  if (items.length === 0) {
    return {
      fits: true,
      packingOrder: [],
      placements: [],
      layers: [],
      utilizationPercent: 0,
      weightUtilizationPercent: 0,
    };
  }

  const totalWeight = items.reduce((sum, item) => sum + item.weight * item.quantity, 0);
  if (totalWeight > vehicle.maxPayload + EPSILON) {
    return emptyNoFitResult("Total goods weight exceeds the vehicle's maximum payload.");
  }

  const oversizedItemIds = findOversizedItemIds(items, vehicle);
  if (oversizedItemIds.length > 0) {
    return emptyNoFitResult(
      "One or more items exceed the vehicle's cargo dimensions in every orientation.",
      oversizedItemIds,
    );
  }

  const units = expandUnits(items);
  const placed: PlacedUnitInternal[] = [];
  const extremePoints: ExtremePoint[] = [{ x: 0, y: 0, z: 0 }];
  const packingOrder: string[] = [];

  for (const unit of units) {
    const orientations = getEligibleOrientations(unit.dims, unit.rotatable);
    const candidates = [...extremePoints].sort(compareExtremePoints);

    const placedUnit = tryPlace(unit, orientations, candidates, placed, vehicle, unit.weight);

    if (!placedUnit) {
      const wouldFitIgnoringWeight =
        tryPlace(unit, orientations, candidates, placed, vehicle, Number.NEGATIVE_INFINITY) !== null;
      return emptyNoFitResult(
        wouldFitIgnoringWeight
          ? "The packing order couldn't satisfy the weight-based stacking rule: a heavier item would need to rest on a lighter one."
          : "The goods list doesn't fit within the vehicle's cargo volume in a single trip.",
      );
    }

    placed.push(placedUnit);
    packingOrder.push(
      `Place unit ${placedUnit.unitIndex + 1} of item "${placedUnit.itemId}" at (${placedUnit.x}, ${placedUnit.y}, ${placedUnit.z}) sized ${placedUnit.length}x${placedUnit.width}x${placedUnit.height}`,
    );

    addExtremePoint(extremePoints, { x: placedUnit.x + placedUnit.length, y: placedUnit.y, z: placedUnit.z });
    addExtremePoint(extremePoints, { x: placedUnit.x, y: placedUnit.y + placedUnit.width, z: placedUnit.z });
    addExtremePoint(extremePoints, { x: placedUnit.x, y: placedUnit.y, z: placedUnit.z + placedUnit.height });
  }

  const vehicleVolume = vehicle.length * vehicle.width * vehicle.height;
  const usedVolume = placed.reduce((sum, unit) => sum + unit.length * unit.width * unit.height, 0);
  const utilizationPercent = vehicleVolume > 0 ? Math.round((usedVolume / vehicleVolume) * 10000) / 100 : 0;
  const weightUtilizationPercent =
    vehicle.maxPayload > 0 ? Math.round((totalWeight / vehicle.maxPayload) * 10000) / 100 : 0;

  return {
    fits: true,
    packingOrder,
    placements: placed.map(toPlacedUnit),
    layers: buildLayers(placed),
    utilizationPercent,
    weightUtilizationPercent,
  };
}
