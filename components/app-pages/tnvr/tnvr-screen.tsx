import { PageContent } from "@/components/app-pages/shared/page-frame";
import { FilterDropdown } from "@/components/app-pages/shared/filter-dropdown";
import { LOCATIONS } from "@/components/app-pages/shared/constants";

const TNVR_STATS = [
  { label: "Neutered Male", value: "9" },
  { label: "Spayed Female", value: "7" },
  { label: "Neutered Unknown Sex", value: "3" },
  { label: "Unneutered Male", value: "6" },
  { label: "Unneutered Female", value: "5" },
  { label: "Unneutered Unknown Sex", value: "2" },
];

const TOTALS = [
  { label: "Total Neutered / Spayed", value: "19", bold: false },
  { label: "Total Unneutered", value: "13", bold: false },
  { label: "Overall Total", value: "32", bold: true },
];

export function TnvrScreen() {
  return (
    <PageContent title="TNVR">
      <div className="space-y-3 tablet:space-y-4">

        {/* About */}
        <p className="text-xs leading-relaxed text-slate-500 tablet:text-sm">
          This is a summary of the TNVR statistics of the Catenean population.
          Updates come from AGILA&apos;s cat census sheets and responses from the
          ACCaP Cat Census GForms.
        </p>

        {/* Totals Hero Card */}
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 tablet:rounded-xl">
          <div className="border-b border-slate-100 bg-white px-3 py-2 tablet:px-4 tablet:py-3">
            <p className="text-xs font-semibold text-slate-700 tablet:text-sm">
              Totals
            </p>
          </div>
          <div className="divide-y divide-slate-100 bg-white">
            {TOTALS.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between px-3 py-2.5 tablet:px-4 tablet:py-3"
              >
                <p
                  className={`text-xs tablet:text-sm ${item.bold ? "font-semibold text-slate-800" : "font-medium text-slate-600"}`}
                >
                  {item.label}
                </p>
                <p
                  className={`text-sm tablet:text-base ${item.bold ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Location Dropdown */}
        <FilterDropdown
          label="Location"
          options={LOCATIONS}
          defaultValue="All Locations"
        />

        {/* Location Stats */}
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200 tablet:rounded-xl">
          <div className="border-b border-slate-100 bg-white px-3 py-2 tablet:px-4 tablet:py-3">
            <p className="text-xs font-semibold text-slate-700 tablet:text-sm">
              Location Details
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 tablet:grid-cols-3">
            {TNVR_STATS.map((stat) => (
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
              TNVR Trend
            </p>
          </div>
          <div className="flex h-40 items-center justify-center bg-slate-100 tablet:h-52">
            <p className="text-xs font-medium text-slate-400 tablet:text-sm">
              Graph — coming soon
            </p>
          </div>
        </div>

      </div>
    </PageContent>
  );
}
