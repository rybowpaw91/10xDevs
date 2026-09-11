import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, PackageCheck, Save } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VEHICLE_PRESETS } from "@/lib/constants/vehicle-presets";
import { fitCheckRequestSchema } from "@/lib/validation/fit-check-schema";
import { goodsItemTemplateInputSchema } from "@/lib/validation/goods-item-template-schema";
import { vehicleProfileInputSchema } from "@/lib/validation/vehicle-profile-schema";
import type {
  FitCheckRequest,
  FitCheckResult,
  GoodsItemTemplate,
  VehicleDimensionsInput,
  VehicleProfile,
} from "@/types";
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

  const [savedProfiles, setSavedProfiles] = useState<VehicleProfile[]>([]);
  const [profileLabel, setProfileLabel] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [savedItemTemplates, setSavedItemTemplates] = useState<GoodsItemTemplate[]>([]);
  const [itemTemplateError, setItemTemplateError] = useState<string | null>(null);
  const [savingItemTemplateKey, setSavingItemTemplateKey] = useState<string | null>(null);
  const [templateSelectValue, setTemplateSelectValue] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      try {
        const response = await fetch("/api/vehicle-profiles");
        if (!response.ok) return;
        const data = (await response.json()) as VehicleProfile[];
        if (!cancelled) setSavedProfiles(data);
      } catch {
        // Saved profiles are a convenience, not required for the core flow — fail silently.
      }
    }

    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadItemTemplates() {
      try {
        const response = await fetch("/api/goods-item-templates");
        if (!response.ok) return;
        const data = (await response.json()) as GoodsItemTemplate[];
        if (!cancelled) setSavedItemTemplates(data);
      } catch {
        // Saved item templates are a convenience, not required for the core flow — fail silently.
      }
    }

    void loadItemTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

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
    const profile = savedProfiles.find((candidate) => candidate.id === presetId);
    const source = preset ?? profile;
    setVehicle((prev) => ({
      presetId,
      length: source ? String(source.length) : prev.length,
      width: source ? String(source.width) : prev.width,
      height: source ? String(source.height) : prev.height,
    }));
  }

  async function saveProfile() {
    setProfileError(null);

    const parsed = vehicleProfileInputSchema.safeParse({
      label: profileLabel.trim(),
      length: Number(vehicle.length),
      width: Number(vehicle.width),
      height: Number(vehicle.height),
    });
    if (!parsed.success) {
      setProfileError(collectZodErrors(z.treeifyError(parsed.error)).join(" "));
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch("/api/vehicle-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        setProfileError(`Could not save profile (status ${response.status}).`);
        return;
      }

      const created = (await response.json()) as VehicleProfile;
      setSavedProfiles((prev) => [created, ...prev]);
      setProfileLabel("");
    } catch {
      setProfileError("Could not reach the server. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function deleteProfile(id: string) {
    try {
      const response = await fetch(`/api/vehicle-profiles/${id}`, { method: "DELETE" });
      if (!response.ok) return;
      setSavedProfiles((prev) => prev.filter((profile) => profile.id !== id));
      if (vehicle.presetId === id) {
        setVehicle((prev) => ({ ...prev, presetId: "custom" }));
      }
    } catch {
      // Best-effort — leave the list as-is if the request fails.
    }
  }

  async function saveItemTemplate(row: GoodsRowState) {
    setItemTemplateError(null);

    const parsed = goodsItemTemplateInputSchema.safeParse({
      label: row.label.trim(),
      length: Number(row.length),
      width: Number(row.width),
      height: Number(row.height),
      rotatable: row.rotatable,
      stackable: row.stackable,
    });
    if (!parsed.success) {
      setItemTemplateError(collectZodErrors(z.treeifyError(parsed.error)).join(" "));
      return;
    }

    setSavingItemTemplateKey(row.key);
    try {
      const response = await fetch("/api/goods-item-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        setItemTemplateError(`Could not save item template (status ${response.status}).`);
        return;
      }

      const created = (await response.json()) as GoodsItemTemplate;
      setSavedItemTemplates((prev) => [created, ...prev]);
    } catch {
      setItemTemplateError("Could not reach the server. Please try again.");
    } finally {
      setSavingItemTemplateKey(null);
    }
  }

  function loadItemTemplate(template: GoodsItemTemplate) {
    const id = nextRowId.current;
    nextRowId.current += 1;
    setRows((prev) => [
      ...prev,
      {
        key: `row-${id}`,
        label: template.label,
        length: String(template.length),
        width: String(template.width),
        height: String(template.height),
        quantity: "1",
        rotatable: template.rotatable,
        stackable: template.stackable,
      },
    ]);
  }

  function handleTemplateSelect(templateId: string) {
    const template = savedItemTemplates.find((candidate) => candidate.id === templateId);
    if (template) {
      loadItemTemplate(template);
    }
    setTemplateSelectValue("");
  }

  async function deleteItemTemplate(id: string) {
    try {
      const response = await fetch(`/api/goods-item-templates/${id}`, { method: "DELETE" });
      if (!response.ok) return;
      setSavedItemTemplates((prev) => prev.filter((template) => template.id !== id));
    } catch {
      // Best-effort — leave the list as-is if the request fails.
    }
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
        try {
          const errorBody = (await response.json()) as { error?: string; issues?: ErrorTree };
          const issueMessages = collectZodErrors(errorBody.issues);
          setApiError(issueMessages.length > 0 ? issueMessages.join(" ") : (errorBody.error ?? "Request failed."));
        } catch {
          setApiError(`Request failed (status ${response.status}).`);
        }
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
                  {savedProfiles.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Saved profiles</SelectLabel>
                      {savedProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.label} ({profile.length}x{profile.width}x{profile.height} cm)
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>Presets</SelectLabel>
                    {VEHICLE_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label} ({preset.length}x{preset.width}x{preset.height} cm)
                      </SelectItem>
                    ))}
                  </SelectGroup>
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

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Label className="mb-1 text-blue-100/80">Save current as profile</Label>
              <Input
                value={profileLabel}
                onChange={(e) => {
                  setProfileLabel(e.target.value);
                }}
                placeholder="e.g. My delivery van"
                className="bg-white/10 text-white"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={savingProfile}
              onClick={() => {
                void saveProfile();
              }}
            >
              <Save className="size-4" />
              Save profile
            </Button>
          </div>
          {profileError && <p className="mt-2 text-sm text-red-300">{profileError}</p>}

          {savedProfiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {savedProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-blue-100/80"
                >
                  <span>
                    {profile.label} — {profile.length}x{profile.width}x{profile.height} cm
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-300 hover:text-red-200"
                    onClick={() => {
                      void deleteProfile(profile.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Goods list</h2>
            <div className="flex items-center gap-2">
              {savedItemTemplates.length > 0 && (
                <Select value={templateSelectValue} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="w-56 bg-white/10 text-white">
                    <SelectValue placeholder="Add from saved item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Saved items</SelectLabel>
                      {savedItemTemplates.map((template) => (
                        <SelectPrimitive.Item
                          key={template.id}
                          value={template.id}
                          className="focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center justify-between gap-2 rounded-sm py-1.5 pr-2 pl-2 text-sm outline-hidden select-none"
                        >
                          <SelectPrimitive.ItemText>
                            {template.label} ({template.length}x{template.width}x{template.height} cm)
                          </SelectPrimitive.ItemText>
                          <button
                            type="button"
                            aria-label={`Delete ${template.label}`}
                            className="text-red-300 hover:text-red-200"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteItemTemplate(template.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </SelectPrimitive.Item>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <Button type="button" variant="outline" onClick={addRow}>
                <Plus className="size-4" />
                Add item
              </Button>
            </div>
          </div>

          {itemTemplateError && <p className="mb-3 text-sm text-red-300">{itemTemplateError}</p>}

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
                    className="ml-auto"
                    title="Save as template"
                    disabled={savingItemTemplateKey === row.key}
                    onClick={() => {
                      void saveItemTemplate(row);
                    }}
                  >
                    <Save className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-300 hover:text-red-200"
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
