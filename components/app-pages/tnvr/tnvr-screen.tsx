import {
  ColorBlock,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import { FilterDropdown } from "@/components/app-pages/shared/filter-dropdown";

export function TnvrScreen() {
  return (
    <PageContent title="TNVR" subtitle="Area report: Brgy. Arete">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <FilterDropdown
            label="Category"
            options={["All", "Neutered/Spayed", "Unneutered", "Unknown Sex"]}
            defaultValue="All"
          />
          <FilterDropdown
            label="Location"
            options={[
              "All Locations",
              "Arete",
              "Covered Court",
              "Leong",
            ]}
            defaultValue="Arete"
          />
        </div>

        <ColorBlock
          tone="emerald"
          label="Card: Neutered/Spayed 200 | Unneutered 149 | Total 349"
          className="h-36"
        />
        <ColorBlock
          tone="sky"
          label="Card: Male 200 | Female 149 | Unknown 13"
          className="h-36"
        />
        <ColorBlock
          tone="amber"
          label="Card: Detailed Breakdown by Sex + TNVR status"
          className="h-44"
        />
      </div>
    </PageContent>
  );
}
