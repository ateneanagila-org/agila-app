import Link from "next/link";

const RECENT_SESSIONS: { no: number; location: string; status: string }[] = [];

const PRIORITY_LOCATIONS = [
  { name: "Covered Courts", days: 198 },
  { name: "Leong", days: 100 },
  { name: "Arete", days: 67 },
];

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function SessionsScreen() {
  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
      <div className="flex-1 space-y-3 px-4 py-4">
        {/* Recent Sessions card */}
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">Recent Sessions</p>
            <Link
              href="/sessions/create"
              className="flex items-center gap-1.5 rounded-full bg-stone-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Create New
              <PlusCircleIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 px-1">
            <span className="text-xs text-slate-500">No.</span>
            <span className="text-xs text-slate-500">Location</span>
            <span className="text-xs text-slate-500">Status</span>
          </div>

          {/* Table rows */}
          <div className="min-h-32">
            {RECENT_SESSIONS.map((s) => (
              <div
                key={s.no}
                className="grid grid-cols-[auto_1fr_auto] gap-x-4 border-b border-slate-100 px-1 py-1.5"
              >
                <span className="text-xs text-slate-700">{s.no}</span>
                <span className="text-xs text-slate-700">{s.location}</span>
                <span className="text-xs text-slate-700">{s.status}</span>
              </div>
            ))}
          </div>

          <Link href="#" className="block text-xs font-medium text-slate-500">
            See all
          </Link>
        </div>

        {/* Priority Locations card */}
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200 space-y-3">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-slate-900">
              Priority Locations
            </p>
            <svg
              className="h-4 w-4 text-slate-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>

          <div className="flex justify-between px-1">
            <span className="text-xs text-slate-500">Name</span>
            <span className="text-xs text-slate-500">
              Days Since Last Tracked
            </span>
          </div>

          <div className="space-y-2">
            {PRIORITY_LOCATIONS.map((loc) => (
              <div key={loc.name} className="flex justify-between px-1">
                <span className="text-xs font-semibold text-slate-900">
                  {loc.name}
                </span>
                <span className="text-xs font-semibold text-slate-900">
                  {loc.days}
                </span>
              </div>
            ))}
          </div>

          <Link href="#" className="text-xs font-medium text-slate-500">
            See all
          </Link>
        </div>
      </div>

      {/* Manager View floating button — bottom left */}
      <div className="flex justify-end px-4 pb-5">
        <Link
          href="/sessions/manager"
          className="flex items-center gap-1.5 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow"
        >
          Manager View
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
