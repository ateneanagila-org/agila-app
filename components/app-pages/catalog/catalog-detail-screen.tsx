import Link from "next/link";
import { ImagePlaceholderIcon } from "@/components/app-pages/shared/icons";

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
    <div className="flex items-center justify-between py-3">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-xs font-medium tabular-nums text-slate-400">&mdash;</span>
    </div>
  );
}

export function CatalogDetailScreen() {
  return (
    <div className="space-y-5 px-4 py-5">
      {/* Back */}
      <Link
        href="/catalog"
        className="flex items-center gap-0.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
      >
        <span className="text-base leading-none">&lsaquo;</span> Back
      </Link>

      {/* Header */}
      <div className="flex gap-3 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <ImagePlaceholderIcon className="h-11 w-11 text-slate-400" />
        </div>
        <div className="flex flex-col justify-center py-3 pr-3">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tracking-tight text-slate-900">Cat Name</span>
            <span className="text-base text-blue-500">&#9794;</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Color</p>
          <p className="text-xs text-slate-500">Adult</p>
        </div>
      </div>

      {/* Details */}
      <div>
        <p className="mb-2.5 text-sm font-bold tracking-tight text-slate-900">Details</p>
        <div className="overflow-hidden rounded-xl bg-white px-4 ring-1 ring-slate-200">
          {DETAIL_FIELDS.map((field, i) => (
            <div key={field}>
              <FieldRow label={field} />
              {i < DETAIL_FIELDS.length - 1 && (
                <div className="border-b border-slate-50" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <p className="mb-2.5 text-sm font-bold tracking-tight text-slate-900">Notes</p>
        <div className="overflow-hidden rounded-xl bg-white px-4 ring-1 ring-slate-200">
          {NOTE_FIELDS.map((field, i) => (
            <div key={field}>
              <FieldRow label={field} />
              {i < NOTE_FIELDS.length - 1 && (
                <div className="border-b border-slate-50" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
