import { createContext, useContext } from "react";

import type { CurrentUser, LoginCredentials, PermissionNode } from "./types";

export type AuthStatus = "initializing" | "authenticated" | "anonymous" | "error";

export interface AuthContextValue {
  status: AuthStatus;
  isAuthenticated: boolean;
  user: CurrentUser | null;
  error: string | null;
  permissions: PermissionNode[];
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  retryCurrentUser: () => Promise<void>;
  hasPermission: (permission?: string) => boolean;
  setPermissions: (permissions: PermissionNode[]) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
