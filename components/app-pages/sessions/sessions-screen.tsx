"use client";

import Link from "next/link";
import {
  PlusCircleIcon,
  ChevronDownIcon,
  MenuIcon,
} from "@/components/app-pages/shared/icons";

const RECENT_SESSIONS: {
  no: string;
  date: string;
  location: string;
  status: string;
}[] = [
  { no: "XXX", date: "MM/DD/YY", location: "Bldg", status: "Continue" },
  { no: "XXX", date: "MM/DD/YY", location: "Bldg", status: "Submitted" },
  { no: "XXX", date: "MM/DD/YY", location: "Bldg", status: "Reviewed" },
  { no: "XXX", date: "MM/DD/YY", location: "Bldg", status: "Reviewed" },
  { no: "XXX", date: "MM/DD/YY", location: "Bldg", status: "Reviewed" },
];

const PRIORITY_LOCATIONS = ["Bldg A", "Bldg B", "Bldg C", "Bldg D", "Bldg E"];

const SUMMARY = [
  { label: "Reviewed", value: "XX" },
  { label: "Submitted", value: "XX" },
  { label: "Unfinished", value: "XX" },
  { label: "For Review", value: "XX" },
];

export function SessionsScreen() {
  return (
    <>
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 space-y-3 px-4 py-4">
          <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">
                Recent Sessions
              </p>
              <Link
                href="/sessions/create"
                className="flex items-center gap-1.5 rounded-full bg-stone-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Create New
                <PlusCircleIcon className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 px-1">
              <span className="text-xs text-slate-500">No.</span>
              <span className="text-xs text-slate-500">Location</span>
              <span className="text-xs text-slate-500">Status</span>
            </div>

            <div className="min-h-32" />
            <span className="block text-xs font-medium text-slate-500">
              See all
            </span>
          </div>

          <div className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-slate-900">
                Priority Locations
              </p>
              <ChevronDownIcon className="h-4 w-4 text-slate-700" />
            </div>

            <div className="flex justify-between px-1">
              <span className="text-xs text-slate-500">Name</span>
              <span className="text-xs text-slate-500">
                Days Since Last Tracked
              </span>
            </div>

            <div className="space-y-2">
              {PRIORITY_LOCATIONS.map((loc) => (
                <div key={loc} className="flex justify-between px-1">
                  <span className="text-xs font-semibold text-slate-900">
                    {loc}
                  </span>
                  <span className="text-xs font-semibold text-slate-900">
                    Bldg
                  </span>
                </div>
              ))}
            </div>

            <span className="text-xs font-medium text-slate-500">See all</span>
          </div>
        </div>

        <div className="flex justify-end px-4 pb-5">
          <Link
            href="/sessions/manager"
            className="flex items-center gap-1.5 rounded-full bg-stone-600 px-5 py-2.5 text-sm font-semibold text-white shadow"
          >
            Manager View
            <MenuIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="hidden min-h-full w-full bg-slate-100 p-6 tablet:block tablet:p-7">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-slate-900">Sessions</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700"
            >
              Census Report <span className="ml-1">&#128202;</span>
            </button>
            <Link
              href="/sessions/manager"
              className="rounded-full bg-slate-50 px-4 py-1.5 text-sm text-slate-700"
            >
              Review Sessions <span className="ml-1">&#9711;</span>
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          {SUMMARY.map((item) => (
            <article
              key={item.label}
              className="rounded-3xl bg-slate-50 px-4 py-3 text-center"
            >
              <p className="text-6.5 font-bold leading-none text-slate-900">
                {item.value}
              </p>
              <p className="mt-1 text-base text-slate-700">{item.label}</p>
            </article>
          ))}
        </div>

        <section className="mt-4 rounded-3xl bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-full bg-slate-100 px-4 py-1 text-sm text-slate-700"
              >
                Status <span className="ml-1">&#9662;</span>
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-100 px-4 py-1 text-sm text-slate-700"
              >
                Sort by <span className="ml-1">&#9662;</span>
              </button>
            </div>
            <Link
              href="/sessions/create"
              className="rounded-full bg-lime-300 px-4 py-1 text-sm text-slate-700"
            >
              Add entry <span className="ml-1">+</span>
            </Link>
          </div>

          <div className="grid grid-cols-[1fr_1fr_1fr_1fr] px-3 pb-2 text-sm font-semibold text-slate-700">
            <span>Census No.</span>
            <span>Date</span>
            <span>Location</span>
            <span>Status</span>
          </div>

          <div className="space-y-2 px-3">
            {RECENT_SESSIONS.map((s, idx) => (
              <div
                key={`${s.no}-${idx}`}
                className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center text-sm text-slate-700"
              >
                <span>{s.no}</span>
                <span>{s.date}</span>
                <span>{s.location}</span>
                <span>
                  {s.status === "Continue" ? (
                    <Link
                      href="/sessions/create"
                      className="inline-flex items-center rounded-xl border border-lime-300 px-3 py-1"
                    >
                      Continue <span className="ml-2">&#8250;</span>
                    </Link>
                  ) : (
                    s.status
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>

        <h2 className="mt-6 text-4xl font-bold text-slate-900">
          Priority List
        </h2>

        <section className="mt-3 rounded-3xl bg-slate-50 p-4">
          <div className="grid grid-cols-2 px-3 pb-2 text-sm font-semibold text-slate-700">
            <span>Tracked Locations</span>
            <span>Days Since Last Census</span>
          </div>
          <div className="space-y-2 px-3 text-sm text-slate-700">
            {PRIORITY_LOCATIONS.map((loc) => (
              <div key={`priority-${loc}`} className="grid grid-cols-2">
                <span>{loc}</span>
                <span>Bldg</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
