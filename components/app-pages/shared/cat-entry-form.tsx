"use client";

import { useState, useCallback, useEffect } from "react";
import { ImagePlaceholderIcon, UploadIcon } from "./icons";
import { createCat } from "@/app/actions/cats";
import { createSessionCat } from "@/app/actions/sessions";
import { createClient } from "@/lib/supabase/client";
import {
  CAT_COLOR_VALUES,
  CAT_AGE_VALUES,
  CAT_SEX_VALUES,
  CAT_SOCIABILITY_VALUES,
  CAT_STATUS_VALUES,
  CATHEALTHRECORD_CONDITION_VALUES,
} from "@/lib/db/enums";
import type {
  CatColor,
  CatAge,
  CatSex,
  CatSociability,
  CatStatus,
  CatHealthRecordCondition,
} from "@/lib/db/enums";

type RegionOption = {
  id: string;
  name: string;
};

type CatEntryFormProps = {
  onClose: () => void;
  /** Called after successful save — parent can re-fetch data */
  onSave?: () => void;
  /** Pre-selected region ID. If provided, region dropdown is hidden. */
  regionId?: string;
  /** If provided, entry will be created under this session via createSessionCat. */
  sessionId?: string;
};

function DropdownField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-slate-700">{label}</label>
      <div className="relative mt-1 rounded-lg border border-slate-200 bg-white">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900"
        >
          <option value="">&mdash;</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          &#9660;
        </span>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-slate-700">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400"
      />
    </div>
  );
}

export function CatEntryForm({
  onClose,
  onSave,
  regionId,
  sessionId,
}: CatEntryFormProps) {
  const [color, setColor] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("");
  const [sociability, setSociability] = useState("");
  const [catStatus, setCatStatus] = useState("");
  const [condition, setCondition] = useState("");
  const [spotLastSeen, setSpotLastSeen] = useState("");
  const [caretaker, setCaretaker] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [regionOptions, setRegionOptions] = useState<RegionOption[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (regionId) return;

    const loadRegions = async () => {
      setRegionsLoading(true);
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from("regions")
          .select("id,name");

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        const options = (data ?? [])
          .filter((row): row is { id: string; name: string } =>
            Boolean(row?.id && row?.name),
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        setRegionOptions(options);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load regions.",
        );
      } finally {
        setRegionsLoading(false);
      }
    };

    loadRegions();
  }, [regionId]);

  const handleSave = useCallback(async () => {
    const effectiveRegionId = regionId ?? selectedRegion;
    if (!effectiveRegionId) {
      setError("Please select a region/location.");
      return;
    }
    if (!condition) {
      setError("Please select a condition.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        region_id: effectiveRegionId,
        condition: condition as CatHealthRecordCondition,
        color: (color || undefined) as CatColor | undefined,
        age: (age || undefined) as CatAge | undefined,
        sex: (sex || undefined) as CatSex | undefined,
        sociability: (sociability || undefined) as CatSociability | undefined,
        cat_status: (catStatus || undefined) as CatStatus | undefined,
        spot_last_seen: spotLastSeen || undefined,
        caretaker: caretaker || undefined,
        notes: notes || undefined,
        name: name || undefined,
      };

      const result = sessionId
        ? await createSessionCat({
            ...payload,
            session_id: sessionId,
          })
        : await createCat(payload);

      if (result?.serverError) {
        setError(result.serverError);
        return;
      }

      onSave?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cat.");
    } finally {
      setSaving(false);
    }
  }, [
    regionId,
    selectedRegion,
    condition,
    color,
    age,
    sex,
    sociability,
    catStatus,
    spotLastSeen,
    caretaker,
    notes,
    name,
    sessionId,
    onSave,
    onClose,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: avatar + name + close */}
        <div className="flex items-center gap-3 px-5 pb-3 pt-5">
          <div className="relative h-12 w-12 shrink-0">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
              <ImagePlaceholderIcon className="h-6 w-6 text-slate-400" />
            </div>
            <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-500">
              <UploadIcon className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Cat Name"
            className="flex-1 text-base font-bold tracking-tight text-slate-900 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-slate-400"
            aria-label="Close"
          >
            &#10005;
          </button>
        </div>

        {/* Error message */}
        {error ? (
          <div className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        ) : null}

        {/* Scrollable fields */}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 pb-2">
          {!regionId ? (
            <div>
              <label className="text-sm text-slate-700">Location</label>
              <div className="relative mt-1 rounded-lg border border-slate-200 bg-white">
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  disabled={regionsLoading}
                  className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {regionsLoading ? "Loading..." : "—"}
                  </option>
                  {regionOptions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  &#9660;
                </span>
              </div>
            </div>
          ) : null}
          <DropdownField
            label="Color"
            options={CAT_COLOR_VALUES}
            value={color}
            onChange={setColor}
          />
          <DropdownField
            label="Size / Age"
            options={CAT_AGE_VALUES}
            value={age}
            onChange={setAge}
          />
          <DropdownField
            label="Sex"
            options={CAT_SEX_VALUES}
            value={sex}
            onChange={setSex}
          />
          <DropdownField
            label="Sociability"
            options={CAT_SOCIABILITY_VALUES}
            value={sociability}
            onChange={setSociability}
          />
          <DropdownField
            label="Status"
            options={CAT_STATUS_VALUES}
            value={catStatus}
            onChange={setCatStatus}
          />
          <DropdownField
            label="Condition"
            options={CATHEALTHRECORD_CONDITION_VALUES}
            value={condition}
            onChange={setCondition}
          />
          <TextField
            label="Spot Last Seen"
            value={spotLastSeen}
            onChange={setSpotLastSeen}
          />
          <TextField
            label="Caretaker"
            value={caretaker}
            onChange={setCaretaker}
          />
          <div>
            <label className="text-sm text-slate-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
        </div>

        {/* Save */}
        <div className="px-5 pb-5 pt-3">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
