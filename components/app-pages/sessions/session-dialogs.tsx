"use client";

import { useState, type ReactNode } from "react";
import { ChevronDownIcon, TrashIcon } from "@/components/app-pages/shared/icons";
import type { FilterCategory, FilterState, SortOption } from "@/lib/hooks/use-filter-sort";
import type { SelectCat } from "@/lib/validation/cats";

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

function applyDropdownFilter(
  key: string,
  value: string,
  activeFilters: FilterState,
  toggleFilter: (k: string, v: string) => void,
) {
  const current = getFilterValue(activeFilters, key);
  if (current) toggleFilter(key, current);
  if (value) toggleFilter(key, value);
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
        <div className="relative mt-1.5">
          <select
            value={regionId}
            onChange={(e) => onRegionChange(e.target.value)}
            className="h-10 w-full appearance-none rounded-full border border-brand-orange/30 bg-white px-4 pr-10 text-sm text-foreground outline-none"
          >
            <option value="">Value (type to search)</option>
            {regionOptions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-orange/70" />
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
          Keep Editing <span>✎</span>
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

type ApproveSessionDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function ApproveSessionDialog({ open, onClose, onConfirm, isLoading }: ApproveSessionDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Approve session?" onClose={onClose} />
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

// ─── Discard Session Dialog ───────────────────────────────────────────────────

type DiscardSessionDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function DiscardSessionDialog({ open, onClose, onConfirm, isLoading }: DiscardSessionDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Discard session?" onClose={onClose} />
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
  onToggle: (key: string, value: string) => void;
  onClear: () => void;
  activeCount: number;
};

export function SessionFiltersDialog({
  open,
  onClose,
  categories,
  activeFilters,
  onToggle,
  onClear,
  activeCount,
}: SessionFiltersDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header
        title="Filters"
        subtitle={activeCount > 0 ? `${activeCount} selected` : undefined}
        onClose={onClose}
      />

      <div className="space-y-3">
        {categories.map((cat) => (
          <SelectField
            key={cat.key}
            label={cat.label}
            value={getFilterValue(activeFilters, cat.key)}
            onChange={(v) => applyDropdownFilter(cat.key, v, activeFilters, onToggle)}
            options={cat.options}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => { onClear(); onClose(); }}
          className="flex items-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80"
        >
          Reset <span>✕</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Apply <span>✓</span>
        </button>
      </div>
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
  onSort: (key: string | null) => void;
  onOrder: (o: "asc" | "desc") => void;
};

export function SessionSortByDialog({
  open,
  onClose,
  options,
  activeKey,
  order,
  onSort,
  onOrder,
}: SessionSortByDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Sort By" onClose={onClose} />

      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSort(activeKey === opt.key ? null : opt.key)}
            className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
              activeKey === opt.key
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
              onClick={() => onOrder(o)}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition-opacity ${
                order === o
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
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Apply <span>✓</span>
        </button>
      </div>
    </Shell>
  );
}

// ─── Merge Details Dialog ─────────────────────────────────────────────────────

type MergeField = {
  label: string;
  key: keyof Pick<SelectCat, "color" | "age" | "sex" | "sociability" | "cat_status">;
};

const MERGE_FIELDS: MergeField[] = [
  { label: "Color", key: "color" },
  { label: "Size/Age", key: "age" },
  { label: "Sex", key: "sex" },
  { label: "Sociability", key: "sociability" },
  { label: "Status", key: "cat_status" },
];

type MergeSelection = Partial<Record<string, "a" | "b">>;

type MergeDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  catA: SelectCat | null;
  catB: SelectCat | null;
  onMerge: (selections: MergeSelection) => void;
  isLoading?: boolean;
};

export function MergeDetailsDialog({
  open,
  onClose,
  catA,
  catB,
  onMerge,
  isLoading,
}: MergeDetailsDialogProps) {
  const [selections, setSelections] = useState<MergeSelection>({});

  const toggleSelection = (key: string, side: "a" | "b") => {
    setSelections((prev) => ({ ...prev, [key]: prev[key] === side ? undefined : side }));
  };

  const handleReset = () => setSelections({});

  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Merge Details" subtitle="Select which information to retain." onClose={onClose} />

      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
        {MERGE_FIELDS.map((field) => {
          const valA = catA?.[field.key] ?? "—";
          const valB = catB?.[field.key] ?? "—";
          return (
            <div key={field.key}>
              <p className="mb-1.5 text-sm font-semibold text-brand-orange">{field.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelection(field.key, "a")}
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                    selections[field.key] === "a"
                      ? "border-brand-green bg-brand-green text-white"
                      : "border-pink-200 bg-pink-50 text-foreground hover:bg-pink-100"
                  }`}
                >
                  {String(valA)}
                </button>
                <button
                  type="button"
                  onClick={() => toggleSelection(field.key, "b")}
                  className={`rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
                    selections[field.key] === "b"
                      ? "border-brand-green bg-brand-green text-white"
                      : "border-pink-200 bg-pink-50 text-foreground hover:bg-pink-100"
                  }`}
                >
                  {String(valB)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
          onClick={() => onMerge(selections)}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Merging..." : "Merge"} <span>✓</span>
        </button>
      </div>
    </Shell>
  );
}
