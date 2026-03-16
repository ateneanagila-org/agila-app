import {
  ColorBlock,
  PageContent,
} from "@/components/mobile-wireframes/shared/mobile-page-frame";

export function SessionsManagerScreen() {
  return (
    <PageContent
      title="Manager View"
      subtitle="Sessions for review"
    >
      <div className="space-y-3">
        <ColorBlock
          tone="amber"
          label="Current Census Reports (External link)"
          className="h-12"
        />
        <ColorBlock
          tone="sky"
          label="For Review: Cat entries awaiting approval"
          className="h-16"
        />
        <ColorBlock
          tone="emerald"
          label="Review Row #1: Arete - Pending verification"
          className="h-14"
        />
        <ColorBlock
          tone="emerald"
          label="Review Row #2: Luna - Needs location update"
          className="h-14"
        />
        <ColorBlock
          tone="rose"
          label="Button: Back to My Sessions"
          className="h-12"
        />
      </div>
    </PageContent>
  );
}
