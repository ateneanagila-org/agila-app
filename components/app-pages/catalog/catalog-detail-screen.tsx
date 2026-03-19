import Link from "next/link";

function ImagePlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="m21 15-5-5L5 21"
      />
    </svg>
  );
}

const DETAIL_FIELDS = [
  "Size/Age",
  "Sex",
  "Neutered",
  "Tame",
  "Sick",
  "Injured",
  "Adoptable",
  "Status",
  "Caretaker",
];

const NOTE_FIELDS = [
  "Date Last Seen",
  "Place Last Seen",
  "Date of Kapon",
  "Date of Vaccination",
  "Notes",
  "For Rescues (TNVR)",
  "For Rescues (Vet)",
  "For FA",
];

function FieldRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-xs text-slate-300">—</span>
    </div>
  );
}

export function CatalogDetailScreen() {
  return (
    <div className="space-y-5 px-4 py-4">
      {/* Back */}
      <Link
        href="/catalog"
        className="flex items-center gap-0.5 text-sm text-slate-600"
      >
        <span className="text-base leading-none">‹</span> Back
      </Link>

      {/* Header */}
      <div className="flex gap-3 overflow-hidden rounded-2xl bg-amber-50">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-slate-200">
          <ImagePlaceholderIcon className="h-12 w-12 text-slate-400" />
        </div>
        <div className="flex flex-col justify-center py-3 pr-3">
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-slate-900">Cat Name</span>
            <span className="text-lg font-medium text-blue-500">♂</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">Color</p>
          <p className="text-sm text-slate-500">Adult</p>
        </div>
      </div>

      {/* Details */}
      <div>
        <p className="mb-2 text-sm font-bold text-slate-900">Details</p>
        <div className="overflow-hidden rounded-xl bg-amber-50 px-4">
          {DETAIL_FIELDS.map((field, i) => (
            <div key={field}>
              <FieldRow label={field} />
              {i < DETAIL_FIELDS.length - 1 && (
                <div className="border-b border-amber-100" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="mb-2 text-sm font-bold text-slate-900">Notes</p>
        <div className="overflow-hidden rounded-xl bg-amber-50 px-4">
          {NOTE_FIELDS.map((field, i) => (
            <div key={field}>
              <FieldRow label={field} />
              {i < NOTE_FIELDS.length - 1 && (
                <div className="border-b border-amber-100" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
