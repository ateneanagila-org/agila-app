import {
  ColorBlock,
  PageContent,
  TopTabs,
} from "@/components/mobile-wireframes/shared/mobile-page-frame";

export function DatabaseGeneralScreen() {
  return (
    <PageContent
      title="Cat Entry Detail"
      subtitle="Cat: Arete | Updated: 02/21/26"
    >
      <div className="space-y-3">
        <ColorBlock
          tone="slate"
          label="Profile Row: Avatar + Cat Name + Back"
          className="h-12"
        />
        <TopTabs active="General" />
        <ColorBlock
          tone="emerald"
          label="Switch: Is active in colony? YES"
          className="h-10"
        />
        <ColorBlock
          tone="sky"
          label="Last seen at: Date / Region / Spot"
          className="h-12"
        />
        <ColorBlock
          tone="amber"
          label="Field: Color Pattern = Orange and White Tabby"
          className="h-12"
        />
        <ColorBlock
          tone="amber"
          label="Field: Age Group = Adult"
          className="h-12"
        />
        <ColorBlock
          tone="amber"
          label="Field: Temperament = Cautious"
          className="h-12"
        />
        <ColorBlock
          tone="rose"
          label="Caretaker: Juan Dela Cruz"
          className="h-10"
        />
        <ColorBlock
          tone="rose"
          label="Notes: Seen near covered court at 7PM"
          className="h-20"
        />
      </div>
    </PageContent>
  );
}
