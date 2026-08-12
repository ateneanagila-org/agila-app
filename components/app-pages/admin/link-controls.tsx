"use client";

import { useState, useTransition } from "react";
import { updateLinks } from "@/app/actions/system";
import type { AppLinks } from "@/lib/constants";

type LinkField = {
  key: keyof AppLinks;
  label: string;
  hint: string;
};

const LINK_FIELDS: LinkField[] = [
  {
    key: "censusReport",
    label: "Census Report",
    hint: "Google Doc opened from the Sessions screens.",
  },
  {
    key: "referralSheet",
    label: "Referral Sheet",
    hint: "Google Sheet opened from the Database screen.",
  },
  {
    key: "adoptFoster",
    label: "Adopt / Foster Form",
    hint: "Application form linked from the public catalog.",
  },
];

export function LinkControls({ initialLinks }: { initialLinks: AppLinks }) {
  const [links, setLinks] = useState<AppLinks>(initialLinks);
  const [draft, setDraft] = useState<AppLinks>(initialLinks);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dirty = LINK_FIELDS.some((f) => draft[f.key].trim() !== links[f.key]);

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const payload: Partial<Record<keyof AppLinks, string | null>> = {};
        for (const field of LINK_FIELDS) {
          const next = draft[field.key].trim();
          if (next === links[field.key]) continue;
          payload[field.key] = next === "" ? null : next;
        }

        const res = await updateLinks(payload);
        if (res?.serverError) throw new Error(res.serverError);

        const resolved = res?.data as AppLinks | undefined;
        if (!resolved) {
          // next-safe-action returns neither `data` nor `serverError` when the
          // zod schema rejects the payload. Without this branch the save would
          // silently do nothing — the failure mode P1 spent a fix wave closing.
          throw new Error("One of the links is not a valid https:// URL.");
        }
        setLinks(resolved);
        setDraft(resolved);
        setSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save links.");
      }
    });
  }

  return (
    <div>
      <h2 className="mb-2 text-sm font-bold text-brand-dark">Referral Links</h2>
      <div className="rounded-2xl bg-white ring-1 ring-border">
        <div className="space-y-3 px-4 py-4">
          <p className="text-xs text-brand-dark/60">
            Clear a field to restore the built-in default.
          </p>

          {LINK_FIELDS.map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`link-${field.key}`}
                className="text-[11px] font-bold uppercase tracking-wider text-brand-dark/60"
              >
                {field.label}
              </label>
              <input
                id={`link-${field.key}`}
                type="url"
                inputMode="url"
                value={draft[field.key]}
                onChange={(e) => {
                  setSaved(false);
                  setDraft((prev) => ({ ...prev, [field.key]: e.target.value }));
                }}
                placeholder="https://…"
                className="mt-1 h-10 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:ring-1 focus:ring-brand-orange/40"
              />
              <p className="mt-1 text-[11px] text-brand-dark/45">{field.hint}</p>
            </div>
          ))}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}
          {saved && !error && (
            <p className="text-xs font-semibold text-brand-green">
              Links saved.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isPending || !dirty}
              onClick={() => {
                setDraft(links);
                setError(null);
                setSaved(false);
              }}
              className="rounded-full px-4 py-2 text-sm font-bold text-brand-dark/60 disabled:opacity-40"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={isPending || !dirty}
              onClick={handleSave}
              className="rounded-full bg-brand-dark px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {isPending ? "Saving…" : "Save links"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
