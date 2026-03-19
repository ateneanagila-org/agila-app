"use client";

import { useState } from "react";
import {
  DetailHeader,
  TopTabs,
} from "@/components/app-pages/shared/page-frame";

const INTERVENTIONS = [{ id: 1 }];

function PlusCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 8v8M8 12h8" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function DatabaseInterventionsScreen() {
  const [showSort, setShowSort] = useState(false);
  const [showIntervention, setShowIntervention] = useState(false);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-4">
      <DetailHeader />
      <TopTabs active="Interventions" />

      {/* Action row */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowSort(true)}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
        >
          Sort By
        </button>
        <button
          onClick={() => setShowIntervention(true)}
          className="flex items-center gap-1.5 rounded-full bg-stone-600 px-4 py-2 text-xs font-medium text-white"
        >
          Create New
          <PlusCircleIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Intervention cards */}
      {INTERVENTIONS.map((item) => (
        <div key={item.id}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">Intervention No. __</span>
            <button className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
              Status
              <ChevronDownIcon className="h-3 w-3" />
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Requested At MM/DD/YY</p>
          <p className="text-xs text-slate-500">Notes:</p>
          <div className="mt-3 border-b border-slate-200" />
        </div>
      ))}

      {/* Sort By Dialog */}
      {showSort && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
          onClick={() => setShowSort(false)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Sort By</h2>
              <button onClick={() => setShowSort(false)} className="text-xl leading-none text-slate-400">
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {["Ascending", "Descending"].map((opt) => (
                <label
                  key={opt}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                >
                  <input type="radio" name="sortOrder" value={opt} className="accent-stone-600" />
                  <span className="text-sm font-medium text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
            <button
              onClick={() => setShowSort(false)}
              className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* New Intervention Dialog */}
      {showIntervention && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
          onClick={() => setShowIntervention(false)}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">New Intervention</h2>
              <button onClick={() => setShowIntervention(false)} className="text-xl leading-none text-slate-400">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-700">Title</label>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400" />
              </div>
              <div>
                <label className="text-sm text-slate-700">Type</label>
                <div className="relative mt-1 rounded-lg border border-slate-200 bg-white">
                  <select className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900">
                    <option value="">—</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">▼</span>
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-700">Notes</label>
                <textarea className="mt-1 h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400" />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowIntervention(false)}
                className="rounded-full bg-stone-600 px-6 py-2.5 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
