export interface VehiclePreset {
  id: string;
  label: string;
  length: number;
  width: number;
  height: number;
  maxPayload: number;
}

export const VEHICLE_PRESETS: VehiclePreset[] = [
  { id: "small-van", label: "Small panel van", length: 250, width: 160, height: 135, maxPayload: 800 },
  {
    id: "lwb-high-roof-van",
    label: "Long-wheelbase high-roof van",
    length: 420,
    width: 180,
    height: 210,
    maxPayload: 1200,
  },
  { id: "box-truck-3-5t", label: "3.5t box truck", length: 420, width: 210, height: 220, maxPayload: 1300 },
  { id: "truck-7-5t", label: "7.5t truck", length: 620, width: 245, height: 240, maxPayload: 3500 },
];
