import { cn } from "@/lib/utils";

type IconProps = { className?: string };

function iconClassName(className?: string) {
  return cn("block shrink-0 align-middle", className);
}

export function ImagePlaceholderIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m21 15-5-5L5 21" />
    </svg>
  );
}

export function CatIcon({ className }: IconProps) {
  return (
    <svg
      className={iconClassName(className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 4l2.5 4.5M19 4l-2.5 4.5" />
      <path d="M4 11c0-3.5 3.5-6 8-6s8 2.5 8 6v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5z" />
      <path d="M9 13h.01M15 13h.01" strokeWidth="2" />
      <path d="M11 17c.5.5 1.5.5 2 0" />
      <path d="M10 15.5l2 .8 2-.8" />
    </svg>
  );
}

export function PlusCircleIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" strokeWidth="2" />
      <path strokeLinecap="round" strokeWidth="2" d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function MoreHorizontalIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

export function DoubleChevronIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="7" strokeWidth="2" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8a3 3 0 0 1 3-3h1.5L10 3h4l1.5 2H17a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8z" />
      <circle cx="12" cy="12.5" r="3.5" strokeWidth="2" />
    </svg>
  );
}

export function SwitchCameraIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8a3 3 0 0 1 3-3h1.5L10 3h4l1.5 2H17a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12a3 3 0 0 1 5.5-1.65M15 13a3 3 0 0 1-5.5 1.65" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.5 8.75v1.6h-1.6M9.5 16.25v-1.6h1.6" />
    </svg>
  );
}

export function ExternalLinkIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function SaveIcon({ className }: IconProps) {
  return (
    <svg className={iconClassName(className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true" focusable="false">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M5 5a2 2 0 0 1 2-2h9l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 3v5h7V3" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 13h8v8H8z" />
    </svg>
  );
}
