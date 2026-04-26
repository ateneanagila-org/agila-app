"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon } from "@/components/app-pages/shared/icons";

type Variant = "cream" | "white" | "dark";
type Size = "md" | "sm";

type CustomSelectProps = {
  options: readonly string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  variant?: Variant;
  size?: Size;
};

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Value",
  variant = "cream",
  size = "md",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(() => {
    if (btnRef.current) {
      setRect(btnRef.current.getBoundingClientRect());
    }
    setOpen(true);
  }, []);

  const handleSelect = useCallback(
    (opt: string) => {
      onChange(opt);
      setOpen(false);
    },
    [onChange],
  );

  // Close on outside mousedown (ignore clicks on trigger — its onClick handles toggle)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current && btnRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on outside scroll/resize so panel doesn't drift.
  // Ignore scrolls that happen *inside* the panel (so user can scroll options).
  useEffect(() => {
    if (!open) return;
    const scrollHandler = (e: Event) => {
      if (panelRef.current && panelRef.current.contains(e.target as Node)) {
        return;
      }
      setOpen(false);
    };
    const resizeHandler = () => setOpen(false);
    window.addEventListener("scroll", scrollHandler, true);
    window.addEventListener("resize", resizeHandler);
    return () => {
      window.removeEventListener("scroll", scrollHandler, true);
      window.removeEventListener("resize", resizeHandler);
    };
  }, [open]);

  // Trigger styling
  const triggerCls =
    variant === "dark"
      ? "bg-white/15 border border-white/20 text-white"
      : variant === "white"
        ? "bg-white border border-slate-200 text-slate-900"
        : "bg-brand-cream border border-pink-200 text-slate-900";

  const placeholderCls =
    variant === "dark" ? "text-white/40" : "text-slate-400";

  const chevronCls = variant === "dark" ? "text-white/50" : "text-slate-400";

  const heightCls = size === "sm" ? "h-10" : "h-11";

  // Panel styling
  const panelCls =
    "max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg";

  const optActiveCls = "bg-brand-orange text-white font-semibold";
  const optNormalCls = "text-slate-900 hover:bg-slate-50";

  const panel =
    open && rect
      ? createPortal(
          <div
            ref={panelRef}
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
            }}
            className={panelCls}
          >
            {options.map((opt, i) => (
              <button
                key={`${opt}-${i}`}
                type="button"
                onMouseDown={() => handleSelect(opt)}
                className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                  value === opt ? optActiveCls : optNormalCls
                }`}
              >
                {opt}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className={`flex ${heightCls} w-full items-center justify-between rounded-xl px-3 text-sm ${triggerCls}`}
      >
        <span className={value ? "" : placeholderCls}>{value || placeholder}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${chevronCls}`}
        />
      </button>
      {panel}
    </div>
  );
}
