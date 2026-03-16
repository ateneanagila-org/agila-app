import {
  ColorBlock,
  PageContent,
} from "@/components/app-pages/shared/page-frame";

const CAT_ROWS = [
  "Milo - Orange Tabby - Adult",
  "Luna - Tortoiseshell - Young",
  "Arete - White/Ginger - Adult",
];

export function DatabaseListScreen() {
  return (
    <PageContent title="Database" subtitle="Search and filter cat records">
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2">
          <ColorBlock tone="sky" label="Search: cat name" className="h-10" />
          <ColorBlock tone="violet" label="Filters" className="h-10" />
          <ColorBlock tone="violet" label="Sort" className="h-10" />
        </div>

        <div className="space-y-2">
          {CAT_ROWS.map((row) => (
            <div
              key={row}
              className="rounded-lg bg-white p-2 ring-1 ring-slate-200"
            >
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-slate-300" />
                <ColorBlock tone="slate" label={row} className="flex-1" />
                <div className="h-8 w-8 rounded-md bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContent>
  );
}
