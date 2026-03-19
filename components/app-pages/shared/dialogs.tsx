import type { ReactNode } from "react";

type DialogShellProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function DialogShell({ open, onClose, children }: DialogShellProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5"
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
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="text-xl leading-none text-slate-400"
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
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <DialogShell open={open} onClose={onClose}>
      <DialogHeader title="Filters" onClose={onClose} />
      <div className="h-32 rounded-lg bg-slate-100" />
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white"
      >
        Apply
      </button>
    </DialogShell>
  );
}

export function SortByDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <DialogShell open={open} onClose={onClose}>
      <DialogHeader title="Sort By" onClose={onClose} />
      <div className="space-y-2">
        {["Ascending", "Descending"].map((opt) => (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
          >
            <input
              type="radio"
              name="sortOrder"
              value={opt}
              className="accent-stone-600"
            />
            <span className="text-sm font-medium text-slate-700">{opt}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white"
      >
        Apply
      </button>
    </DialogShell>
  );
}
