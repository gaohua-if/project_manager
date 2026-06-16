/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState, type PropsWithChildren } from "react";

import { loadCurrentUser, login } from "./auth-api";
import { getTokenUserId } from "./jwt";
import { clearToken, readToken, writeToken } from "./session";
import type { CurrentUser, LoginCredentials } from "./types";

type AuthStatus = "initializing" | "authenticated" | "anonymous" | "error";

interface AuthValue {
  status: AuthStatus;
  user: CurrentUser | null;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(() => (readToken() ? "initializing" : "anonymous"));
  const [user, setUser] = useState<CurrentUser | null>(null);

  async function restore(token: string) {
    const currentUser = await loadCurrentUser(token, getTokenUserId(token));
    setUser(currentUser);
    setStatus("authenticated");
  }

  useEffect(() => {
    const token = readToken();
    if (!token) return;
    // Blueprint initialization intentionally starts one async state restoration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restore(token).catch(() => setStatus("error"));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        signIn: async (credentials) => {
          setStatus("initializing");
          const token = await login(credentials);
          writeToken(token);
          await restore(token);
        },
        signOut: () => {
          clearToken();
          setUser(null);
          setStatus("anonymous");
        }
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
