"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchIcon, ChevronDownIcon } from "./icons";

type LocationPickerProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Visual variant — controls the trigger button look. */
  variant?: "pill" | "field";
  /** Width override for the popover panel. */
  panelClassName?: string;
};

/**
 * Accessible, searchable location dropdown. Replaces the native `<select>`
 * so long option lists stay contained in a scrollable popover instead of
 * filling the viewport.
 */
export function LocationPicker({
  value,
  options,
  onChange,
  label,
  placeholder = "Search location…",
  variant = "field",
  panelClassName,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setQuery("");
      inputRef.current?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const triggerSize = variant === "pill" ? "h-11" : "h-10";

  return (
    <div ref={rootRef} className="relative w-full">
      {label ? (
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-brand-dark/60">
          {label}
        </label>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${triggerSize} flex w-full items-center gap-2.5 rounded-xl border-2 border-brand-dark/10 bg-white px-3.5 text-left text-sm font-semibold text-brand-dark shadow-sm transition-colors hover:border-brand-orange/40 hover:bg-brand-cream ${
          open ? "border-brand-orange shadow-md" : ""
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-orange text-white">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s-7-7.58-7-12a7 7 0 1114 0c0 4.42-7 12-7 12z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-brand-dark/60 transition-transform ${
            open ? "rotate-180 text-brand-orange" : ""
          }`}
        />
      </button>

      {open ? (
        <div
          className={`absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border-2 border-brand-dark/10 bg-white shadow-2xl ${
            panelClassName ?? ""
          }`}
        >
          <div className="flex items-center gap-2 border-b border-brand-dark/10 bg-white px-3.5 py-2.5">
            <SearchIcon className="h-4 w-4 shrink-0 text-brand-dark/40" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-7 w-full bg-transparent text-sm font-medium text-brand-dark outline-none placeholder:text-brand-dark/40"
            />
          </div>
          <ul
            role="listbox"
            className="max-h-64 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-center text-xs text-brand-dark/50">
                No locations match.
              </li>
            ) : (
              filtered.map((opt) => {
                const active = opt === value;
                return (
                  <li key={opt}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onChange(opt);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors ${
                        active
                          ? "bg-brand-mint font-bold text-brand-green"
                          : "text-brand-dark hover:bg-brand-cream"
                      }`}
                    >
                      <span className="truncate">{opt}</span>
                      {active ? (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4 text-brand-green"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
