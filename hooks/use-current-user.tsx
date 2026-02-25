import { useEffect, useState, useMemo } from "react";
import { getSupabaseUser } from "@/lib/actions/profiles";
import { User } from "@supabase/supabase-js";
import { SelectProfile } from "@/lib/db/schema";
import { getProfiles } from "@/lib/actions/profiles";

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
      const response = await getSupabaseUser();
      const user = response.data.user;

      if (user?.id) {
        const returnedProfile = await getProfiles({ id: user.id });

        if (returnedProfile.data && returnedProfile.data.length > 0) {
          setSupabaseUser(user);
          setProfile(returnedProfile.data[0]);
        }
      }

      setCurrentUserDataLoading(false);
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
