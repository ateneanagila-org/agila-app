"use client";

import { useState, type ReactNode } from "react";
import {
  ChevronDownIcon,
  TrashIcon,
  ExternalLinkIcon,
  CloseIcon,
  CheckIcon,
  SaveIcon,
} from "@/components/app-pages/shared/icons";
import type { FilterCategory, FilterState, SortOption } from "@/lib/hooks/use-filter-sort";

// ─── Shared shell ────────────────────────────────────────────────────────────

function Shell({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-2xl bg-brand-cream p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Header({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="font-heading text-2xl font-bold tracking-tight text-brand-green">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs italic text-brand-dark/70">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-dark text-white transition-opacity hover:opacity-80"
        aria-label="Close"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly,
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-bold text-brand-orange">{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        className="mt-1.5 h-10 w-full rounded-full border-2 border-brand-pink bg-white px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand-orange read-only:opacity-70"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div>
      <label className="text-sm font-bold text-brand-orange">{label}</label>
      <div className="relative mt-1.5">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full appearance-none rounded-full border-2 border-brand-pink bg-white px-4 pr-10 text-sm text-foreground outline-none focus:border-brand-orange"
        >
          <option value="">Value</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-dark/60" />
      </div>
    </div>
  );
}

// ─── Add User Dialog ──────────────────────────────────────────────────────────

type AddUserDialogProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (v: string) => void;
  email: string;
  onEmailChange: (v: string) => void;
  role: string;
  onRoleChange: (v: string) => void;
  roleOptions: readonly string[];
  onCreate: () => void;
  creating: boolean;
  error?: string | null;
};

export function AddUserDialog({
  open,
  onClose,
  name,
  onNameChange,
  email,
  onEmailChange,
  role,
  onRoleChange,
  roleOptions,
  onCreate,
  creating,
  error,
}: AddUserDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="User Details" onClose={onClose} />

      {error ? (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      ) : null}

      <div className="space-y-3">
        <InputField label="Name" value={name} onChange={onNameChange} placeholder="Full name" />
        <InputField
          label="Ateneo Email Address"
          value={email}
          onChange={onEmailChange}
          placeholder="user@student.ateneo.edu"
          type="email"
        />
        <SelectField label="Role" value={role} onChange={onRoleChange} options={roleOptions} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-full border-2 border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80"
        >
          Cancel <CloseIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={creating}
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Apply"} <SaveIcon className="h-4 w-4" />
        </button>
      </div>
    </Shell>
  );
}

// ─── Delete User Dialog ───────────────────────────────────────────────────────

type DeleteUserDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
};

export function DeleteUserDialog({ open, onClose, onConfirm, isLoading }: DeleteUserDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="Delete user?" onClose={onClose} />
      <p className="text-sm text-foreground">This action cannot be undone.</p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full border-2 border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Keep <CheckIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLoading ? "Deleting..." : "Delete"} <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </Shell>
  );
}

// ─── User Filters Dialog ──────────────────────────────────────────────────────

type UserFiltersDialogProps = {
  open: boolean;
  onClose: () => void;
  categories: FilterCategory[];
  activeFilters: FilterState;
  onClear: () => void;
  onApply: (filters: Record<string, string>) => void;
};

function getFilterValue(activeFilters: FilterState, key: string): string {
  const set = activeFilters[key];
  return set && set.size > 0 ? (set.values().next().value as string) : "";
}

function UserFiltersBody({
  categories,
  activeFilters,
  onClose,
  onClear,
  onApply,
}: Omit<UserFiltersDialogProps, "open">) {
  const [pending, setPending] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const cat of categories) {
      init[cat.key] = getFilterValue(activeFilters, cat.key);
    }
    return init;
  });

  const pendingCount = Object.values(pending).filter(Boolean).length;

  return (
    <>
      <Header
        title="Filters"
        subtitle={pendingCount > 0 ? `${pendingCount} selected` : undefined}
        onClose={onClose}
      />

      <div className="space-y-3">
        {categories.map((cat) => (
          <SelectField
            key={cat.key}
            label={cat.label}
            value={pending[cat.key] ?? ""}
            onChange={(v) => setPending((prev) => ({ ...prev, [cat.key]: v }))}
            options={cat.options}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-full border-2 border-brand-green px-4 py-2 text-sm font-semibold text-brand-green transition-opacity hover:opacity-80"
        >
          Reset <CloseIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onApply(pending)}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Apply <CheckIcon className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

export function UserFiltersDialog(props: UserFiltersDialogProps) {
  return (
    <Shell open={props.open} onClose={props.onClose}>
      <UserFiltersBody {...props} />
    </Shell>
  );
}

// ─── User Sort By Dialog ──────────────────────────────────────────────────────

type UserSortByDialogProps = {
  open: boolean;
  onClose: () => void;
  options: SortOption[];
  activeKey: string | null;
  order: "asc" | "desc";
  onApply: (key: string | null, order: "asc" | "desc") => void;
};

function UserSortBody({
  options,
  activeKey,
  order,
  onClose,
  onApply,
}: Omit<UserSortByDialogProps, "open">) {
  const [pending, setPending] = useState<{ key: string | null; order: "asc" | "desc" }>(
    () => ({ key: activeKey, order }),
  );

  return (
    <>
      <Header title="Sort By" onClose={onClose} />

      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setPending((p) => ({ ...p, key: p.key === opt.key ? null : opt.key }))}
            className={`rounded-full border-2 px-3 py-2 text-sm font-semibold transition-colors ${
              pending.key === opt.key
                ? "border-brand-green bg-brand-green text-white"
                : "border-brand-pink text-foreground hover:bg-brand-cream-dark/40"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-brand-green">Order</p>
        <div className="grid grid-cols-2 gap-2">
          {(["asc", "desc"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setPending((p) => ({ ...p, order: o }))}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition-opacity ${
                pending.order === o
                  ? "bg-brand-orange text-white"
                  : "border-2 border-brand-orange/40 text-brand-orange hover:opacity-80"
              }`}
            >
              {o === "asc" ? "Ascending" : "Descending"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => onApply(pending.key, pending.order)}
          className="flex items-center gap-1.5 rounded-full bg-brand-green px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Apply <CheckIcon className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

export function UserSortByDialog(props: UserSortByDialogProps) {
  return (
    <Shell open={props.open} onClose={props.onClose}>
      <UserSortBody {...props} />
    </Shell>
  );
}

// ─── User Details (Profile) Dialog ───────────────────────────────────────────

type UserDetailsDialogProps = {
  open: boolean;
  onClose: () => void;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export function UserDetailsDialog({ open, onClose, name, email, role }: UserDetailsDialogProps) {
  return (
    <Shell open={open} onClose={onClose}>
      <Header title="User Details" onClose={onClose} />

      <div className="space-y-3">
        <InputField label="Name" value={name ?? ""} readOnly />
        <InputField label="Ateneo Student Email Address" value={email ?? ""} readOnly />
        <InputField label="Role" value={role ?? ""} readOnly />
      </div>

      <div className="border-t border-brand-cream-dark pt-3">
        <p className="mb-2 text-sm font-semibold text-brand-orange">Report a Bug</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Noticed an issue?</span>
          <a
            href="https://github.com/anthropics/claude-code/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Report bug <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </Shell>
  );
}
