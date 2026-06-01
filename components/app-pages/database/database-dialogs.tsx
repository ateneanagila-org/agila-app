"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import {
  CheckIcon,
  CloseIcon,
  SaveIcon,
  TrashIcon,
} from "@/components/app-pages/shared/icons";
import { CustomSelect } from "@/components/ui/custom-select";
import type {
  FilterCategory,
  FilterState,
  SortOption,
} from "@/lib/hooks/use-filter-sort";

// ─── Shared shell ─────────────────────────────────────────────────────────────

function Shell({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
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

function Header({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="font-heading text-xl font-bold tracking-tight text-brand-green">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="ml-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-dark p-0 text-white transition-opacity hover:opacity-80"
        aria-label="Close"
      >
        <CloseIcon className="h-4 w-4" />
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
      <div className="mt-1.5">
        <CustomSelect
          options={options}
          value={value}
          onChange={onChange}
          variant="white"
        />
      </div>
    </div>
  );
}

function getFilterValue(activeFilters: FilterState, key: string): string {
  const set = activeFilters[key];
  return set && set.size > 0 ? (set.values().next().value as string) : "";
}

// ─── Discard Changes Dialog ───────────────────────────────────────────────────

type DiscardChangesDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function DiscardChangesDialog({
  open,
  onClose,
  onConfirm,
  isLoading,
}: DiscardChangesDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Discard changes?" onClose={onClose} />
      <p className="text-sm text-foreground">This action cannot be undone.</p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Keep Editing <CloseIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Discarding..." : "Discard"}{" "}
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </Shell>
  );
}

// ─── Save Changes Dialog ──────────────────────────────────────────────────────

type SaveChangesDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function SaveChangesDialog({
  open,
  onClose,
  onConfirm,
  isLoading,
}: SaveChangesDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Save changes?" onClose={onClose} />
      <p className="text-sm text-foreground">This action cannot be undone.</p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Keep Editing <CloseIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Saving..." : "Save"} <SaveIcon className="h-4 w-4" />
        </button>
      </div>
    </Shell>
  );
}

// ─── Database Filters Dialog ──────────────────────────────────────────────────

type DatabaseFiltersDialogProps = {
  open: boolean;
  onClose: () => void;
  categories: FilterCategory[];
  activeFilters: FilterState;
  onClear: () => void;
  onApply: (filters: Record<string, string>) => void;
};

// Body is split out so its `useState(() => init)` runs fresh on each open
// (parent unmounts/remounts on `open` toggle) — avoids syncing via useEffect.
function FiltersDialogBody({
  categories,
  activeFilters,
  onClose,
  onClear,
  onApply,
}: Omit<DatabaseFiltersDialogProps, "open">) {
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

      <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
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
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80"
        >
          Reset <CloseIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onApply(pending)}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Apply <CheckIcon className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

export function DatabaseFiltersDialog(props: DatabaseFiltersDialogProps) {
  return (
    <Shell open={props.open} onClose={props.onClose}>
      <FiltersDialogBody {...props} />
    </Shell>
  );
}

// ─── Database Sort By Dialog ──────────────────────────────────────────────────

type DatabaseSortByDialogProps = {
  open: boolean;
  onClose: () => void;
  options: SortOption[];
  activeKey: string | null;
  order: "asc" | "desc";
  onApply: (key: string | null, order: "asc" | "desc") => void;
};

function SortDialogBody({
  options,
  activeKey,
  order,
  onClose,
  onApply,
}: Omit<DatabaseSortByDialogProps, "open">) {
  const [pending, setPending] = useState<{
    key: string | null;
    order: "asc" | "desc";
  }>(() => ({ key: activeKey, order }));

  return (
    <>
      <Header title="Sort By" onClose={onClose} />

      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() =>
              setPending((p) => ({
                ...p,
                key: p.key === opt.key ? null : opt.key,
              }))
            }
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
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-green px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Apply <CheckIcon className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

export function DatabaseSortByDialog(props: DatabaseSortByDialogProps) {
  return (
    <Shell open={props.open} onClose={props.onClose}>
      <SortDialogBody {...props} />
    </Shell>
  );
}

// ─── New Intervention Dialog ──────────────────────────────────────────────────

type NewInterventionDialogProps = {
  open: boolean;
  onClose: () => void;
  type: string;
  onTypeChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  typeOptions: readonly string[];
  onCreate: () => void;
  creating: boolean;
  error?: string | null;
};

export function NewInterventionDialog({
  open,
  onClose,
  type,
  onTypeChange,
  notes,
  onNotesChange,
  typeOptions,
  onCreate,
  creating,
  error,
}: NewInterventionDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="New Intervention" onClose={onClose} />

      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        <SelectField
          label="Type"
          value={type}
          onChange={onTypeChange}
          options={typeOptions}
        />
        <div>
          <label className="text-sm font-semibold text-brand-orange">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="mt-1.5 h-20 w-full resize-none rounded-2xl border border-brand-orange/30 bg-white px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-brand-orange/40"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80"
        >
          Cancel <CloseIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={creating}
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Apply"} <SaveIcon className="h-4 w-4" />
        </button>
      </div>
    </Shell>
  );
}
