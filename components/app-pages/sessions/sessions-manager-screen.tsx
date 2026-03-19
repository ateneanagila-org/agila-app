import Link from "next/link";
import {
  ImagePlaceholderIcon,
  DoubleChevronIcon,
  ExternalLinkIcon,
  ArrowLeftIcon,
} from "@/components/app-pages/shared/icons";

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
    <div className="flex flex-1 flex-col px-4 py-4">
      <div className="flex-1 space-y-4">
        {/* Current Census Reports link */}
        <Link
          href="/sessions"
          className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200"
        >
          <span className="text-sm font-semibold text-slate-900">
            Current Census Reports
          </span>
          <ExternalLinkIcon className="h-4 w-4 text-slate-600" />
        </Link>

        {/* For Review section */}
        <div>
          <p className="mb-2 text-sm font-bold text-slate-900">For Review</p>
          <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
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
                      <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                      {cat.sex === "male" && (
                        <span className="text-sm font-medium text-blue-500">&#9794;</span>
                      )}
                      <DoubleChevronIcon className="ml-auto h-4 w-4 text-slate-400" />
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
          <ArrowLeftIcon className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
