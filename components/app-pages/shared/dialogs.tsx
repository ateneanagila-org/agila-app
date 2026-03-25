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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">Filter</h2>
          <span className="text-xs text-slate-400">XXX selected</span>
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

      <div className="max-h-44 space-y-3 overflow-y-auto pr-2">
        {[1, 2, 3].map((section) => (
          <div key={section}>
            <p className="mb-1 text-xs text-slate-600">Category</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-r border-lime-300 pr-2">
              {["Property X", "Property X", "Property X", "Property X"].map(
                (label, index) => (
                  <label
                    key={`${section}-${label}-${index}`}
                    className="flex items-center gap-2 text-xs text-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border border-slate-300 accent-lime-400"
                    />
                    <span>{label}</span>
                  </label>
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
        >
          Reset
          <span className="ml-1">&#10005;</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
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
}: {
  open: boolean;
  onClose: () => void;
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
        {["Name", "Size/Age", "Sex", "Sociability", "Status", "Condition"].map(
          (opt) => (
            <button
              key={opt}
              type="button"
              className="rounded-md border border-lime-300 bg-white px-2 py-1 text-xs text-slate-700"
            >
              {opt}
            </button>
          ),
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Order</p>
        <div className="grid grid-cols-2 gap-2">
          {["Ascending", "Descending"].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={onClose}
              className="rounded-md border border-lime-300 bg-white px-2 py-1 text-xs text-slate-700"
            >
              {opt}
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
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

        <h3 className="pr-8 text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-4 text-sm text-slate-600">{description}</p>

        <div className="mt-8 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            Keep Editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-lime-300 px-3 py-1 text-xs font-medium text-slate-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
