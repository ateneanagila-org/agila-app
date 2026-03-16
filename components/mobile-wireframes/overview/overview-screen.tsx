import {
  ColorBlock,
  PageContent,
} from "@/components/mobile-wireframes/shared/mobile-page-frame";

export function OverviewScreen() {
  return (
    <PageContent
      title="Overview"
      subtitle="Last update: Jan 1, 2026"
    >
      <div className="space-y-3">
        <ColorBlock
          tone="sky"
          label="Hero Card: Colony Snapshot (67 Cats)"
          className="h-24"
        />
        <ColorBlock
          tone="emerald"
          label="Stats Row: Domesticated / Feral / Unknown"
          className="h-14"
        />

        <div className="grid grid-cols-2 gap-3">
          <ColorBlock tone="amber" label="Neutered: 200" className="h-14" />
          <ColorBlock tone="amber" label="Unneutered: 149" className="h-14" />
          <ColorBlock tone="rose" label="Male: 200" className="h-14" />
          <ColorBlock tone="rose" label="Female: 149" className="h-14" />
          <ColorBlock tone="violet" label="Hotspots: 12" className="h-14" />
          <ColorBlock tone="violet" label="New Entries: 8" className="h-14" />
        </div>

        <ColorBlock
          tone="slate"
          label="Graph Placeholder: Population Trend (Jan to Mar)"
          className="h-40"
        />
      </div>
    </PageContent>
  );
}
