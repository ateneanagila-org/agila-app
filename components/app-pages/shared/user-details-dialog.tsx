"use client";

import {
  CloseIcon,
  ExternalLinkIcon,
} from "@/components/app-pages/shared/icons";

type UserDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

const BUG_REPORT_URL = "https://github.com/anthropics/claude-code/issues";

function DetailDisplayField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="font-heading text-[22px] font-bold leading-tight text-brand-orange">
        {label}
      </p>
      <div className="mt-2 flex min-h-14 w-full items-center rounded-[1.35rem] border-[4px] border-brand-pink bg-brand-cream px-5 text-base font-semibold text-brand-dark shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
        <span className="min-w-0 truncate">{value || "—"}</span>
      </div>
    </div>
  );
}

export function UserDetailsDialog({
  open,
  onClose,
  name,
  email,
  role,
}: UserDetailsDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[30.5rem] rounded-t-[1.45rem] rounded-bl-[1.45rem] bg-brand-cream px-5 pb-6 pt-7 shadow-2xl tablet:px-[1.4rem] tablet:pb-[1.55rem] tablet:pt-[1.7rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-[1.35rem] top-[1.35rem] inline-flex h-[2.9rem] w-[2.9rem] items-center justify-center bg-brand-dark text-white transition-opacity hover:opacity-85"
          aria-label="Close user details"
        >
          <CloseIcon className="h-7 w-7" />
        </button>

        <div className="space-y-[0.95rem]">
          <div className="pr-14">
            <h2 className="font-heading text-[2rem] font-bold leading-none tracking-tight text-brand-green tablet:text-[2.1rem]">
              User Details
            </h2>
          </div>
          <DetailDisplayField label="Name" value={name} />
          <DetailDisplayField
            label="Ateneo Student Email Address"
            value={email}
          />
          <DetailDisplayField label="Role" value={role} />
        </div>

        <div className="mt-6">
          <h3 className="font-heading text-[1.85rem] font-bold leading-none tracking-tight text-brand-green tablet:text-[2rem]">
            Report a Bug
          </h3>
          <div className="mt-4 flex flex-col gap-3 tablet:flex-row tablet:items-center">
            <p className="font-heading text-[1.35rem] font-bold leading-tight text-brand-orange">
              Noticed an issue?
            </p>
            <a
              href={BUG_REPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[3.2rem] items-center justify-center gap-3 rounded-[1.45rem] bg-brand-orange px-6 font-heading text-[1.35rem] font-medium leading-none text-white transition-opacity hover:opacity-90"
            >
              Report bug <ExternalLinkIcon className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
