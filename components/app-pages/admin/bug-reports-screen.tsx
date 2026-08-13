"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  listBugReports,
  resolveBugReport,
  removeBugReportAction,
} from "@/app/actions/bug-reports";
import type { BugReport } from "@/lib/repo/bug-reports.repo";

type Filter = "Open" | "Resolved" | "All";

const FILTERS: Filter[] = ["Open", "Resolved", "All"];

function formatDate(value: Date | string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export function BugReportsScreen({
  initialReports,
}: {
  initialReports: BugReport[];
}) {
  const [reports, setReports] = useState<BugReport[]>(initialReports);
  const [filter, setFilter] = useState<Filter>("Open");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<BugReport | null>(null);
  const [typed, setTyped] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        const res = await listBugReports({});
        if (res?.serverError) throw new Error(res.serverError);
        if (res?.data) setReports(res.data as BugReport[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed.");
      }
    });
  }

  const visible = reports.filter((r) =>
    filter === "All" ? true : r.status === filter,
  );

  const body = (
    <>
      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              filter === f
                ? "bg-brand-dark text-white"
                : "bg-white text-brand-dark/60 ring-1 ring-border hover:text-brand-dark"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="mt-3 space-y-3">
        {visible.length === 0 ? (
          <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm text-brand-dark/50 ring-1 ring-border">
            No {filter === "All" ? "" : filter.toLowerCase()} reports.
          </p>
        ) : (
          visible.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl bg-white p-4 ring-1 ring-border"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-dark">
                    {r.reporter_name ?? "Unknown reporter"}
                  </p>
                  <p className="truncate text-xs text-brand-dark/50">
                    {r.reporter_email}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    r.status === "Open"
                      ? "bg-brand-orange/15 text-brand-orange"
                      : "bg-brand-mint text-brand-dark/60"
                  }`}
                >
                  {r.status}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-brand-dark/80">
                {r.message}
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-brand-dark/45">
                  Reported {formatDate(r.created_at)}
                  {r.resolved_at
                    ? ` · Resolved ${formatDate(r.resolved_at)}`
                    : ""}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      run(async () => {
                        const res = await resolveBugReport({
                          id: r.id,
                          status: r.status === "Open" ? "Resolved" : "Open",
                        });
                        if (res?.serverError)
                          throw new Error(res.serverError);
                      })
                    }
                    className="rounded-full bg-brand-dark px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {r.status === "Open" ? "Resolve" : "Reopen"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setConfirmDelete(r);
                      setTyped("");
                      setError(null);
                    }}
                    className="rounded-full px-3 py-1.5 text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col tablet:hidden">
        <div className="flex-1 px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="font-heading text-xl font-bold text-brand-dark">
              Bug Reports
            </p>
            <Link
              href="/dashboard/admin"
              className="rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
          {body}
        </div>
      </div>

      {/* ── Desktop ────────────────────────────────────────────────── */}
      <div className="hidden min-h-full w-full bg-brand-cream p-6 tablet:block tablet:p-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="font-heading text-2xl font-bold text-brand-dark">
              Bug Reports
            </h1>
            <Link
              href="/dashboard/admin"
              className="rounded-full bg-brand-dark px-4 py-1.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Back <span className="ml-1">&#8249;</span>
            </Link>
          </div>
          {body}
        </div>
      </div>

      {/* Delete confirm — typed confirmation, deletion is unrecoverable */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-brand-cream p-5 shadow-xl">
            <h3 className="font-heading text-lg font-bold text-brand-dark">
              Delete report?
            </h3>
            <p className="mt-2 text-sm text-red-600">
              This permanently deletes the report from{" "}
              <strong>{confirmDelete.reporter_email}</strong>. This cannot be
              undone.
            </p>
            <p className="mt-3 text-xs text-brand-dark/60">
              Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
            />
            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="rounded-full px-4 py-2 text-sm font-bold text-brand-dark/60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending || typed !== "DELETE"}
                onClick={() =>
                  run(async () => {
                    const res = await removeBugReportAction({
                      id: confirmDelete.id,
                    });
                    if (res?.serverError) throw new Error(res.serverError);
                    setConfirmDelete(null);
                  })
                }
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
