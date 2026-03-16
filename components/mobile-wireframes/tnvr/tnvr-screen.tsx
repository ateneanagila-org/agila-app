import {
  ColorBlock,
  PageContent,
} from "@/components/mobile-wireframes/shared/mobile-page-frame";

export function TnvrScreen() {
  return (
    <PageContent
      title="TNVR"
      subtitle="Area report: Brgy. Arete"
    >
      <div className="space-y-3">
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
