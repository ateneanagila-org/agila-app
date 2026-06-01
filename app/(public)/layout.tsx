import type { ReactNode } from "react";
import Link from "next/link";
import { LogIn, LayoutDashboard } from "lucide-react";
import { BrandLogo } from "@/components/app-pages/shared/brand-logo";
import { createClient } from "@/lib/supabase/server";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isAuthed = !!data?.user;

  return (
    <div className="fixed inset-0 flex h-dvh flex-col overflow-hidden bg-brand-dark">
      <header className="shrink-0 bg-brand-dark">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
          <BrandLogo />
          {isAuthed ? (
            <Link
              href="/dashboard/overview"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-brand-green px-4 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Dashboard <LayoutDashboard className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-brand-green px-4 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              Login <LogIn className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-brand-cream">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
