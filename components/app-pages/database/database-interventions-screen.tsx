import {
  DetailHeader,
  TopTabs,
} from "@/components/app-pages/shared/page-frame";

const INTERVENTIONS = [{ id: 1 }];

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 8v8M8 12h8" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

export function DatabaseInterventionsScreen() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4">
      <DetailHeader />
      <TopTabs active="Interventions" />

      {/* Action row */}
      <div className="flex gap-2">
        <button className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700">
          Sort By
        </button>
        <button className="flex items-center gap-1.5 rounded-full bg-stone-600 px-4 py-2 text-xs font-medium text-white">
          Create New
          <PlusCircleIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Intervention cards */}
      {INTERVENTIONS.map((item) => (
        <div key={item.id}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">
              Intervention No. __
            </span>
            <button className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
              Status
              <ChevronDownIcon className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Requested At MM/DD/YY</p>
          <p className="text-xs text-slate-500">Notes:</p>
          <div className="mt-3 border-b border-slate-200" />
        </div>
      ))}
    </div>
  );
}
