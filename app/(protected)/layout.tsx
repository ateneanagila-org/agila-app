import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findProfiles } from "@/lib/repo/users.repo";
import { AuthProvider } from "@/contexts/auth-context";
import { LinksProvider } from "@/contexts/links-context";
import { getLinks } from "@/lib/services/system.service";

// Server component: auth state resolved on the server so clients never see a
// loading flash. Middleware already guards unauthenticated access; this layout
// fetches the profile and hands it to the client AuthProvider.
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [profiles, links] = await Promise.all([
    findProfiles({ id: user.id }),
    getLinks(),
  ]);
  const profile = profiles[0];

  if (!profile) {
    redirect("/login");
  }

  return (
    <AuthProvider userData={{ supabaseUser: user, profile }}>
      <LinksProvider links={links}>{children}</LinksProvider>
    </AuthProvider>
  );
}
