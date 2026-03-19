import {
  DetailHeader,
  TopTabs,
} from "@/components/app-pages/shared/page-frame";

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
        strokeWidth="2"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function DateInputRow() {
  return (
    <div className="mt-1 flex gap-2">
      <input
        placeholder="DD"
        className="w-16 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm outline-none"
      />
      <input
        placeholder="MM"
        className="w-16 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm outline-none"
      />
      <input
        placeholder="YYYY"
        className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm outline-none"
      />
    </div>
  );
}

export function DatabaseMedicalScreen() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4">
      <DetailHeader />
      <TopTabs active="Medical" />

      <div className="space-y-4">
        {/* Condition */}
        <div>
          <label className="text-sm text-slate-700">Condition</label>
          <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <span className="text-sm text-slate-400">Value</span>
            <ChevronDownIcon className="h-4 w-4 text-slate-400" />
          </div>
        </div>

        {/* Neuter Date */}
        <div>
          <label className="text-sm text-slate-700">Neuter Date</label>
          <DateInputRow />
        </div>

        {/* Vaccination Date */}
        <div>
          <label className="text-sm text-slate-700">Vaccination Date</label>
          <DateInputRow />
        </div>
      </div>
    </div>
  );
}
