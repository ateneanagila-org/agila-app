"use client";

import { CloseIcon, ExternalLinkIcon } from "@/components/app-pages/shared/icons";

type UserDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

const BUG_REPORT_URL = "https://github.com/legnspice/agila-app/issues";

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-heading text-lg font-bold text-brand-green">Report a Bug</h3>
              <p className="text-sm text-brand-dark/65">Noticed an issue?</p>
            </div>
            <a
              href={BUG_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand-orange px-5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Report bug <ExternalLinkIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
