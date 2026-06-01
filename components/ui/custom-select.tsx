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

const PANEL_MARGIN = 12;
const PANEL_GAP = 4;
const PANEL_MAX_HEIGHT = 192;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
    "overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg";

  const optActiveCls = "bg-brand-orange text-white font-semibold";
  const optNormalCls = "text-slate-900 hover:bg-slate-50";

  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const estimatedPanelHeight = Math.min(
    PANEL_MAX_HEIGHT,
    Math.max(44, options.length * 40),
  );
  const availableBelow = rect
    ? viewportHeight - rect.bottom - PANEL_MARGIN
    : PANEL_MAX_HEIGHT;
  const availableAbove = rect ? rect.top - PANEL_MARGIN : PANEL_MAX_HEIGHT;
  const placeAbove =
    availableBelow < estimatedPanelHeight && availableAbove > availableBelow;
  const availableHeight = Math.max(
    72,
    (placeAbove ? availableAbove : availableBelow) - PANEL_GAP,
  );
  const panelMaxHeight = Math.min(PANEL_MAX_HEIGHT, availableHeight);
  const panelWidth =
    rect && viewportWidth
      ? Math.min(
          Math.max(rect.width, size === "sm" ? 88 : rect.width),
          viewportWidth - PANEL_MARGIN * 2,
        )
      : rect?.width;
  const panelLeft =
    rect && panelWidth && viewportWidth
      ? clamp(
          rect.left,
          PANEL_MARGIN,
          Math.max(PANEL_MARGIN, viewportWidth - panelWidth - PANEL_MARGIN),
        )
      : rect?.left;
  const panelTop =
    rect && viewportHeight
      ? placeAbove
        ? Math.max(PANEL_MARGIN, rect.top - PANEL_GAP - panelMaxHeight)
        : Math.min(
            rect.bottom + PANEL_GAP,
            viewportHeight - PANEL_MARGIN - panelMaxHeight,
          )
      : rect?.bottom;

  const panel =
    open && rect
      ? createPortal(
          <div
            ref={panelRef}
            onMouseDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: panelTop,
              left: panelLeft,
              width: panelWidth,
              maxHeight: panelMaxHeight,
              zIndex: 9999,
            }}
            className={panelCls}
          >
            {options.map((opt, i) => (
              <button
                key={`${opt}-${i}`}
                type="button"
                onMouseDown={() => handleSelect(opt)}
                className={`w-full whitespace-nowrap px-3 py-2.5 text-left text-sm transition-colors ${
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
        className={`flex ${heightCls} w-full items-center justify-between gap-2 rounded-xl px-3 text-sm ${triggerCls}`}
      >
        <span className={`min-w-0 truncate ${value ? "" : placeholderCls}`}>
          {value || placeholder}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""} ${chevronCls}`}
        />
      </button>
      {panel}
    </div>
  );
}
