import { useRef, useState } from "react";
import { Plus, Trash2, PackageCheck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VEHICLE_PRESETS } from "@/lib/constants/vehicle-presets";
import { fitCheckRequestSchema } from "@/lib/validation/fit-check-schema";
import type { FitCheckRequest, FitCheckResult, VehicleDimensionsInput } from "@/types";
import { FitCheckResultView } from "./FitCheckResult";

interface GoodsRowState {
  key: string;
  label: string;
  length: string;
  width: string;
  height: string;
  quantity: string;
  rotatable: boolean;
  stackable: boolean;
}

interface VehicleState {
  presetId: string;
  length: string;
  width: string;
  height: string;
}

interface ErrorTree {
  errors: string[];
  properties?: Record<string, ErrorTree>;
  items?: ErrorTree[];
}

function createRow(id: number): GoodsRowState {
  return {
    key: `row-${id}`,
    label: `Item ${id + 1}`,
    length: "",
    width: "",
    height: "",
    quantity: "1",
    rotatable: true,
    stackable: true,
  };
}

function collectZodErrors(tree: ErrorTree | undefined): string[] {
  if (!tree) return [];
  const messages = [...tree.errors];
  if (tree.properties) {
    for (const value of Object.values(tree.properties)) messages.push(...collectZodErrors(value));
  }
  if (tree.items) {
    for (const value of tree.items) messages.push(...collectZodErrors(value));
  }
  return messages;
}

function buildRequest(rows: GoodsRowState[], vehicle: VehicleState): FitCheckRequest {
  const usedLabels = new Set<string>();
  const items = rows.map((row) => {
    const baseLabel = row.label.trim() || "Item";
    let uniqueLabel = baseLabel;
    let suffix = 2;
    while (usedLabels.has(uniqueLabel)) {
      uniqueLabel = `${baseLabel} (${suffix})`;
      suffix += 1;
    }
    usedLabels.add(uniqueLabel);

    return {
      id: uniqueLabel,
      length: Number(row.length),
      width: Number(row.width),
      height: Number(row.height),
      quantity: Number(row.quantity),
      rotatable: row.rotatable,
      stackable: row.stackable,
    };
  });

  return {
    items,
    vehicle: {
      length: Number(vehicle.length),
      width: Number(vehicle.width),
      height: Number(vehicle.height),
    },
  };
}

export default function GoodsFitForm() {
  const nextRowId = useRef(1);
  const [rows, setRows] = useState<GoodsRowState[]>(() => [createRow(0)]);
  const [vehicle, setVehicle] = useState<VehicleState>({ presetId: "custom", length: "", width: "", height: "" });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FitCheckResult | null>(null);
  const [resultVehicle, setResultVehicle] = useState<VehicleDimensionsInput | null>(null);

  function addRow() {
    const id = nextRowId.current;
    nextRowId.current += 1;
    setRows((prev) => [...prev, createRow(id)]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.key !== key) : prev));
  }

  function updateRow(key: string, patch: Partial<GoodsRowState>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function handlePresetChange(presetId: string) {
    const preset = VEHICLE_PRESETS.find((candidate) => candidate.id === presetId);
    setVehicle((prev) => ({
      presetId,
      length: preset ? String(preset.length) : prev.length,
      width: preset ? String(preset.width) : prev.width,
      height: preset ? String(preset.height) : prev.height,
    }));
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);
    setResult(null);

    const request = buildRequest(rows, vehicle);
    const parsed = fitCheckRequestSchema.safeParse(request);
    if (!parsed.success) {
      setValidationErrors(collectZodErrors(z.treeifyError(parsed.error)));
      return;
    }
    setValidationErrors([]);
    setSubmitting(true);

    try {
      const response = await fetch("/api/fit-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        const errorBody = (await response.json()) as { error?: string; issues?: ErrorTree };
        const issueMessages = collectZodErrors(errorBody.issues);
        setApiError(issueMessages.length > 0 ? issueMessages.join(" ") : (errorBody.error ?? "Request failed."));
        return;
      }

      const data = (await response.json()) as FitCheckResult;
      setResult(data);
      setResultVehicle(parsed.data.vehicle);
    } catch {
      setApiError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-8" noValidate>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">Vehicle cargo dimensions</h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-4">
              <Label className="mb-1 text-blue-100/80">Preset (optional)</Label>
              <Select value={vehicle.presetId} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-full bg-white/10 text-white">
                  <SelectValue placeholder="Choose a preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom / manual entry</SelectItem>
                  {VEHICLE_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label} ({preset.length}x{preset.width}x{preset.height} cm)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 text-blue-100/80">Length (cm)</Label>
              <Input
                type="number"
                min="0"
                value={vehicle.length}
                onChange={(e) => {
                  setVehicle((prev) => ({ ...prev, length: e.target.value }));
                }}
                className="bg-white/10 text-white"
              />
            </div>
            <div>
              <Label className="mb-1 text-blue-100/80">Width (cm)</Label>
              <Input
                type="number"
                min="0"
                value={vehicle.width}
                onChange={(e) => {
                  setVehicle((prev) => ({ ...prev, width: e.target.value }));
                }}
                className="bg-white/10 text-white"
              />
            </div>
            <div>
              <Label className="mb-1 text-blue-100/80">Height (cm)</Label>
              <Input
                type="number"
                min="0"
                value={vehicle.height}
                onChange={(e) => {
                  setVehicle((prev) => ({ ...prev, height: e.target.value }));
                }}
                className="bg-white/10 text-white"
              />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Goods list</h2>
            <Button type="button" variant="outline" onClick={addRow}>
              <Plus className="size-4" />
              Add item
            </Button>
          </div>

          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.key} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="grid gap-3 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <Label className="mb-1 text-blue-100/80">Label</Label>
                    <Input
                      value={row.label}
                      onChange={(e) => {
                        updateRow(row.key, { label: e.target.value });
                      }}
                      className="bg-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 text-blue-100/80">Length</Label>
                    <Input
                      type="number"
                      min="0"
                      value={row.length}
                      onChange={(e) => {
                        updateRow(row.key, { length: e.target.value });
                      }}
                      className="bg-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 text-blue-100/80">Width</Label>
                    <Input
                      type="number"
                      min="0"
                      value={row.width}
                      onChange={(e) => {
                        updateRow(row.key, { width: e.target.value });
                      }}
                      className="bg-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 text-blue-100/80">Height</Label>
                    <Input
                      type="number"
                      min="0"
                      value={row.height}
                      onChange={(e) => {
                        updateRow(row.key, { height: e.target.value });
                      }}
                      className="bg-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label className="mb-1 text-blue-100/80">Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => {
                        updateRow(row.key, { quantity: e.target.value });
                      }}
                      className="bg-white/10 text-white"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-blue-100/80">
                    <Checkbox
                      checked={row.rotatable}
                      onCheckedChange={(checked) => {
                        updateRow(row.key, { rotatable: checked === true });
                      }}
                    />
                    Can be rotated
                  </label>
                  <label className="flex items-center gap-2 text-sm text-blue-100/80">
                    <Checkbox
                      checked={row.stackable}
                      onCheckedChange={(checked) => {
                        updateRow(row.key, { stackable: checked === true });
                      }}
                    />
                    Other items can stack on it
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="ml-auto text-red-300 hover:text-red-200"
                    disabled={rows.length <= 1}
                    onClick={() => {
                      removeRow(row.key);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {validationErrors.length > 0 && (
          <ul className="list-inside list-disc rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">
            {validationErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {apiError && <p className="text-sm text-red-300">{apiError}</p>}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Checking fit...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <PackageCheck className="size-4" />
              Check fit
            </span>
          )}
        </Button>
      </form>

      {result && resultVehicle && <FitCheckResultView result={result} vehicle={resultVehicle} />}
    </div>
  );
}
