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
        className="w-full max-w-sm space-y-4 rounded-2xl bg-brand-green p-5 shadow-xl"
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
      <h2 className="font-heading text-base font-bold tracking-tight text-white">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-dark text-sm text-white transition-opacity hover:opacity-90"
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
          <h2 className="font-heading text-base font-bold text-white">Filters</h2>
          {activeCount > 0 ? (
            <span className="text-xs text-white/70">
              {activeCount} selected
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-dark text-sm text-white"
          aria-label="Close"
        >
          &#10005;
        </button>
      </div>

      <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
        {categories.map((cat) => (
          <div key={cat.key}>
            <p className="mb-1 text-xs font-semibold text-brand-orange">
              {cat.label}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {cat.options.map((option) => (
                <label
                  key={`${cat.key}-${option}`}
                  className="flex items-center gap-2 text-xs text-white/80"
                >
                  <input
                    type="checkbox"
                    checked={activeFilters[cat.key]?.has(option) ?? false}
                    onChange={() => onToggle(cat.key, option)}
                    className="h-3 w-3 rounded border border-white/30 accent-white"
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
          className="rounded-full border border-white/40 bg-transparent px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Reset
          <span className="ml-1">&#10005;</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-brand-orange px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
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
        <h2 className="font-heading text-base font-bold text-white">Sort By</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-dark text-sm text-white"
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
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeKey === opt.key
                ? "border-white/40 bg-white/20 text-white"
                : "border-white/30 bg-white/10 text-white/80 hover:bg-white/15"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-white">Order</p>
        <div className="grid grid-cols-2 gap-2">
          {(["asc", "desc"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onOrder(o);
                onClose();
              }}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-opacity ${
                order === o
                  ? "bg-brand-orange text-white"
                  : "border border-white/30 bg-white/10 text-white/80 hover:opacity-90"
              }`}
            >
              {o === "asc" ? "Ascending" : "Descending"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-brand-orange px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Apply
          <span className="ml-1">&#10003;</span>
        </button>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-brand-cream px-5 py-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-brand-dark text-sm text-white"
        >
          &#10005;
        </button>

        {showAvatar && (
          <div className="absolute -right-1 top-8 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-sky-500 shadow-md">
            <div className="h-7 w-7 rounded-full bg-slate-200" />
          </div>
        )}

        <h3 className="font-heading pr-8 text-lg font-bold tracking-tight text-brand-green">{title}</h3>
        <p className="mt-4 text-sm leading-relaxed text-foreground">{description}</p>

        <div className="mt-8 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-brand-orange bg-transparent px-3.5 py-1.5 text-xs font-medium text-brand-orange transition-opacity hover:opacity-90"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-brand-orange px-3.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
