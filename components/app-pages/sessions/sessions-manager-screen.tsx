import Link from "next/link";

function ImagePlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="m21 15-5-5L5 21"
      />
    </svg>
  );
}

const FOR_REVIEW = [
  {
    id: "1",
    name: "Cat Name",
    sex: "male",
    breed: "Orange and White Tabby",
    age: "Adult",
    location: "Arete",
    date: "02/21/26",
  },
];

export function SessionsManagerScreen() {
  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col px-4 py-4">
      <div className="flex-1 space-y-4">
        {/* Current Census Reports link */}
        <Link
          href="#"
          className="flex w-full items-center justify-between rounded-2xl bg-amber-50 px-4 py-3"
        >
          <span className="text-sm font-semibold text-slate-900">
            Current Census Reports
          </span>
          <svg
            className="h-4 w-4 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </Link>

        {/* For Review section */}
        <div>
          <p className="mb-2 text-sm font-bold text-slate-900">For Review</p>
          <div className="overflow-hidden rounded-lg bg-white">
            {FOR_REVIEW.map((cat, i) => (
              <Link
                key={cat.id}
                href="/sessions/approval/validation"
                className="block"
              >
                <div className="flex items-start gap-3 p-3 pb-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <ImagePlaceholderIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900">
                        {cat.name}
                      </span>
                      {cat.sex === "male" && (
                        <span className="text-sm font-medium text-blue-500">
                          ♂
                        </span>
                      )}
                      <svg
                        className="ml-auto h-4 w-4 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 5l7 7-7 7M5 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                    <p className="text-xs text-slate-500">{cat.breed}</p>
                    <p className="text-xs text-slate-500">{cat.age}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {cat.location} - {cat.date}
                    </p>
                  </div>
                </div>
                {i < FOR_REVIEW.length - 1 && (
                  <div className="mx-3 border-b border-slate-200" />
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* My Sessions button */}
      <div className="flex justify-end pb-5 pt-4">
        <Link
          href="/sessions"
          className="flex items-center gap-2 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow"
        >
          My Sessions
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
