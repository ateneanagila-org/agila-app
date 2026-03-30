"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DetailHeader, PageContent } from "@/components/app-pages/shared/page-frame";
import {
  ChangeConfirmDialog,
  FiltersDialog,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
import {
  ImagePlaceholderIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";

const SIMILAR_CATS = [
  {
    id: "1",
    name: "Cat Name",
    sex: "male",
    location: "Arete",
    date: "02/21/26",
  },
];

export function SessionsApprovalCrossRefScreen() {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  return (
    <>
      <div className="tablet:hidden">
        <PageContent>
          <DetailHeader backHref="/sessions/approval/validation" />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowSaveConfirm(true)}
              className="rounded-full bg-stone-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Approve Instantly
            </button>
            <button
              type="button"
              onClick={() => setShowDiscardConfirm(true)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Discard
            </button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-slate-900">Cross-reference</p>
            <Link href="/sessions/approval/validation" className="flex items-center gap-0.5 text-sm text-slate-600">
              <span className="text-base leading-none">&lsaquo;</span> Prev
            </Link>
          </div>

          <p className="text-xs text-slate-500">Check if this is a duplicate and merge accordingly.</p>

          <div className="flex gap-2">
            <div className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400">Search</div>
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700"
            >
              Filters
            </button>
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700"
            >
              Sort By
            </button>
          </div>

          <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
            {SIMILAR_CATS.map((cat) => (
              <div key={cat.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <ImagePlaceholderIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                      <span className="text-sm font-medium text-blue-500">&#9794;</span>
                    </div>
                    <p className="text-xs text-slate-500">Orange and White Tabby</p>
                    <p className="text-xs text-slate-500">Adult</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-xs text-slate-600">{cat.location} - {cat.date}</p>
                      <button type="button" className="rounded-full bg-stone-600 px-3 py-1 text-xs font-semibold text-white">
                        Merge
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PageContent>
      </div>

      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sessions</h1>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-full bg-white px-4 py-1.5 text-sm text-slate-700 ring-1 ring-slate-100 transition-colors hover:bg-slate-50">
              Census Report <span className="ml-1">&#128202;</span>
            </button>
            <button type="button" className="rounded-full bg-lime-300 px-4 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400">
              Review Sessions <span className="ml-1">&#9711;</span>
            </button>
          </div>
        </div>

        <section className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-slate-50 px-4 pr-10 text-sm text-slate-800 outline-none"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={() => setShowSort(true)}
              className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
            >
              Sort by <span className="ml-1">&#9662;</span>
            </button>
            <Link href="/sessions/approval/validation" className="rounded-full bg-lime-300 px-4 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400">
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-5 ring-1 ring-slate-100">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
              <ImagePlaceholderIcon className="h-9 w-9 text-slate-400" />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold tracking-tight text-slate-900">Cat Name</h3>
                    <span className="text-xl text-blue-500">&#9794;</span>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {["Intervention", "Color", "Size/Age"].map((chip) => (
                      <span key={chip} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                        {chip}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Last seen: Arete &middot; 02/21/26</p>
                </div>

                <Link href="/sessions/approval/validation" className="rounded-full bg-lime-300 px-4 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400">
                  Prev <span className="ml-1">&#8249;</span>
                </Link>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="inline-block border-b border-slate-300 pb-1 text-base font-semibold text-slate-800">Cross Reference</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveConfirm(true)}
                    className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 ring-1 ring-slate-100 transition-colors hover:bg-slate-100"
                  >
                    Approve Instantly <span className="ml-1">&#10003;</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiscardConfirm(true)}
                    className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700 ring-1 ring-slate-100 transition-colors hover:bg-slate-100"
                  >
                    Cancel <span className="ml-1">&#10005;</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-3.5 ring-1 ring-slate-100">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-200 ring-1 ring-slate-300">
                    <ImagePlaceholderIcon className="h-7 w-7 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold tracking-tight text-slate-900">Cat Name</h4>
                      <span className="text-base text-blue-500">&#9794;</span>
                    </div>
                    <div className="mt-1.5 flex gap-1.5">
                      {["Intervention", "Color", "Size/Age"].map((chip) => (
                        <span key={`cross-${chip}`} className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs text-slate-600">
                          {chip}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2.5 text-xs text-slate-600">Last seen: Arete &middot; 02/21/26</p>
                  </div>
                  <button type="button" className="rounded-full bg-lime-300 px-4 py-1.5 text-sm font-medium text-slate-800 transition-colors hover:bg-lime-400">
                    Merge
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <FiltersDialog open={showFilters} onClose={() => setShowFilters(false)} />
      <SortByDialog open={showSort} onClose={() => setShowSort(false)} />

      <ChangeConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard changes?"
        description="These changes will be lost if not saved."
        confirmLabel="Discard Changes"
        showAvatar
        onConfirm={() => {
          setShowDiscardConfirm(false);
          router.push("/sessions/manager");
        }}
      />

      <ChangeConfirmDialog
        open={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        title="Save changes?"
        description="Old data will be overwritten."
        confirmLabel="Save Changes"
        onConfirm={() => setShowSaveConfirm(false)}
      />
    </>
  );
}
