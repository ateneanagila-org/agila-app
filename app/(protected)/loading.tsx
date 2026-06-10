import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-brand-cream">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-green/70">
          Loading
        </p>
      </div>
    </div>
  );
}
