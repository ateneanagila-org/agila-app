"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import type { SelectProfile } from "@/lib/validation/users";
import type { AuthRole } from "@/lib/db/enums";

export interface CurrentUserData {
  supabaseUser: User;
  profile: SelectProfile;
}

interface AuthContextType {
  userData: CurrentUserData;
  role: AuthRole;
  isAdmin: boolean;
  isManager: boolean;
  isVolunteer: boolean;
  /** Manager OR Administrator — can approve sessions, CRUD database */
  canManage: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
  userData: CurrentUserData;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, userData }: AuthProviderProps) {
  const value = useMemo<AuthContextType>(() => {
    const role = (userData.profile.auth_role ?? "Volunteer") as AuthRole;
    const isAdmin = role === "Administrator";
    const isManager = role === "Manager";
    const isVolunteer = role === "Volunteer";
    return {
      userData,
      role,
      isAdmin,
      isManager,
      isVolunteer,
      canManage: isAdmin || isManager,
    };
  }, [userData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
