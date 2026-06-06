"use client";

import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { ChevronDownIcon, TrashIcon } from "@/components/app-pages/shared/icons";
import { CustomSelect } from "@/components/ui/custom-select";
import { CatPhoto } from "@/components/app-pages/shared/cat-photo";
import type { FilterCategory, FilterState, SortOption } from "@/lib/hooks/use-filter-sort";

// ─── Shared shell ─────────────────────────────────────────────────────────────

function Shell({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl bg-brand-cream p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Header({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="font-heading text-xl font-bold italic tracking-tight text-brand-green">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-dark text-sm text-white transition-opacity hover:opacity-80"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-brand-orange">{label}</label>
      <div className="relative mt-1.5">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-full border border-brand-orange/30 bg-white px-4 pr-10 text-sm text-foreground outline-none"
        >
          <option value="">Value</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-orange/70" />
      </div>
    </div>
  );
}

function getFilterValue(activeFilters: FilterState, key: string): string {
  const set = activeFilters[key];
  return set && set.size > 0 ? (set.values().next().value as string) : "";
}

// ─── Create Session Dialog ────────────────────────────────────────────────────

type CreateSessionDialogProps = {
  open: boolean;
  onClose: () => void;
  regionId: string;
  onRegionChange: (id: string) => void;
  regionOptions: { id: string; name: string }[];
  onCreate: () => void;
  creating: boolean;
};

export function CreateSessionDialog({
  open,
  onClose,
  regionId,
  onRegionChange,
  regionOptions,
  onCreate,
  creating,
}: CreateSessionDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Create Session" onClose={onClose} />

      <div>
        <label className="text-sm font-semibold text-brand-orange">Location</label>
        <div className="mt-1.5">
          <CustomSelect
            options={regionOptions.map((r) => r.name)}
            value={regionOptions.find((r) => r.id === regionId)?.name ?? ""}
            onChange={(name) => {
              const found = regionOptions.find((r) => r.name === name);
              if (found) onRegionChange(found.id);
            }}
            placeholder="—"
            variant="white"
          />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          disabled={creating || !regionId}
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create"} <span>✓</span>
        </button>
      </div>
    </Shell>
  );
}

// ─── Finish Session Dialog ────────────────────────────────────────────────────

type FinishSessionDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function FinishSessionDialog({ open, onClose, onConfirm, isLoading }: FinishSessionDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Finish session?" onClose={onClose} />
      <p className="text-sm text-foreground">This action cannot be undone.</p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Keep Editing <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Finishing..." : "Finish"} <span>✓</span>
        </button>
      </div>
    </Shell>
  );
}

// ─── Approve Session Dialog ───────────────────────────────────────────────────

type ApproveCatDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function ApproveCatDialog({ open, onClose, onConfirm, isLoading }: ApproveCatDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Approve cat?" onClose={onClose} />
      <p className="text-sm text-foreground">This action cannot be undone.</p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Cancel <span>✕</span>
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Approving..." : "Approve"} <span>✓</span>
        </button>
      </div>
    </Shell>
  );
}

// ─── Delete Session Dialog ───────────────────────────────────────────────────

type DeleteSessionDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function DeleteSessionDialog({ open, onClose, onConfirm, isLoading }: DeleteSessionDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Delete session?" onClose={onClose} />
      <p className="text-sm text-foreground">This action cannot be undone.</p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Cancel <span>✕</span>
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Discarding..." : "Discard"} <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </Shell>
  );
}

// ─── Session Filters Dialog ───────────────────────────────────────────────────

type SessionFiltersDialogProps = {
  open: boolean;
  onClose: () => void;
  categories: FilterCategory[];
  activeFilters: FilterState;
  onClear: () => void;
  onApply: (filters: Record<string, string>) => void;
};

function SessionFiltersBody({
  categories,
  activeFilters,
  onClose,
  onClear,
  onApply,
}: Omit<SessionFiltersDialogProps, "open">) {
  const [pending, setPending] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const cat of categories) {
      init[cat.key] = getFilterValue(activeFilters, cat.key);
    }
    return init;
  });

  const pendingCount = Object.values(pending).filter(Boolean).length;

  return (
    <>
      <Header
        title="Filters"
        subtitle={pendingCount > 0 ? `${pendingCount} selected` : undefined}
        onClose={onClose}
      />

      <div className="space-y-3">
        {categories.map((cat) => (
          <SelectField
            key={cat.key}
            label={cat.label}
            value={pending[cat.key] ?? ""}
            onChange={(v) => setPending((prev) => ({ ...prev, [cat.key]: v }))}
            options={cat.options}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80"
        >
          Reset <span>✕</span>
        </button>
        <button
          type="button"
          onClick={() => onApply(pending)}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Apply <span>✓</span>
        </button>
      </div>
    </>
  );
}

export function SessionFiltersDialog(props: SessionFiltersDialogProps) {
  return (
    <Shell open={props.open} onClose={props.onClose}>
      <SessionFiltersBody {...props} />
    </Shell>
  );
}

// ─── Session Sort By Dialog ───────────────────────────────────────────────────

type SessionSortByDialogProps = {
  open: boolean;
  onClose: () => void;
  options: SortOption[];
  activeKey: string | null;
  order: "asc" | "desc";
  onApply: (key: string | null, order: "asc" | "desc") => void;
};

function SessionSortBody({
  options,
  activeKey,
  order,
  onClose,
  onApply,
}: Omit<SessionSortByDialogProps, "open">) {
  const [pending, setPending] = useState<{ key: string | null; order: "asc" | "desc" }>(
    () => ({ key: activeKey, order }),
  );

  return (
    <>
      <Header title="Sort By" onClose={onClose} />

      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setPending((p) => ({ ...p, key: p.key === opt.key ? null : opt.key }))}
            className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
              pending.key === opt.key
                ? "border-brand-green bg-brand-green text-white"
                : "border-brand-green/30 text-foreground hover:bg-brand-green/5"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Order</p>
        <div className="grid grid-cols-2 gap-2">
          {(["asc", "desc"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setPending((p) => ({ ...p, order: o }))}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition-opacity ${
                pending.order === o
                  ? "bg-brand-orange text-white"
                  : "border border-brand-orange/40 text-foreground hover:opacity-80"
              }`}
            >
              {o === "asc" ? "Ascending" : "Descending"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => onApply(pending.key, pending.order)}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Apply <span>✓</span>
        </button>
      </div>
    </>
  );
}

export function SessionSortByDialog(props: SessionSortByDialogProps) {
  return (
    <Shell open={props.open} onClose={props.onClose}>
      <SessionSortBody {...props} />
    </Shell>
  );
}

// ─── Merge Details Dialog (Option A — diff-only, default to new) ─────────────

export type MergeFieldDef = {
  label: string;
  fieldKey: string;
  currentValue: string | null;
  newValue: string | null;
  inputType: "pill" | "textarea" | "image";
};

type MergeDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  targetName: string | null;
  newName: string | null;
  diffFields: MergeFieldDef[];
  autoMergedCount: number;
  onMerge: (resolved: Record<string, string | null>) => void;
  isLoading?: boolean;
};

function MergeDetailsDialogContent({
  onClose,
  targetName,
  newName,
  diffFields,
  autoMergedCount,
  onMerge,
  isLoading,
}: Omit<MergeDetailsDialogProps, "open">) {
  const defaultSelections = () =>
    Object.fromEntries(
      diffFields
        .filter((f) => f.inputType === "pill" || f.inputType === "image")
        .map((f) => [f.fieldKey, "new" as const]),
    );
  const defaultTextValues = () =>
    Object.fromEntries(
      diffFields
        .filter((f) => f.inputType === "textarea")
        .map((f) => [f.fieldKey, f.newValue ?? ""]),
    );

  const [selections, setSelections] = useState<Record<string, "new" | "current">>(defaultSelections);
  const [textValues, setTextValues] = useState<Record<string, string>>(defaultTextValues);

  const handleReset = () => {
    setSelections(defaultSelections());
    setTextValues(defaultTextValues());
  };

  const handleMerge = () => {
    const resolved: Record<string, string | null> = {};
    for (const field of diffFields) {
      if (field.inputType === "pill" || field.inputType === "image") {
        const sel = selections[field.fieldKey] ?? "new";
        resolved[field.fieldKey] = sel === "new" ? field.newValue : field.currentValue;
      } else {
        resolved[field.fieldKey] = textValues[field.fieldKey] ?? null;
      }
    }
    onMerge(resolved);
  };

  const pillFields = diffFields.filter((f) => f.inputType === "pill");
  const imageFields = diffFields.filter((f) => f.inputType === "image");
  const textareaFields = diffFields.filter((f) => f.inputType === "textarea");

  return (
    <>
      <Header
        title="Merge Details"
        subtitle={targetName ? `Merging into ${targetName}` : undefined}
        onClose={onClose}
      />

      {pillFields.length > 0 || imageFields.length > 0 || textareaFields.length > 0 ? (
        <p className="text-xs text-brand-dark/60">
          {pillFields.length + imageFields.length} field
          {pillFields.length + imageFields.length !== 1 ? "s" : ""} differ
          {autoMergedCount > 0 ? ` · ${autoMergedCount} auto-merged` : ""}
        </p>
      ) : (
        <p className="text-xs text-brand-dark/60">All fields match — only notes to review.</p>
      )}

      <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
        {imageFields.map((field) => (
          <div key={field.fieldKey}>
            <p className="mb-1.5 text-sm font-semibold text-brand-orange">{field.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["new", "current"] as const).map((side) => {
                const value = side === "new" ? field.newValue : field.currentValue;
                const selected = (selections[field.fieldKey] ?? "new") === side;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() =>
                      setSelections((s) => ({ ...s, [field.fieldKey]: side }))
                    }
                    className={`flex flex-col items-stretch gap-1.5 rounded-xl border-2 p-1.5 transition-colors ${
                      selected
                        ? "border-brand-green bg-brand-green/10"
                        : "border-brand-dark/15 bg-brand-cream hover:bg-brand-cream-dark"
                    }`}
                  >
                    <div className="aspect-square overflow-hidden rounded-lg">
                      <CatPhoto
                        photoUrl={value}
                        name={side === "new" ? newName : targetName}
                        className="h-full w-full"
                        iconClassName="h-8 w-8 text-brand-dark/30"
                      />
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-dark/60">
                        {side === "new" ? "New" : "Current"}
                      </span>
                      {selected ? <span className="text-xs text-brand-green">✓</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {pillFields.map((field) => (
          <div key={field.fieldKey}>
            <p className="mb-1.5 text-sm font-semibold text-brand-orange">{field.label}</p>
            <div className="space-y-1.5">
              {(["new", "current"] as const).map((side) => {
                const value = side === "new" ? field.newValue : field.currentValue;
                const selected = (selections[field.fieldKey] ?? "new") === side;
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() =>
                      setSelections((s) => ({ ...s, [field.fieldKey]: side }))
                    }
                    className={`flex w-full items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                      selected
                        ? "border-brand-green bg-brand-green text-white"
                        : "border-brand-dark/15 bg-brand-cream text-brand-dark hover:bg-brand-cream-dark"
                    }`}
                  >
                    <span
                      className={`w-12 shrink-0 text-left text-[10px] font-bold uppercase tracking-wider ${
                        selected ? "text-white/70" : "text-brand-dark/40"
                      }`}
                    >
                      {side === "new" ? "New" : "Current"}
                    </span>
                    <span className="flex-1 text-left">{value ?? "—"}</span>
                    {selected ? <span className="text-xs">✓</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {textareaFields.map((field) => (
          <div key={field.fieldKey}>
            <p className="mb-1.5 text-sm font-semibold text-brand-orange">{field.label}</p>
            {field.currentValue ? (
              <p className="mb-1.5 rounded-xl bg-brand-cream-dark px-3 py-2 text-xs italic text-brand-dark/60">
                Current: &ldquo;{field.currentValue}&rdquo;
              </p>
            ) : null}
            <textarea
              value={textValues[field.fieldKey] ?? ""}
              onChange={(e) =>
                setTextValues((s) => ({ ...s, [field.fieldKey]: e.target.value }))
              }
              rows={3}
              placeholder="No notes"
              className="w-full rounded-xl border border-brand-dark/15 bg-white px-3 py-2 text-sm text-brand-dark outline-none focus:border-brand-green"
            />
          </div>
        ))}
      </div>

      {autoMergedCount > 0 ? (
        <p className="text-xs font-semibold text-brand-dark/40">
          ✓ {autoMergedCount} field{autoMergedCount !== 1 ? "s" : ""} matched — auto-merged
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80"
        >
          Reset <span>✕</span>
        </button>
        <button
          type="button"
          disabled={isLoading}
          onClick={handleMerge}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Merging..." : "Merge"} <span>✓</span>
        </button>
      </div>
    </>
  );
}

export function MergeDetailsDialog({ open, ...props }: MergeDetailsDialogProps) {
  return (
    <Shell open={open} onClose={props.onClose}>
      <MergeDetailsDialogContent key={String(open)} {...props} />
    </Shell>
  );
}
