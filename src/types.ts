export interface GoodsItemInput {
  id: string;
  length: number;
  width: number;
  height: number;
  quantity: number;
  rotatable: boolean;
  stackable: boolean;
}

export interface VehicleDimensionsInput {
  length: number;
  width: number;
  height: number;
}

export interface FitCheckRequest {
  items: GoodsItemInput[];
  vehicle: VehicleDimensionsInput;
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
  layers: LayerGrid[];
  utilizationPercent: number;
}
