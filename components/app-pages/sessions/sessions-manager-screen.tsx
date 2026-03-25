"use client";

import Link from "next/link";
import {
  ImagePlaceholderIcon,
  SearchIcon,
} from "@/components/app-pages/shared/icons";

const FOR_REVIEW = [1, 2, 3];

export function SessionsManagerScreen() {
  return (
    <>
      <div className="flex flex-1 flex-col px-4 py-4 tablet:hidden">
        <div className="flex-1 space-y-4">
          <Link
            href="/sessions"
            className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200"
          >
            <span className="text-sm font-semibold text-slate-900">Current Census Reports</span>
            <span className="text-slate-600">&#8599;</span>
          </Link>

          <div>
            <p className="mb-2 text-sm font-bold text-slate-900">For Review</p>
            <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
              {FOR_REVIEW.map((id, i) => (
                <Link key={id} href="/sessions/approval/validation" className="block">
                  <div className="flex items-start gap-3 p-3 pb-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200">
                      <ImagePlaceholderIcon className="h-6 w-6 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900">Cat Name</span>
                        <span className="text-sm font-medium text-blue-500">&#9794;</span>
                        <span className="ml-auto text-slate-400">&#8250;</span>
                      </div>
                      <p className="text-xs text-slate-500">Orange and White Tabby</p>
                      <p className="text-xs text-slate-500">Adult</p>
                      <p className="mt-1 text-xs text-slate-600">Arete - 02/21/26</p>
                    </div>
                  </div>
                  {i < FOR_REVIEW.length - 1 && <div className="mx-3 border-b border-slate-200" />}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end pb-5 pt-4">
          <Link href="/sessions" className="rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow">
            My Sessions
          </Link>
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-amber-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-slate-900">Sessions</h1>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700">
              Census Report <span className="ml-1">&#128202;</span>
            </button>
            <button type="button" className="rounded-full bg-lime-300 px-4 py-1.5 text-sm text-slate-700">
              Review Sessions <span className="ml-1">&#9711;</span>
            </button>
          </div>
        </div>

        <section className="mt-4 rounded-3xl bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search"
                className="h-9 w-full rounded-full bg-amber-100 px-4 pr-10 text-sm text-slate-800 outline-none"
              />
              <SearchIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
            <button type="button" className="rounded-full bg-amber-100 px-4 py-1.5 text-sm text-slate-700">
              Sort by <span className="ml-1">&#9662;</span>
            </button>
            <Link href="/sessions" className="rounded-full bg-lime-300 px-4 py-1.5 text-sm text-slate-700">
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
        </section>

        <div className="mt-4 space-y-3">
          {FOR_REVIEW.map((id) => (
            <article key={`review-${id}`} className="rounded-3xl bg-slate-50 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-slate-300">
                  <ImagePlaceholderIcon className="h-10 w-10 text-slate-800" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-5xl font-bold text-slate-900">Cat Name</h3>
                    <span className="text-4xl text-blue-500">&#9794;</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {["Intervention", "Color", "Size/Age"].map((chip) => (
                      <span key={`${id}-${chip}`} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-slate-700">
                        {chip}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-900">Last seen: Arete - 02/21/26</p>
                </div>
                <Link href="/sessions/approval/validation" className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700">
                  Review <span className="ml-1">&#9998;</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
