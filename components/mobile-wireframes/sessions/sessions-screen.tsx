import { ColorBlock, MobilePageFrame } from "@/components/mobile-wireframes/shared/mobile-page-frame";

export function SessionsScreen() {
  return (
    <MobilePageFrame title="Census Sessions" subtitle="Recent and priority sessions" activeNav="Sessions">
      <div className="space-y-3">
        <ColorBlock tone="violet" label="Button: Create New Session" className="h-10" />
        <ColorBlock tone="sky" label="Table: Recent Sessions (Location, Status, Date)" className="h-52" />
        <ColorBlock tone="amber" label="Table: Priority Locations + Days Since Last Track" className="h-44" />
        <ColorBlock tone="rose" label="Button: Manager View" className="h-12" />
      </div>
    </MobilePageFrame>
  );
}
