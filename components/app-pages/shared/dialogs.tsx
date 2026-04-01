import type { ReactNode } from "react";
import type {
  FilterCategory,
  FilterState,
  SortOption,
} from "@/lib/hooks/use-filter-sort";

type DialogShellProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function DialogShell({ open, onClose, children }: DialogShellProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500 transition-colors hover:bg-slate-200"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}

export function FiltersDialog({
  open,
  onClose,
  categories,
  activeFilters,
  onToggle,
  onClear,
  activeCount,
}: {
  open: boolean;
  onClose: () => void;
  categories: FilterCategory[];
  activeFilters: FilterState;
  onToggle: (categoryKey: string, value: string) => void;
  onClear: () => void;
  activeCount: number;
}) {
  return (
    <DialogShell open={open} onClose={onClose}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">Filter</h2>
          {activeCount > 0 ? (
            <span className="text-xs text-slate-400">
              {activeCount} selected
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500"
          aria-label="Close"
        >
          &#10005;
        </button>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
        {categories.map((cat) => (
          <div key={cat.key}>
            <p className="mb-1 text-xs font-semibold text-slate-600">
              {cat.label}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-r border-lime-300 pr-2">
              {cat.options.map((option) => (
                <label
                  key={`${cat.key}-${option}`}
                  className="flex items-center gap-2 text-xs text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={activeFilters[cat.key]?.has(option) ?? false}
                    onChange={() => onToggle(cat.key, option)}
                    className="h-3 w-3 rounded border border-slate-300 accent-lime-400"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            onClear();
            onClose();
          }}
          className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
        >
          Reset
          <span className="ml-1">&#10005;</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-lime-200 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-lime-300"
        >
          Apply
          <span className="ml-1">&#10003;</span>
        </button>
      </div>
    </DialogShell>
  );
}

export function SortByDialog({
  open,
  onClose,
  options,
  activeKey,
  order,
  onSort,
  onOrder,
}: {
  open: boolean;
  onClose: () => void;
  options: SortOption[];
  activeKey: string | null;
  order: "asc" | "desc";
  onSort: (key: string | null) => void;
  onOrder: (order: "asc" | "desc") => void;
}) {
  return (
    <DialogShell open={open} onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Sort by</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500"
          aria-label="Close"
        >
          &#10005;
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => onSort(activeKey === opt.key ? null : opt.key)}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              activeKey === opt.key
                ? "border-lime-400 bg-lime-100 font-medium text-slate-900"
                : "border-lime-300 bg-white text-slate-700 hover:bg-lime-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Order</p>
        <div className="grid grid-cols-2 gap-2">
          {(["asc", "desc"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onOrder(o);
                onClose();
              }}
              className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                order === o
                  ? "border-lime-400 bg-lime-100 font-medium text-slate-900"
                  : "border-lime-300 bg-white text-slate-700 hover:bg-lime-50"
              }`}
            >
              {o === "asc" ? "Ascending" : "Descending"}
            </button>
          ))}
        </div>
      </div>
    </DialogShell>
  );
}

type ChangeConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  showAvatar?: boolean;
};

export function ChangeConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  showAvatar = false,
}: ChangeConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-66 rounded-2xl bg-white px-4 py-4 shadow-xl mobile:max-w-72 mobile:px-5 mobile:py-5 tablet:max-w-88 tablet:px-6 tablet:py-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500"
        >
          &#10005;
        </button>

        {showAvatar && (
          <div className="absolute -right-1 top-8 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-sky-500 shadow-md tablet:h-10 tablet:w-10">
            <div className="h-7 w-7 rounded-full bg-slate-200" />
          </div>
        )}

        <h3 className="pr-8 text-lg font-bold tracking-tight text-slate-900">{title}</h3>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{description}</p>

        <div className="mt-8 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-lime-300 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-lime-400"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
