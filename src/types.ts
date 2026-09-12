export interface GoodsItemInput {
  id: string;
  length: number;
  width: number;
  height: number;
  weight: number;
  quantity: number;
  rotatable: boolean;
  stackable: boolean;
}

export interface VehicleDimensionsInput {
  length: number;
  width: number;
  height: number;
  maxPayload: number;
}

export interface FitCheckRequest {
  items: GoodsItemInput[];
  vehicle: VehicleDimensionsInput;
  preserveOrder: boolean;
}

export interface PlacedUnit {
  itemId: string;
  unitIndex: number;
  position: { x: number; y: number; z: number };
  size: { length: number; width: number; height: number };
}

export interface LayerFootprint {
  unitId: string;
  itemId: string;
  x: number;
  y: number;
  length: number;
  width: number;
}

export interface LayerGrid {
  z: number;
  footprints: LayerFootprint[];
}

export interface FitCheckResult {
  fits: boolean;
  reason?: string;
  oversizedItemIds?: string[];
  packingOrder: string[];
  placements: PlacedUnit[];
  layers: LayerGrid[];
  utilizationPercent: number;
  weightUtilizationPercent: number;
}

export interface VehicleProfile {
  id: string;
  label: string;
  length: number;
  width: number;
  height: number;
  maxPayload: number | null;
}

export interface GoodsItemTemplate {
  id: string;
  label: string;
  length: number;
  width: number;
  height: number;
  weight: number | null;
  rotatable: boolean;
  stackable: boolean;
}
