import type { FitCheckResult, LayerGrid, VehicleDimensionsInput } from "@/types";

const GRID_PIXEL_WIDTH = 320;
const PALETTE = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb7185"];

function buildItemColorMap(layers: LayerGrid[]): Map<string, string> {
  const colors = new Map<string, string>();
  for (const layer of layers) {
    for (const footprint of layer.footprints) {
      if (!colors.has(footprint.itemId)) {
        colors.set(footprint.itemId, PALETTE[colors.size % PALETTE.length]);
      }
    }
  }
  return colors;
}

interface FitCheckResultViewProps {
  result: FitCheckResult;
  vehicle: VehicleDimensionsInput;
}

export function FitCheckResultView({ result, vehicle }: FitCheckResultViewProps) {
  if (!result.fits) {
    return (
      <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-red-100">
        <p className="font-semibold">Doesn&apos;t fit in a single trip</p>
        <p className="mt-1 text-sm text-red-100/80">{result.reason}</p>
        {result.oversizedItemIds && result.oversizedItemIds.length > 0 && (
          <ul className="mt-2 list-inside list-disc text-sm text-red-100/80">
            {result.oversizedItemIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const colorByItem = buildItemColorMap(result.layers);
  const scale = GRID_PIXEL_WIDTH / vehicle.length;
  const gridHeight = vehicle.width * scale;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 p-4 text-emerald-100">
        <p className="font-semibold">Fits in a single trip</p>
        <p className="mt-1 text-sm text-emerald-100/80">
          Volume utilization (volume-only): {result.utilizationPercent}%
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-blue-100/80">Packing order</h3>
        <ol className="list-inside list-decimal space-y-1 text-sm text-blue-100/70">
          {result.packingOrder.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-blue-100/80">Layers (top-down view)</h3>
        <div className="flex flex-wrap gap-4">
          {result.layers.map((layer) => (
            <div key={layer.z}>
              <p className="mb-1 text-xs text-blue-100/60">Height {layer.z}cm</p>
              <div
                className="relative rounded border border-white/20 bg-white/5"
                style={{ width: GRID_PIXEL_WIDTH, height: gridHeight }}
              >
                {layer.footprints.map((footprint) => (
                  <div
                    key={footprint.unitId}
                    title={`${footprint.itemId} (${footprint.length}x${footprint.width})`}
                    className="absolute flex items-center justify-center overflow-hidden rounded-sm border border-black/20 text-[10px] font-medium text-black/70"
                    style={{
                      left: footprint.x * scale,
                      top: footprint.y * scale,
                      width: footprint.length * scale,
                      height: footprint.width * scale,
                      backgroundColor: colorByItem.get(footprint.itemId),
                    }}
                  >
                    {footprint.itemId}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
