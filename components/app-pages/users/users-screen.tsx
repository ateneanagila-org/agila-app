const USERS = [
  {
    id: "1",
    name: "Niles Cabrera",
    email: "niles.tristan.cabrera@student.ateneo.edu",
    role: "Admin",
  },
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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
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
  );
}

export function UsersScreen() {
  return (
    <div className="px-4 py-4">
      {/* Search + Add */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">
          Search
        </div>
        <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-600 text-white">
          <PlusCircleIcon className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* User list */}
      <div className="space-y-0 overflow-hidden rounded-xl bg-white">
        {USERS.map((user, i) => (
          <div key={user.id}>
            <div className="flex items-start justify-between px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    {user.name}
                  </span>
                  <span className="flex items-center gap-0.5 rounded-full bg-stone-600 px-2.5 py-0.5 text-xs font-medium text-white">
                    {user.role}
                    <ChevronDownIcon className="h-2.5 w-2.5" />
                  </span>
                </div>
                <p className="text-xs text-slate-400">{user.email}</p>
              </div>
              <button className="ml-3 mt-0.5 shrink-0 text-slate-300 hover:text-slate-500">
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {i < USERS.length - 1 && (
              <div className="mx-4 border-b border-slate-100" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
