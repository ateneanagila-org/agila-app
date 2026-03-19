"use client";

import { useState } from "react";
import { CatEntryForm } from "@/components/app-pages/shared/cat-entry-form";

function ImagePlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 15-5-5L5 21" />
    </svg>
  );
}

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 8v8M8 12h8" />
    </svg>
  );
}

const CAT_ENTRIES = [
  { id: "1", name: "Cat Name", sex: "male", breed: "Orange and White Tabby", age: "Adult" },
  { id: "2", name: "Cat Name", sex: "male", breed: "Orange and White Tabby", age: "Adult" },
  { id: "3", name: "Cat Name", sex: "male", breed: "Orange and White Tabby", age: "Adult" },
  { id: "4", name: "Cat Name", sex: "male", breed: "Orange and White Tabby", age: "Adult" },
];

const DROPDOWN_OPTIONS = ["Details", "Finish", "Save"];

export function SessionsCreateScreen() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
      <div className="flex-1 space-y-0 px-4 py-4">
        {/* Location card */}
        <div className="relative mb-4 rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Location</p>
              <p className="text-xs text-slate-500">Census Number</p>
            </div>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="px-1 text-xs tracking-widest text-slate-500"
            >
              •••
            </button>
          </div>

          {menuOpen && (
            <div className="absolute right-4 top-10 z-10 min-w-[120px] rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
              {DROPDOWN_OPTIONS.map((opt) => (
                <button
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

        {/* Cat entries list */}
        <div className="rounded-lg bg-white">
          {CAT_ENTRIES.map((cat, i) => (
            <div key={cat.id}>
              <div className="flex items-start gap-3 px-3 py-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-200">
                  <ImagePlaceholderIcon className="h-6 w-6 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                    {cat.sex === "male" && (
                      <span className="text-sm font-medium text-blue-500">♂</span>
                    )}
                    <span className="ml-auto text-xs tracking-widest text-slate-400">•••</span>
                  </div>
                  <p className="text-xs text-slate-500">{cat.breed}</p>
                  <p className="text-xs text-slate-500">{cat.age}</p>
                </div>
              </div>
              {i < CAT_ENTRIES.length - 1 && <div className="mx-3 border-b border-slate-200" />}
            </div>
          ))}
        </div>
      </div>

      {/* Add Entry button */}
      <div className="flex justify-end px-4 pb-5">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow"
        >
          Add Entry
          <PlusCircleIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Add Entry Dialog */}
      {showAdd && <CatEntryForm onClose={() => setShowAdd(false)} />}
    </div>
  );
}
