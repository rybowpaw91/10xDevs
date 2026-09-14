import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, PackageCheck, Save, Pencil } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  GoodsItemInput,
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
  weight: string;
  quantity: string;
  rotatable: boolean;
  stackable: boolean;
}

interface VehicleState {
  presetId: string;
  length: string;
  width: string;
  height: string;
  maxPayload: string;
}

interface ProfileEditDraft {
  label: string;
  length: string;
  width: string;
  height: string;
  maxPayload: string;
}

interface TemplateEditDraft {
  label: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  rotatable: boolean;
  stackable: boolean;
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
    weight: "",
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

function buildRequest(rows: GoodsRowState[], vehicle: VehicleState, preserveOrder: boolean): FitCheckRequest {
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
      weight: Number(row.weight),
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
      maxPayload: Number(vehicle.maxPayload),
    },
    preserveOrder,
  };
}

export default function GoodsFitForm() {
  const nextRowId = useRef(1);
  const [rows, setRows] = useState<GoodsRowState[]>(() => [createRow(0)]);
  const [vehicle, setVehicle] = useState<VehicleState>({
    presetId: "custom",
    length: "",
    width: "",
    height: "",
    maxPayload: "",
  });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FitCheckResult | null>(null);
  const [resultVehicle, setResultVehicle] = useState<VehicleDimensionsInput | null>(null);
  const [resultItems, setResultItems] = useState<GoodsItemInput[]>([]);
  const [preserveOrder, setPreserveOrder] = useState(false);

  const [savedProfiles, setSavedProfiles] = useState<VehicleProfile[]>([]);
  const [profileLabel, setProfileLabel] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileEditDraft, setProfileEditDraft] = useState<ProfileEditDraft | null>(null);
  const [profileEditError, setProfileEditError] = useState<string | null>(null);
  const [savingProfileEdit, setSavingProfileEdit] = useState(false);

  const [savedItemTemplates, setSavedItemTemplates] = useState<GoodsItemTemplate[]>([]);
  const [itemTemplateError, setItemTemplateError] = useState<string | null>(null);
  const [savingItemTemplateKey, setSavingItemTemplateKey] = useState<string | null>(null);
  const [templateSelectValue, setTemplateSelectValue] = useState("");

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateEditDraft, setTemplateEditDraft] = useState<TemplateEditDraft | null>(null);
  const [templateEditError, setTemplateEditError] = useState<string | null>(null);
  const [savingTemplateEdit, setSavingTemplateEdit] = useState(false);

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
    // A saved profile created before max_payload existed has max_payload: null — in that case
    // clear the field rather than keeping a previous selection's payload, which would otherwise
    // silently pair one vehicle's dimensions with a different vehicle's payload capacity.
    const sourceMaxPayload = preset ? preset.maxPayload : profile?.maxPayload;
    setVehicle((prev) => ({
      presetId,
      length: source ? String(source.length) : prev.length,
      width: source ? String(source.width) : prev.width,
      height: source ? String(source.height) : prev.height,
      maxPayload: source ? (sourceMaxPayload != null ? String(sourceMaxPayload) : "") : prev.maxPayload,
    }));
  }

  async function saveProfile() {
    setProfileError(null);

    const parsed = vehicleProfileInputSchema.safeParse({
      label: profileLabel.trim(),
      length: Number(vehicle.length),
      width: Number(vehicle.width),
      height: Number(vehicle.height),
      maxPayload: Number(vehicle.maxPayload),
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
    setProfileError(null);
    try {
      const response = await fetch(`/api/vehicle-profiles/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setProfileError(`Could not delete profile (status ${response.status}).`);
        return;
      }
      setSavedProfiles((prev) => prev.filter((profile) => profile.id !== id));
      if (vehicle.presetId === id) {
        setVehicle((prev) => ({ ...prev, presetId: "custom" }));
      }
    } catch {
      setProfileError("Could not reach the server. Please try again.");
    }
  }

  function startEditProfile(profile: VehicleProfile) {
    setEditingProfileId(profile.id);
    setProfileEditDraft({
      label: profile.label,
      length: String(profile.length),
      width: String(profile.width),
      height: String(profile.height),
      maxPayload: profile.maxPayload != null ? String(profile.maxPayload) : "",
    });
    setProfileEditError(null);
  }

  function cancelEditProfile() {
    setEditingProfileId(null);
    setProfileEditDraft(null);
    setProfileEditError(null);
  }

  async function saveProfileEdit(id: string) {
    if (!profileEditDraft) return;
    setProfileEditError(null);

    const parsed = vehicleProfileInputSchema.safeParse({
      label: profileEditDraft.label.trim(),
      length: Number(profileEditDraft.length),
      width: Number(profileEditDraft.width),
      height: Number(profileEditDraft.height),
      maxPayload: Number(profileEditDraft.maxPayload),
    });
    if (!parsed.success) {
      setProfileEditError(collectZodErrors(z.treeifyError(parsed.error)).join(" "));
      return;
    }

    setSavingProfileEdit(true);
    try {
      const response = await fetch(`/api/vehicle-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        setProfileEditError(`Could not save changes (status ${response.status}).`);
        return;
      }

      const updated = (await response.json()) as VehicleProfile;
      setSavedProfiles((prev) => prev.map((profile) => (profile.id === id ? updated : profile)));
      if (vehicle.presetId === id) {
        setVehicle((prev) => ({
          ...prev,
          length: String(updated.length),
          width: String(updated.width),
          height: String(updated.height),
          maxPayload: updated.maxPayload != null ? String(updated.maxPayload) : prev.maxPayload,
        }));
      }
      cancelEditProfile();
    } catch {
      setProfileEditError("Could not reach the server. Please try again.");
    } finally {
      setSavingProfileEdit(false);
    }
  }

  async function saveItemTemplate(row: GoodsRowState) {
    setItemTemplateError(null);

    const parsed = goodsItemTemplateInputSchema.safeParse({
      label: row.label.trim(),
      length: Number(row.length),
      width: Number(row.width),
      height: Number(row.height),
      weight: Number(row.weight),
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
        weight: template.weight != null ? String(template.weight) : "",
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
    setItemTemplateError(null);
    try {
      const response = await fetch(`/api/goods-item-templates/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setItemTemplateError(`Could not delete item (status ${response.status}).`);
        return;
      }
      setSavedItemTemplates((prev) => prev.filter((template) => template.id !== id));
    } catch {
      setItemTemplateError("Could not reach the server. Please try again.");
    }
  }

  function startEditTemplate(template: GoodsItemTemplate) {
    setEditingTemplateId(template.id);
    setTemplateEditDraft({
      label: template.label,
      length: String(template.length),
      width: String(template.width),
      height: String(template.height),
      weight: template.weight != null ? String(template.weight) : "",
      rotatable: template.rotatable,
      stackable: template.stackable,
    });
    setTemplateEditError(null);
  }

  function cancelEditTemplate() {
    setEditingTemplateId(null);
    setTemplateEditDraft(null);
    setTemplateEditError(null);
  }

  async function saveTemplateEdit(id: string) {
    if (!templateEditDraft) return;
    setTemplateEditError(null);

    const parsed = goodsItemTemplateInputSchema.safeParse({
      label: templateEditDraft.label.trim(),
      length: Number(templateEditDraft.length),
      width: Number(templateEditDraft.width),
      height: Number(templateEditDraft.height),
      weight: Number(templateEditDraft.weight),
      rotatable: templateEditDraft.rotatable,
      stackable: templateEditDraft.stackable,
    });
    if (!parsed.success) {
      setTemplateEditError(collectZodErrors(z.treeifyError(parsed.error)).join(" "));
      return;
    }

    setSavingTemplateEdit(true);
    try {
      const response = await fetch(`/api/goods-item-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!response.ok) {
        setTemplateEditError(`Could not save changes (status ${response.status}).`);
        return;
      }

      const updated = (await response.json()) as GoodsItemTemplate;
      setSavedItemTemplates((prev) => prev.map((template) => (template.id === id ? updated : template)));
      cancelEditTemplate();
    } catch {
      setTemplateEditError("Could not reach the server. Please try again.");
    } finally {
      setSavingTemplateEdit(false);
    }
  }

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setApiError(null);
    setResult(null);

    const request = buildRequest(rows, vehicle, preserveOrder);
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
      setResultItems(parsed.data.items);
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
                        <SelectPrimitive.Item
                          key={profile.id}
                          value={profile.id}
                          className="focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default items-center justify-between gap-2 rounded-sm py-1.5 pr-2 pl-2 text-sm outline-hidden select-none"
                          // Edit/Delete below are nested interactive elements inside this role="option"
                          // item, so they aren't Tab-reachable — F2/Delete on the focused option are
                          // the keyboard paths to the same actions.
                          onKeyDown={(e) => {
                            if (e.key === "Delete" || e.key === "Backspace") {
                              e.preventDefault();
                              void deleteProfile(profile.id);
                            } else if (e.key === "F2") {
                              e.preventDefault();
                              startEditProfile(profile);
                            }
                          }}
                        >
                          <SelectPrimitive.ItemText>
                            {profile.label} ({profile.length}x{profile.width}x{profile.height} cm)
                          </SelectPrimitive.ItemText>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${profile.label}`}
                              className="text-blue-700 hover:text-blue-900"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                              }}
                              onPointerUp={(e) => {
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditProfile(profile);
                              }}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${profile.label}`}
                              className="text-red-600 hover:text-red-800"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                              }}
                              onPointerUp={(e) => {
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteProfile(profile.id);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </SelectPrimitive.Item>
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
              <Label htmlFor="vehicle-length" className="mb-1 text-blue-100/80">
                Length (cm)
              </Label>
              <Input
                id="vehicle-length"
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
              <Label htmlFor="vehicle-width" className="mb-1 text-blue-100/80">
                Width (cm)
              </Label>
              <Input
                id="vehicle-width"
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
              <Label htmlFor="vehicle-height" className="mb-1 text-blue-100/80">
                Height (cm)
              </Label>
              <Input
                id="vehicle-height"
                type="number"
                min="0"
                value={vehicle.height}
                onChange={(e) => {
                  setVehicle((prev) => ({ ...prev, height: e.target.value }));
                }}
                className="bg-white/10 text-white"
              />
            </div>
            <div>
              <Label htmlFor="vehicle-max-payload" className="mb-1 text-blue-100/80">
                Max payload (kg)
              </Label>
              <Input
                id="vehicle-max-payload"
                type="number"
                min="0"
                value={vehicle.maxPayload}
                onChange={(e) => {
                  setVehicle((prev) => ({ ...prev, maxPayload: e.target.value }));
                }}
                className="bg-white/10 text-white"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1">
              <Label htmlFor="profile-label" className="mb-1 text-blue-100/80">
                Save current as profile
              </Label>
              <Input
                id="profile-label"
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
              className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
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
        </section>

        <Dialog
          open={editingProfileId !== null}
          onOpenChange={(open) => {
            if (!open) cancelEditProfile();
          }}
        >
          <DialogContent className="text-foreground">
            <DialogHeader>
              <DialogTitle>Edit vehicle profile</DialogTitle>
              <DialogDescription>Update the saved label, dimensions, and max payload.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="edit-profile-label" className="mb-1">
                  Label
                </Label>
                <Input
                  id="edit-profile-label"
                  value={profileEditDraft?.label ?? ""}
                  onChange={(e) => {
                    setProfileEditDraft((prev) => (prev ? { ...prev, label: e.target.value } : prev));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="edit-profile-length" className="mb-1">
                  Length (cm)
                </Label>
                <Input
                  id="edit-profile-length"
                  type="number"
                  min="0"
                  value={profileEditDraft?.length ?? ""}
                  onChange={(e) => {
                    setProfileEditDraft((prev) => (prev ? { ...prev, length: e.target.value } : prev));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="edit-profile-width" className="mb-1">
                  Width (cm)
                </Label>
                <Input
                  id="edit-profile-width"
                  type="number"
                  min="0"
                  value={profileEditDraft?.width ?? ""}
                  onChange={(e) => {
                    setProfileEditDraft((prev) => (prev ? { ...prev, width: e.target.value } : prev));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="edit-profile-height" className="mb-1">
                  Height (cm)
                </Label>
                <Input
                  id="edit-profile-height"
                  type="number"
                  min="0"
                  value={profileEditDraft?.height ?? ""}
                  onChange={(e) => {
                    setProfileEditDraft((prev) => (prev ? { ...prev, height: e.target.value } : prev));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="edit-profile-max-payload" className="mb-1">
                  Max payload (kg)
                </Label>
                <Input
                  id="edit-profile-max-payload"
                  type="number"
                  min="0"
                  value={profileEditDraft?.maxPayload ?? ""}
                  onChange={(e) => {
                    setProfileEditDraft((prev) => (prev ? { ...prev, maxPayload: e.target.value } : prev));
                  }}
                />
              </div>
            </div>
            {profileEditError && <p className="text-sm text-red-300">{profileEditError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={cancelEditProfile}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={savingProfileEdit}
                onClick={() => {
                  if (editingProfileId) void saveProfileEdit(editingProfileId);
                }}
              >
                <Save className="size-4" />
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={editingTemplateId !== null}
          onOpenChange={(open) => {
            if (!open) cancelEditTemplate();
          }}
        >
          <DialogContent className="text-foreground">
            <DialogHeader>
              <DialogTitle>Edit saved item</DialogTitle>
              <DialogDescription>Update the saved label, dimensions, weight, and flags.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="edit-template-label" className="mb-1">
                  Label
                </Label>
                <Input
                  id="edit-template-label"
                  value={templateEditDraft?.label ?? ""}
                  onChange={(e) => {
                    setTemplateEditDraft((prev) => (prev ? { ...prev, label: e.target.value } : prev));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="edit-template-length" className="mb-1">
                  Length (cm)
                </Label>
                <Input
                  id="edit-template-length"
                  type="number"
                  min="0"
                  value={templateEditDraft?.length ?? ""}
                  onChange={(e) => {
                    setTemplateEditDraft((prev) => (prev ? { ...prev, length: e.target.value } : prev));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="edit-template-width" className="mb-1">
                  Width (cm)
                </Label>
                <Input
                  id="edit-template-width"
                  type="number"
                  min="0"
                  value={templateEditDraft?.width ?? ""}
                  onChange={(e) => {
                    setTemplateEditDraft((prev) => (prev ? { ...prev, width: e.target.value } : prev));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="edit-template-height" className="mb-1">
                  Height (cm)
                </Label>
                <Input
                  id="edit-template-height"
                  type="number"
                  min="0"
                  value={templateEditDraft?.height ?? ""}
                  onChange={(e) => {
                    setTemplateEditDraft((prev) => (prev ? { ...prev, height: e.target.value } : prev));
                  }}
                />
              </div>
              <div>
                <Label htmlFor="edit-template-weight" className="mb-1">
                  Weight (kg)
                </Label>
                <Input
                  id="edit-template-weight"
                  type="number"
                  min="0"
                  value={templateEditDraft?.weight ?? ""}
                  onChange={(e) => {
                    setTemplateEditDraft((prev) => (prev ? { ...prev, weight: e.target.value } : prev));
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={templateEditDraft?.rotatable ?? false}
                  onCheckedChange={(checked) => {
                    setTemplateEditDraft((prev) => (prev ? { ...prev, rotatable: checked === true } : prev));
                  }}
                />
                <Label>Can be rotated</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={templateEditDraft?.stackable ?? false}
                  onCheckedChange={(checked) => {
                    setTemplateEditDraft((prev) => (prev ? { ...prev, stackable: checked === true } : prev));
                  }}
                />
                <Label>Other items can stack on it</Label>
              </div>
            </div>
            {templateEditError && <p className="text-sm text-red-300">{templateEditError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={cancelEditTemplate}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={savingTemplateEdit}
                onClick={() => {
                  if (editingTemplateId) void saveTemplateEdit(editingTemplateId);
                }}
              >
                <Save className="size-4" />
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                          // Edit/Delete below are nested interactive elements inside this role="option"
                          // item, so they aren't Tab-reachable — F2/Delete on the focused option are
                          // the keyboard paths to the same actions.
                          onKeyDown={(e) => {
                            if (e.key === "Delete" || e.key === "Backspace") {
                              e.preventDefault();
                              void deleteItemTemplate(template.id);
                            } else if (e.key === "F2") {
                              e.preventDefault();
                              startEditTemplate(template);
                            }
                          }}
                        >
                          <SelectPrimitive.ItemText>
                            {template.label} ({template.length}x{template.width}x{template.height} cm
                            {template.weight != null ? `, ${template.weight}kg` : ""})
                          </SelectPrimitive.ItemText>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${template.label}`}
                              className="text-blue-700 hover:text-blue-900"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                              }}
                              onPointerUp={(e) => {
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditTemplate(template);
                              }}
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${template.label}`}
                              className="text-red-600 hover:text-red-800"
                              onPointerDown={(e) => {
                                e.stopPropagation();
                              }}
                              onPointerUp={(e) => {
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                void deleteItemTemplate(template.id);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </SelectPrimitive.Item>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
                onClick={addRow}
              >
                <Plus className="size-4" />
                Add item
              </Button>
            </div>
          </div>

          {itemTemplateError && <p className="mb-3 text-sm text-red-300">{itemTemplateError}</p>}

          <label className="mb-3 flex items-center gap-2 text-sm text-blue-100/80">
            <Checkbox
              checked={preserveOrder}
              onCheckedChange={(checked) => {
                setPreserveOrder(checked === true);
              }}
            />
            Preserve the exact order shown below when packing (otherwise heavier items may be placed earlier so lighter
            items can rest on top of them)
          </label>

          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.key} className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="grid gap-3 sm:grid-cols-7">
                  <div className="sm:col-span-2">
                    <Label htmlFor={`item-label-${row.key}`} className="mb-1 text-blue-100/80">
                      Label
                    </Label>
                    <Input
                      id={`item-label-${row.key}`}
                      value={row.label}
                      onChange={(e) => {
                        updateRow(row.key, { label: e.target.value });
                      }}
                      className="bg-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`item-length-${row.key}`} className="mb-1 text-blue-100/80">
                      Length
                    </Label>
                    <Input
                      id={`item-length-${row.key}`}
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
                    <Label htmlFor={`item-width-${row.key}`} className="mb-1 text-blue-100/80">
                      Width
                    </Label>
                    <Input
                      id={`item-width-${row.key}`}
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
                    <Label htmlFor={`item-height-${row.key}`} className="mb-1 text-blue-100/80">
                      Height
                    </Label>
                    <Input
                      id={`item-height-${row.key}`}
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
                    <Label htmlFor={`item-weight-${row.key}`} className="mb-1 text-blue-100/80">
                      Weight (kg)
                    </Label>
                    <Input
                      id={`item-weight-${row.key}`}
                      type="number"
                      min="0"
                      value={row.weight}
                      onChange={(e) => {
                        updateRow(row.key, { weight: e.target.value });
                      }}
                      className="bg-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`item-quantity-${row.key}`} className="mb-1 text-blue-100/80">
                      Quantity
                    </Label>
                    <Input
                      id={`item-quantity-${row.key}`}
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

      {result && resultVehicle && <FitCheckResultView result={result} vehicle={resultVehicle} items={resultItems} />}
    </div>
  );
}
