import { useEffect, useState, useMemo } from "react";
import { getSupabaseUser } from "@/app/actions/users";
import { User } from "@supabase/supabase-js";
import { SelectProfile } from "@/lib/validation/users";
import { getProfiles } from "@/app/actions/users";

export interface CurrentUserData {
  supabaseUser: User;
  profile: SelectProfile;
}

export function useCurrentUser() {
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SelectProfile | null>(null);
  const [currentUserDataLoading, setCurrentUserDataLoading] = useState(true);

  useEffect(() => {
    async function loadSupabaseUser() {
      try {
        const response = await getSupabaseUser();
        const user = response?.data?.data?.user;

        if (user?.id) {
          const returnedProfile = await getProfiles({ id: user.id });

          if (returnedProfile.data && returnedProfile.data.length > 0) {
            setSupabaseUser(user);
            setProfile(returnedProfile.data[0]);
          }
        }
      } catch (error) {
        console.error("Failed to load current user:", error);
      } finally {
        setCurrentUserDataLoading(false);
      }
    }
    loadSupabaseUser();
  }, []);

  // Memoize the userData object so it has a stable reference
  const userData = useMemo(() => {
    if (!supabaseUser || !profile) return null;
    return {
      supabaseUser,
      profile,
    };
  }, [supabaseUser, profile]);

  return {
    userData,
    currentUserDataLoading,
  };
}
