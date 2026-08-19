import type { ReactNode } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { MdSpaceDashboard } from "react-icons/md";
import { BrandLogo } from "@/components/app-pages/shared/brand-logo";
import { PublicFooter } from "@/components/app-pages/catalog/public-footer";
import { createClient } from "@/lib/supabase/server";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isAuthed = !!data?.user;

  return (
    <div className="fixed inset-0 flex h-dvh flex-col overflow-hidden bg-brand-dark">
      <header className="shrink-0 bg-brand-dark">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4">
          <BrandLogo />
          {isAuthed ? (
            <Link
              href="/dashboard/overview"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-bold text-white/70 transition-colors hover:text-white"
            >
              Dashboard <MdSpaceDashboard className="h-4 w-4 text-white" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-bold text-white/70 transition-colors hover:text-white"
            >
              Login <LogIn className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </header>
      {/* Footer lives inside the scroll container, so it sits below the page
          content rather than pinned. Outside the max-w-7xl wrapper so the dark
          band runs full-bleed while its content stays aligned to the page. */}
      <main className="min-h-0 flex-1 overflow-y-auto bg-brand-cream">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
        <PublicFooter />
      </main>
    </div>
  );
}
