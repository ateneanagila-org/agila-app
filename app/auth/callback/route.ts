import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as usersRepo from "@/lib/repo/users.repo";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard/overview";

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error.message);
      return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
    }

    if (data?.user) {
      const email = data.user.email?.toLowerCase() || "";

      // Domain restriction check
      const isAteneo =
        email.endsWith("@student.ateneo.edu") || email.endsWith("@ateneo.edu");

      if (!isAteneo) {
        try {
          const supabaseAdmin = await createAdminClient();
          await supabaseAdmin.auth.admin.deleteUser(data.user.id);
          await supabase.auth.signOut();
        } catch (adminError) {
          console.error("Cleanup failed for unauthorized user:", adminError);
        }

        return NextResponse.redirect(`${baseUrl}/login/non-ateneo-email-used`);
      }

      // Onboarding check — only emails explicitly added by an admin may access the app
      const allowed = await usersRepo.findAllowedEmails({ email });
      if (allowed.length === 0) {
        try {
          const supabaseAdmin = await createAdminClient();
          await supabaseAdmin.auth.admin.deleteUser(data.user.id);
          await supabase.auth.signOut();
        } catch (adminError) {
          console.error("Cleanup failed for non-onboarded user:", adminError);
        }

        return NextResponse.redirect(`${baseUrl}/login/not-onboarded`);
      }

      // Ensure profile exists — if this fails, sign out and redirect to error
      try {
        const existingProfiles = await usersRepo.findProfiles({
          id: data.user.id,
        });
        if (!existingProfiles || existingProfiles.length === 0) {
          await usersRepo.insertProfile({
            id: data.user.id,
            name:
              data.user.user_metadata.full_name ||
              data.user.email?.split("@")[0] ||
              "User",
            auth_role: allowed[0].auth_role ?? "Volunteer",
          });
        }
      } catch (repoError) {
        console.error("Error ensuring user profile:", repoError);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
      }

      // Handle successful login redirect
      const safeNext = next.startsWith("/") ? next : "/dashboard/overview";
      const finalPath =
        safeNext === "/dashboard" ? "/dashboard/overview" : safeNext;
      const finalUrl = `${baseUrl}${finalPath}`;
      return NextResponse.redirect(finalUrl);
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
}
