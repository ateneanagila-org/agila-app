import {
  ColorBlock,
  PageContent,
  TopTabs,
} from "@/components/mobile-wireframes/shared/mobile-page-frame";

export function DatabaseInterventionsScreen() {
  return (
    <PageContent
      title="Cat Entry Detail"
      subtitle="Interventions for Arete"
    >
      <div className="space-y-3">
        <ColorBlock
          tone="slate"
          label="Profile Row: Avatar + Cat Name + Back"
          className="h-12"
        />
        <TopTabs active="Interventions" />
        <ColorBlock
          tone="violet"
          label="Action: Create New Intervention"
          className="h-10"
        />
        <ColorBlock
          tone="emerald"
          label="Intervention #1: Trap Setup - Completed"
          className="h-12"
        />
        <ColorBlock
          tone="emerald"
          label="Intervention #2: Transport to Clinic - Completed"
          className="h-12"
        />
        <ColorBlock
          tone="amber"
          label="Intervention #3: Follow-up Feeding - Scheduled"
          className="h-12"
        />
      </div>
    </PageContent>
  );
}
