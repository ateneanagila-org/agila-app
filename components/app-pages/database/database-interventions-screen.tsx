"use client";

import { useState } from "react";
import {
  DetailHeader,
  TopTabs,
} from "@/components/app-pages/shared/page-frame";
import {
  DialogShell,
  DialogHeader,
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
        <DialogHeader title="New Intervention" onClose={() => setShowIntervention(false)} />
        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-700">Title</label>
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400" />
          </div>
          <div>
            <label className="text-sm text-slate-700">Type</label>
            <div className="relative mt-1 rounded-lg border border-slate-200 bg-white">
              <select className="h-10 w-full appearance-none rounded-lg bg-white px-3 pr-10 text-sm text-slate-900">
                <option value="">&mdash;</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">&#9660;</span>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-700">Notes</label>
            <textarea className="mt-1 h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-slate-400" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowIntervention(false)}
          className="w-full rounded-full bg-stone-600 py-3 text-sm font-semibold text-white"
        >
          Save
        </button>
      </DialogShell>
    </PageContent>
  );
}
