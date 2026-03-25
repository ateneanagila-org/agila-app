"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ImagePlaceholderIcon,
  PlusCircleIcon,
  ChevronDownIcon,
} from "@/components/app-pages/shared/icons";

const CAT_ENTRIES = [
  { id: "1", name: "Cat Name", sex: "male" },
  { id: "2", name: "Cat Name", sex: "male" },
];

function DesktopDropdownField({ label }: { label: string }) {
  return (
    <div>
      <label className="text-sm text-slate-700">{label}</label>
      <div className="mt-1 flex h-10 items-center justify-between rounded-xl border border-lime-300 bg-white px-4">
        <span className="text-sm text-slate-500">&nbsp;</span>
        <ChevronDownIcon className="h-4 w-4 text-slate-500" />
      </div>
    </div>
  );
}

export function SessionsCreateScreen() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 space-y-4 px-4 py-4">
          <div className="relative rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Location</p>
                <p className="text-xs text-slate-500">Census Number</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="px-1 text-xs tracking-widest text-slate-500"
                aria-label="More options"
              >
                &bull;&bull;&bull;
              </button>
            </div>

            {menuOpen && (
              <div className="absolute right-4 top-10 z-10 min-w-30 rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
                {["Details", "Finish", "Save"].map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => setMenuOpen(false)}
                    className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
            {CAT_ENTRIES.map((cat, i) => (
              <div key={cat.id}>
                <div className="flex items-start gap-3 px-3 py-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <ImagePlaceholderIcon className="h-6 w-6 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                      {cat.sex === "male" && <span className="text-sm font-medium text-blue-500">&#9794;</span>}
                      <span className="ml-auto text-xs tracking-widest text-slate-400">&bull;&bull;&bull;</span>
                    </div>
                    <p className="text-xs text-slate-500">Orange and White Tabby</p>
                    <p className="text-xs text-slate-500">Adult</p>
                  </div>
                </div>
                {i < CAT_ENTRIES.length - 1 && <div className="mx-3 border-b border-slate-200" />}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end px-4 pb-5">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-2 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow"
          >
            Add Entry
            <PlusCircleIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-amber-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-slate-900">Sessions</h1>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700">
              Census Report <span className="ml-1">&#128202;</span>
            </button>
            <button type="button" className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700">
              Review Sessions <span className="ml-1">&#9711;</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <label className="flex w-full max-w-72 items-center gap-2 text-sm font-semibold text-slate-900">
            <span>Location:</span>
            <div className="relative flex-1">
              <select className="h-10 w-full appearance-none rounded-full bg-slate-50 px-4 pr-9 text-sm text-slate-700">
                <option>Arete</option>
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </label>

          <Link href="/sessions" className="rounded-full bg-lime-300 px-5 py-1.5 text-sm text-slate-800">
            Back <span className="ml-1">&#8249;</span>
          </Link>
        </div>

        <section className="mt-4 rounded-3xl bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-5xl font-bold text-slate-900">Census No. XXX <span className="text-2xl">&#128247;</span></h2>
            {!showAddForm && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="rounded-full bg-amber-100 px-4 py-1.5 text-sm text-slate-700"
                >
                  Add entry <span className="ml-1">+</span>
                </button>
                <button type="button" className="rounded-full bg-lime-300 px-4 py-1.5 text-sm text-slate-800">
                  Submit <span className="ml-1">&#8250;</span>
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="mt-3 rounded-3xl bg-slate-50 p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-slate-300">
              <ImagePlaceholderIcon className="h-10 w-10 text-slate-800" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-5xl font-bold text-slate-900">Cat Name</h3>
                    <span className="text-4xl text-blue-500">&#9794;</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["Intervention", "Color", "Size/Age"].map((chip) => (
                      <span key={chip} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-slate-700">
                        {chip}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-900">Last seen: Arete - 02/21/26</p>
                </div>

                {!showAddForm && (
                  <button type="button" className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700">
                    Edit <span className="ml-1">&#9998;</span>
                  </button>
                )}

                {showAddForm && (
                  <div className="flex items-center gap-2">
                    <button type="button" className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700">
                      Save <span className="ml-1">&#10003;</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700"
                    >
                      Cancel <span className="ml-1">&#10005;</span>
                    </button>
                  </div>
                )}
              </div>

              {showAddForm && (
                <div className="mt-6">
                  <p className="inline-block border-b border-slate-700 pb-1 text-4xl text-slate-900">For Catalog</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <DesktopDropdownField label="Color" />
                    <DesktopDropdownField label="Size/Age" />
                    <DesktopDropdownField label="Sex" />
                    <DesktopDropdownField label="Sociability" />
                    <DesktopDropdownField label="Status" />
                    <DesktopDropdownField label="Caretaker" />
                  </div>
                  <div className="mt-3">
                    <label className="text-sm text-slate-700">Notes</label>
                    <textarea className="mt-1 h-24 w-full resize-none rounded-xl border border-lime-300 px-3 py-2 text-sm outline-none" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {!showAddForm && (
          <div className="mt-3 space-y-3">
            {CAT_ENTRIES.map((cat) => (
              <article key={`entry-${cat.id}`} className="rounded-3xl bg-slate-50 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-slate-300">
                    <ImagePlaceholderIcon className="h-10 w-10 text-slate-800" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-5xl font-bold text-slate-900">{cat.name}</h3>
                      <span className="text-4xl text-blue-500">&#9794;</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      {["Intervention", "Color", "Size/Age"].map((chip) => (
                        <span key={`${cat.id}-${chip}`} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-slate-700">
                          {chip}
                        </span>
                      ))}
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-900">Last seen: Arete - 02/21/26</p>
                  </div>
                  <button type="button" className="rounded-full bg-amber-100 px-4 py-1 text-sm text-slate-700">
                    Edit <span className="ml-1">&#9998;</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
