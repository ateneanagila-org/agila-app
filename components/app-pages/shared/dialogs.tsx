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
          className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-sm text-slate-500"
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
            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-slate-700"
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
