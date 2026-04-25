import { createClient } from "@/lib/supabase/server";
import { findProfiles } from "@/lib/repo/users.repo";
import { AppError } from "@/lib/error/app-error";
import type { AuthRole } from "@/lib/db/enums";
import type { SelectProfile } from "@/lib/validation/users";
import type { User } from "@supabase/supabase-js";

export type CurrentUser = { user: User; profile: SelectProfile };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profiles = await findProfiles({ id: user.id });
  const profile = profiles[0];
  if (!profile) return null;

  return { user, profile };
}

export async function requireAuth(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) throw new AppError("Unauthorized", 401);
  return current;
}

export async function requireRole(
  ...allowed: AuthRole[]
): Promise<CurrentUser> {
  const current = await requireAuth();
  const role = current.profile.auth_role as AuthRole;
  if (!allowed.includes(role)) {
    throw new AppError("Forbidden: insufficient role", 403);
  }
  return current;
}

export function hasRole(
  role: AuthRole | null | undefined,
  ...allowed: AuthRole[]
): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

export const MANAGER_OR_ADMIN: AuthRole[] = ["Manager", "Administrator"];
export const ADMIN_ONLY: AuthRole[] = ["Administrator"];
export const ANY_AUTHED: AuthRole[] = [
  "Volunteer",
  "Manager",
  "Administrator",
];
