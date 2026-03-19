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

const DETAILS_LEFT = ["Size/Age", "Sex", "Neutered", "Tame", "Sick"];
const DETAILS_RIGHT = ["Injured", "Adoptable", "Status", "Caretaker"];
const NOTES_LEFT = [
  "Date Last Seen",
  "Place Last Seen",
  "Date of Kapon",
  "Date of Vaccination",
];
const NOTES_RIGHT = [
  "Notes",
  "For Rescues (TNVR)",
  "For Rescues (Vet)",
  "For FA",
];

export function CatalogDetailScreen() {
  return (
    <div className="space-y-4 px-4 py-4">
      {/* Back */}
      <Link href="/catalog" className="text-sm text-slate-600">
        Back
      </Link>

      {/* Header card */}
      <div className="flex items-stretch gap-3 overflow-hidden rounded-2xl bg-amber-50">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center bg-slate-200">
          <ImagePlaceholderIcon className="h-12 w-12 text-slate-400" />
        </div>
        <div className="flex flex-col justify-center py-2 pr-3">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-slate-900">Cat Name</span>
            <span className="text-base font-medium text-blue-500">♂</span>
          </div>
          <p className="text-sm text-slate-600">Color</p>
          <p className="text-sm text-slate-600">Adult</p>
        </div>
      </div>

      {/* Details section */}
      <div>
        <p className="mb-2 text-sm font-bold text-slate-900">Details</p>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-amber-50 p-4">
          <div className="space-y-1.5">
            {DETAILS_LEFT.map((item) => (
              <p key={item} className="text-xs text-slate-700">
                {item}
              </p>
            ))}
          </div>
          <div className="space-y-1.5">
            {DETAILS_RIGHT.map((item) => (
              <p key={item} className="text-xs text-slate-700">
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Notes section */}
      <div>
        <p className="mb-2 text-sm font-bold text-slate-900">Notes</p>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-amber-50 p-4">
          <div className="space-y-1.5">
            {NOTES_LEFT.map((item) => (
              <p key={item} className="text-xs text-slate-700">
                {item}
              </p>
            ))}
          </div>
          <div className="space-y-1.5">
            {NOTES_RIGHT.map((item) => (
              <p key={item} className="text-xs text-slate-700">
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
