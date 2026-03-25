"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DetailHeader,
  PageContent,
} from "@/components/app-pages/shared/page-frame";
import { ChangeConfirmDialog } from "@/components/app-pages/shared/dialogs";
import { ChevronDownIcon, DoubleChevronIcon } from "@/components/app-pages/shared/icons";

function DropdownField({ label }: { label: string }) {
  return (
    <div>
      <label className="text-sm text-slate-700">{label}</label>
      <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        <span className="text-sm text-slate-400">Value</span>
        <ChevronDownIcon className="h-4 w-4 text-slate-400" />
      </div>
    </div>
  );
}

export function SessionsApprovalValidationScreen() {
  const router = useRouter();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  return (
    <PageContent>
      <DetailHeader backHref="/sessions/manager" />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowSaveConfirm(true)}
          className="rounded-full bg-stone-600 px-4 py-2 text-xs font-semibold text-white"
        >
          Approve Instantly
        </button>
        <button
          type="button"
          onClick={() => setShowDiscardConfirm(true)}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
        >
          Discard
        </button>
      </div>

      {/* Heading + Next */}
      <div className="flex items-center justify-between">
        <p className="text-base font-bold text-slate-900">Validate the info.</p>
        <Link
          href="/sessions/approval/cross-ref"
          className="flex items-center gap-1 text-sm text-slate-600"
        >
          Next
          <DoubleChevronIcon className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-4">
        {/* Last seen at */}
        <div>
          <p className="text-sm text-slate-600">Last seen at:</p>
          <p className="text-sm font-semibold text-slate-900">
            Date / Region / Spot
          </p>
        </div>

        <DropdownField label="Color" />
        <DropdownField label="Size/Age" />
        <DropdownField label="Sex" />
        <DropdownField label="Sociability" />
        <DropdownField label="Status" />

        <div>
          <label className="text-sm text-slate-700">Caretaker</label>
          <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none" />
        </div>

        <div>
          <label className="text-sm text-slate-700">Notes</label>
          <textarea className="mt-1 h-20 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none" />
        </div>
      </div>

      <ChangeConfirmDialog
        open={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        title="Discard changes?"
        description="These changes will be lost if not saved."
        confirmLabel="Discard Changes"
        showAvatar
        onConfirm={() => {
          setShowDiscardConfirm(false);
          router.push("/sessions/manager");
        }}
      />

      <ChangeConfirmDialog
        open={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        title="Save changes?"
        description="Old data will be overwritten."
        confirmLabel="Save Changes"
        onConfirm={() => setShowSaveConfirm(false)}
      />
    </PageContent>
  );
}
