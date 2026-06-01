"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { UserDetailsDialog } from "@/components/app-pages/shared/user-details-dialog";

type UserMenuProps = {
  variant: "sidebar" | "mobile";
};

function getInitials(name: string | null | undefined, email: string | undefined) {
  const source = (name && name.trim()) || email || "";
  if (!source) return "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function Avatar({
  src,
  initials,
  size,
  ring = false,
}: {
  src?: string | null;
  initials: string;
  size: "sm" | "md" | "lg";
  ring?: boolean;
}) {
  const sizeClasses =
    size === "lg" ? "h-14 w-14 text-base" : size === "md" ? "h-10 w-10 text-sm" : "h-9 w-9 text-xs";
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-green font-bold text-white ${sizeClasses} ${
        ring ? "ring-2 ring-white/30" : ""
      }`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}

export function UserMenu({ variant }: UserMenuProps) {
  const { userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const name =
    userData.profile.name ||
    (userData.supabaseUser.user_metadata?.full_name as string | undefined) ||
    userData.supabaseUser.email?.split("@")[0] ||
    "User";
  const email = userData.supabaseUser.email ?? "";
  const role = userData.profile.auth_role ?? "Volunteer";
  const avatarUrl = userData.supabaseUser.user_metadata?.avatar_url as
    | string
    | undefined;
  const initials = getInitials(userData.profile.name, email);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", handler);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const menuPanel = (
    <div
      className={`${
        variant === "sidebar"
          ? "absolute bottom-full left-0 right-0 mb-2"
          : "absolute right-0 top-full mt-2 w-72"
      } z-40 origin-top overflow-hidden rounded-2xl bg-brand-dark shadow-xl ring-1 ring-white/10`}
    >
      <div className="flex items-center gap-3 bg-brand-green p-4">
        <Avatar src={avatarUrl} initials={initials} size="lg" ring />
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-bold leading-tight text-white">
            {name}
          </p>
          <p className="truncate text-xs text-white/70">{email}</p>
          <span className="mt-1.5 inline-flex items-center rounded-full bg-brand-yellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-brand-dark">
            {role}
          </span>
        </div>
      </div>
      <div className="p-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setShowDetails(true);
          }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-brand-orange"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21a8 8 0 0 0-16 0" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          User details
        </button>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-brand-orange"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );

  if (variant === "sidebar") {
    return (
      <>
        <div ref={rootRef} className="relative border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-white/5"
          >
            <Avatar src={avatarUrl} initials={initials} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{name}</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-brand-yellow">
                {role}
              </p>
            </div>
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${
                open ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {open ? menuPanel : null}
        </div>
        <UserDetailsDialog
          open={showDetails}
          onClose={() => setShowDetails(false)}
          name={name}
          email={email}
          role={role}
        />
      </>
    );
  }

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Open profile menu"
          className="flex items-center gap-2 rounded-full bg-white/10 p-1 pr-2.5 ring-1 ring-white/15 transition-colors hover:bg-white/15"
        >
          <Avatar src={avatarUrl} initials={initials} size="sm" />
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 text-white/70 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open ? menuPanel : null}
      </div>
      <UserDetailsDialog
        open={showDetails}
        onClose={() => setShowDetails(false)}
        name={name}
        email={email}
        role={role}
      />
    </>
  );
}
