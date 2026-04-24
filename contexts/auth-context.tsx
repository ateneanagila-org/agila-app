"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import type { SelectProfile } from "@/lib/validation/users";

export interface CurrentUserData {
  supabaseUser: User;
  profile: SelectProfile;
}

interface AuthContextType {
  userData: CurrentUserData;
}

interface AuthProviderProps {
  children: ReactNode;
  userData: CurrentUserData;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children, userData }: AuthProviderProps) {
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({ userData }), [userData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
