import {
  ColorBlock,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import { FilterDropdown } from "@/components/app-pages/shared/filter-dropdown";

export function OverviewScreen() {
  return (
    <PageContent title="Overview" subtitle="Last update: Jan 1, 2026">
      <div className="space-y-3 tablet:space-y-4">
        <ColorBlock
          tone="sky"
          label="Hero Card: Colony Snapshot (67 Cats)"
          className="h-24 tablet:h-32"
        />
        <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-300 tablet:rounded-xl tablet:px-4 tablet:py-3">
          <p className="mb-2 text-xs font-semibold text-slate-700 tablet:text-sm">
            Filters
          </p>
          <div className="grid grid-cols-1 gap-2">
            <FilterDropdown
              label="Location"
              options={[
                "All Locations",
                "Brgy. Arete",
                "Covered Court",
                "Market Zone",
              ]}
              defaultValue="Brgy. Arete"
            />
          </div>
        </div>
        <ColorBlock
          tone="emerald"
          label="Stats Row: Domesticated / Feral / Unknown"
          className="h-14 tablet:h-16"
        />

        <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 tablet:gap-4">
          <ColorBlock
            tone="amber"
            label="Neutered: 200"
            className="h-14 tablet:h-16"
          />
          <ColorBlock
            tone="amber"
            label="Unneutered: 149"
            className="h-14 tablet:h-16"
          />
          <ColorBlock
            tone="rose"
            label="Male: 200"
            className="h-14 tablet:h-16"
          />
          <ColorBlock
            tone="rose"
            label="Female: 149"
            className="h-14 tablet:h-16"
          />
          <ColorBlock
            tone="violet"
            label="Hotspots: 12"
            className="h-14 tablet:h-16"
          />
          <ColorBlock
            tone="violet"
            label="New Entries: 8"
            className="h-14 tablet:h-16"
          />
        </div>

        <ColorBlock
          tone="slate"
          label="Graph Placeholder: Population Trend (Jan to Mar)"
          className="h-40 tablet:h-56"
        />
      </div>
    </PageContent>
  );
}
