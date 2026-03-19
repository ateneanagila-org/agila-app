import {
  DetailHeader,
  TopTabs,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import { ChevronDownIcon } from "@/components/app-pages/shared/icons";

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
    <PageContent>
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
    </PageContent>
  );
}
