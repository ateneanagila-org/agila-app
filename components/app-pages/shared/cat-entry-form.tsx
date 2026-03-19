"use client";

function ImagePlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 15-5-5L5 21" />
    </svg>
  );
}

function DropdownField({ label }: { label: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <div className="relative mt-1 rounded-lg border border-slate-200 bg-white">
        <select className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900">
          <option value="">—</option>
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▼</span>
      </div>
    </div>
  );
}

function TextField({ label }: { label: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400" />
    </div>
  );
}

export function CatEntryForm({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-7xl rounded-t-2xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: avatar + name + close */}
        <div className="flex items-center gap-3 px-5 pb-3 pt-5">
          <div className="relative h-12 w-12 shrink-0">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-200">
              <ImagePlaceholderIcon className="h-6 w-6 text-slate-400" />
            </div>
            <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-slate-500">
              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
          </div>
          <p className="flex-1 text-base font-bold text-slate-900">Cat Name</p>
          <button onClick={onClose} className="text-xl leading-none text-slate-400">
            ✕
          </button>
        </div>

        {/* Scrollable fields */}
        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-5 pb-2">
          <DropdownField label="Color" />
          <DropdownField label="Size / Age" />
          <DropdownField label="Sex" />
          <DropdownField label="Sociability" />
          <DropdownField label="Status" />
          <DropdownField label="Condition" />
          <TextField label="Spot Last Seen" />
          <TextField label="Caretaker" />
          <div>
            <label className="text-xs font-medium text-slate-500">Notes</label>
            <textarea className="mt-1 h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400" />
          </div>
        </div>

        {/* Save */}
        <div className="px-5 pb-5 pt-3">
          <button className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
