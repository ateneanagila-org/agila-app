"use client";

import { useEffect, useState, useTransition } from "react";
import { CloseIcon } from "@/components/app-pages/shared/icons";
import { submitBugReport } from "@/app/actions/bug-reports";

type UserDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-green">
        {label}
      </p>
      <div className="mt-1.5 flex min-h-11 w-full items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-dark ring-1 ring-border">
        <span className="min-w-0 truncate">{value || "—"}</span>
      </div>
    </div>
  );
}

export function UserDetailsDialog({ open, onClose, name, email, role }: UserDetailsDialogProps) {
  const [reporting, setReporting] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();

  // The dialog stays mounted when closed (user-menu renders it unconditionally
  // and it early-returns null), so state survives every close. Without this
  // reset, one sent report leaves the confirmation showing forever and the user
  // can never file a second.
  useEffect(() => {
    if (!open) {
      setReporting(false);
      setMessage("");
      setSent(false);
      setReportError(null);
    }
  }, [open]);

  const handleSubmitReport = () => {
    setReportError(null);
    startSending(async () => {
      try {
        const res = await submitBugReport({ message });
        if (res?.serverError) throw new Error(res.serverError);
        if (!res?.data) {
          // Neither data nor serverError means zod rejected the payload;
          // without this the click silently does nothing.
          throw new Error("Please keep the report under 2000 characters.");
        }
        setSent(true);
        setReporting(false);
        setMessage("");
      } catch (e) {
        setReportError(
          e instanceof Error ? e.message : "Could not send your report.",
        );
      }
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-brand-cream p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-dark text-white transition-opacity hover:opacity-85"
          aria-label="Close user details"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        <h2 className="pr-12 font-heading text-2xl font-bold tracking-tight text-brand-green">
          User Details
        </h2>

        <div className="mt-5 space-y-3">
          <DetailField label="Name" value={name} />
          <DetailField label="Email Address" value={email} />
          <DetailField label="Role" value={role} />
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-heading text-lg font-bold text-brand-green">
            Report a Bug
          </h3>

          {sent ? (
            <p className="mt-2 text-sm text-brand-dark/65">
              Thanks — your report was sent. An administrator will take a look.
            </p>
          ) : reporting ? (
            <>
              <p className="mt-1 text-sm text-brand-dark/65">
                Describe what went wrong. Your name and email are attached
                automatically.
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                autoFocus
                placeholder="What happened, and what were you doing at the time?"
                className="mt-2 w-full resize-y rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
              />
              {reportError && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {reportError}
                </p>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => {
                    setReporting(false);
                    setMessage("");
                    setReportError(null);
                  }}
                  className="rounded-full px-4 py-2 text-sm font-bold text-brand-dark/60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSending || !message.trim()}
                  onClick={handleSubmitReport}
                  className="rounded-full bg-brand-orange px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {isSending ? "Sending…" : "Send report"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-brand-dark/65">Noticed an issue?</p>
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand-orange px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                Report bug
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
