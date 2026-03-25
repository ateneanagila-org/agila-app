"use client";

import { useState } from "react";
import {
  DetailHeader,
  TopTabs,
} from "@/components/app-pages/shared/page-frame";
import {
  DialogShell,
  SortByDialog,
} from "@/components/app-pages/shared/dialogs";
import { PlusCircleIcon, ChevronDownIcon } from "@/components/app-pages/shared/icons";
import { PageContent } from "@/components/app-pages/shared/page-frame";

const INTERVENTIONS = [{ id: 1 }];

export function DatabaseInterventionsScreen() {
  const [showSort, setShowSort] = useState(false);
  const [showIntervention, setShowIntervention] = useState(false);

  return (
    <PageContent>
      <DetailHeader />
      <TopTabs active="Interventions" />

      {/* Action row */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowSort(true)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700"
        >
          Sort By
        </button>
        <button
          type="button"
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
            <span className="flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
              Status
              <ChevronDownIcon className="h-3 w-3" />
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Requested At MM/DD/YY</p>
          <p className="text-xs text-slate-500">Notes:</p>
          <div className="mt-3 border-b border-slate-200" />
        </div>
      ))}

      <SortByDialog open={showSort} onClose={() => setShowSort(false)} />

      {/* New Intervention Dialog */}
      <DialogShell open={showIntervention} onClose={() => setShowIntervention(false)}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Create Intervention</h2>
          <button
            type="button"
            onClick={() => setShowIntervention(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-sm text-slate-500"
            aria-label="Close"
          >
            &#10005;
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-700">Title</label>
            <input className="mt-1 h-8 w-full rounded-md border border-lime-300 px-3 text-sm outline-none focus:ring-1 focus:ring-lime-300" />
          </div>
          <div>
            <label className="text-xs text-slate-700">Type</label>
            <div className="relative mt-1 rounded-md border border-lime-300 bg-white">
              <select className="h-8 w-full appearance-none rounded-md bg-white px-3 pr-10 text-sm text-slate-900">
                <option value="">&mdash;</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">&#9660;</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-700">Notes</label>
            <textarea className="mt-1 h-8 w-full resize-none rounded-md border border-lime-300 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-lime-300" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowIntervention(false)}
            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            Cancel
            <span className="ml-1">&#10005;</span>
          </button>
          <button
            type="button"
            onClick={() => setShowIntervention(false)}
            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-slate-700"
          >
            Create
            <span className="ml-1">&#10003;</span>
          </button>
        </div>
      </DialogShell>
    </PageContent>
  );
}
