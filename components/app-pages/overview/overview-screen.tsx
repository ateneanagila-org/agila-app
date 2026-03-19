import { PageContent } from "@/components/app-pages/shared/page-frame";
import { FilterDropdown } from "@/components/app-pages/shared/filter-dropdown";
import { LOCATIONS } from "@/components/app-pages/shared/constants";

const LOCATION_STATS = [
  { label: "Cat Count", value: "24" },
  { label: "Neutered", value: "14" },
  { label: "Unneutered", value: "10" },
  { label: "% TNVR", value: "58%" },
  { label: "Domesticated", value: "8" },
  { label: "Tame", value: "10" },
  { label: "Feral", value: "6" },
  { label: "Sick", value: "2" },
  { label: "Injured", value: "1" },
  { label: "Adoptable", value: "3" },
  { label: "Unnamed", value: "7" },
];

const ADDITIONAL_STATS = [
  { label: "# of Fostered", value: "5", bold: false },
  { label: "# of Adopted", value: "12", bold: false },
  { label: "# of MIA", value: "3", bold: false },
  { label: "# of Deceased", value: "8", bold: false },
  { label: "TOTAL", value: "28", bold: true },
  { label: "OVERALL TOTAL", value: "123", bold: true },
];

export function OverviewScreen() {
  return (
    <PageContent>
      <div className="space-y-3 tablet:space-y-4">

        {/* Page Header */}
        <div>
          <h1 className="text-base font-bold text-slate-900 tablet:text-lg">Overview</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 tablet:text-sm">
            This is a summary of the cat population in the Ateneo de Manila
            University. Updates come from AGILA&apos;s cat census sheets.
          </p>
        </div>

        {/* Dates */}
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-slate-500">
            Last PAW Update:{" "}
            <span className="font-semibold text-slate-700">Jan 1, 2026</span>
          </p>
          <p className="text-xs text-slate-500">
            Last Update:{" "}
            <span className="font-semibold text-slate-700">Jan 1, 2026</span>
          </p>
        </div>

        {/* Hero Card */}
        <div className="rounded-lg bg-white px-4 py-3 ring-1 ring-slate-200 tablet:rounded-xl tablet:px-5 tablet:py-4">
          <p className="mb-3 text-xs font-semibold text-slate-500 tablet:text-sm">
            Colony Snapshot
          </p>
          <div className="flex items-center justify-around">
            <div className="text-center">
              <p className="text-4xl font-bold text-slate-900">123</p>
              <p className="mt-1 text-xs font-medium text-slate-500 tablet:text-sm">
                Total Cats
              </p>
            </div>
            <div className="h-12 w-px bg-slate-200" />
            <div className="text-center">
              <p className="text-4xl font-bold text-slate-900">58%</p>
              <p className="mt-1 text-xs font-medium text-slate-500 tablet:text-sm">
                TNVR Score
              </p>
            </div>
          </div>
        </div>

        {/* Location Dropdown */}
        <FilterDropdown
          label="Location"
          options={LOCATIONS}
          defaultValue="All Locations"
        />

        {/* Location Details */}
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 tablet:rounded-xl">
          <div className="border-b border-slate-100 bg-white px-3 py-2 tablet:px-4 tablet:py-3">
            <p className="text-xs font-semibold text-slate-700 tablet:text-sm">
              Location Details
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 tablet:grid-cols-3">
            {LOCATION_STATS.map((stat) => (
              <div
                key={stat.label}
                className="bg-white px-3 py-2.5 tablet:px-4 tablet:py-3"
              >
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="mt-0.5 text-base font-bold text-slate-900 tablet:text-lg">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Graph Placeholder */}
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 tablet:rounded-xl">
          <div className="border-b border-slate-200 bg-white px-3 py-2 tablet:px-4 tablet:py-3">
            <p className="text-xs font-semibold text-slate-700 tablet:text-sm">
              Population Trend
            </p>
          </div>
          <div className="flex h-40 items-center justify-center bg-slate-100 tablet:h-52">
            <p className="text-xs font-medium text-slate-400 tablet:text-sm">
              Graph — coming soon
            </p>
          </div>
        </div>

        {/* Not Included in Total Count */}
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 tablet:rounded-xl">
          <div className="border-b border-slate-100 bg-white px-3 py-2 tablet:px-4 tablet:py-3">
            <p className="text-xs font-semibold text-slate-700 tablet:text-sm">
              Not Included in Total Cat Count
            </p>
          </div>
          <div className="divide-y divide-slate-100 bg-white">
            {ADDITIONAL_STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between px-3 py-2.5 tablet:px-4 tablet:py-3"
              >
                <p
                  className={`text-xs tablet:text-sm ${stat.bold ? "font-semibold text-slate-800" : "font-medium text-slate-600"}`}
                >
                  {stat.label}
                </p>
                <p
                  className={`text-sm tablet:text-base ${stat.bold ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </PageContent>
  );
}
