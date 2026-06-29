import { createContext, useContext } from "react";

import type { LoginCredentials, User, UserRole } from "./types";

export type AuthStatus = "initializing" | "authenticated" | "anonymous" | "error";

export interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: User | null;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  retryCurrentUser: () => Promise<void>;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
