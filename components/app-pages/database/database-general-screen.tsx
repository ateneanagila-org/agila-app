import {
  DetailHeader,
  TopTabs,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import { ChevronDownIcon } from "@/components/app-pages/shared/icons";

function DropdownField({ label }: { label: string }) {
  return (
    <div>
      <label className="text-sm text-slate-700">{label}</label>
      <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-sm text-slate-400">Value</span>
        <ChevronDownIcon className="h-4 w-4 text-slate-400" />
      </div>
    </div>
  );
}

export function DatabaseGeneralScreen() {
  return (
    <PageContent>
      <DetailHeader />
      <TopTabs active="General" />

      <div className="space-y-4">
        {/* Adoptable/Fosterable toggle */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700">Adoptable/Fosterable</span>
          <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-800">
            <span className="inline-block h-4 w-4 translate-x-6 transform rounded-full bg-white transition" />
          </div>
        </div>

        {/* Last seen at */}
        <div>
          <p className="text-sm text-slate-600">Last seen at:</p>
          <p className="text-sm font-semibold text-slate-900">
            Date / Region / Spot
          </p>
        </div>

        <DropdownField label="Color" />
        <DropdownField label="Size/Age" />
        <DropdownField label="Sex" />
        <DropdownField label="Sociability" />
        <DropdownField label="Status" />

        {/* Caretaker */}
        <div>
          <label className="text-sm text-slate-700">Caretaker</label>
          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none" />
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm text-slate-700">Notes</label>
          <textarea className="mt-1 h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none" />
        </div>
      </div>
    </PageContent>
  );
}
