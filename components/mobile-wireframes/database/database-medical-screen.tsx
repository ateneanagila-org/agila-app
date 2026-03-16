import { ColorBlock, MobilePageFrame, TopTabs } from "@/components/mobile-wireframes/shared/mobile-page-frame";

export function DatabaseMedicalScreen() {
  return (
    <MobilePageFrame title="Cat Entry Detail" subtitle="Medical records for Arete" activeNav="Database">
      <div className="space-y-3">
        <ColorBlock tone="slate" label="Profile Row: Avatar + Cat Name + Back" className="h-12" />
        <TopTabs active="Medical" />
        <ColorBlock tone="emerald" label="Medical Status: Vaccinated (Core)" className="h-12" />
        <ColorBlock tone="sky" label="Date Field: Last Deworming = 01/05/26" className="h-14" />
        <ColorBlock tone="sky" label="Date Field: Last Vaccine = 11/10/25" className="h-14" />
        <ColorBlock tone="amber" label="Condition Notes: Mild skin irritation resolved" className="h-20" />
      </div>
    </MobilePageFrame>
  );
}
