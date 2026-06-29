import { useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import { AuthRequestError, fetchCurrentUser, loginWithPassword } from "./authApi";
import { AuthContext } from "./authContext";
import {
  AUTH_SESSION_CLEARED_EVENT,
  clearAuthSession,
  getAuthSession,
  isAuthSessionStorageKey,
  setAuthSession
} from "./session";
import type { LoginCredentials, User, UserRole } from "./types";
import type { AuthContextValue } from "./authContext";

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthContextValue["status"]>(() =>
    getAuthSession().token ? "initializing" : "anonymous"
  );
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetToAnonymous = useCallback(() => {
    setUser(null);
    setError(null);
    setStatus("anonymous");
  }, []);

  const loadCurrentUser = useCallback(async (token: string, signal?: AbortSignal) => {
    try {
      const nextUser = await fetchCurrentUser(token, signal);
      setUser(nextUser);
      setStatus("authenticated");
      return nextUser;
    } catch (loadError) {
      if (signal?.aborted) return null;
      const message = loadError instanceof Error ? loadError.message : "当前用户加载失败";
      setUser(null);
      setError(message);
      const shouldClearSession =
        loadError instanceof AuthRequestError
          ? typeof loadError.status === "number" &&
            loadError.status >= 400 &&
            loadError.status < 500
          : !(loadError instanceof TypeError);
      if (shouldClearSession) {
        clearAuthSession();
        setStatus("anonymous");
      } else {
        setStatus("error");
      }
      throw loadError;
    }
  }, []);

  useEffect(() => {
    const token = getAuthSession().token;
    if (!token) return;

    const controller = new AbortController();
    // Initial auth restoration is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCurrentUser(token, controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [loadCurrentUser]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isAuthSessionStorageKey(event.key)) return;
      const token = getAuthSession().token;
      if (!token) {
        resetToAnonymous();
        return;
      }
      setStatus("initializing");
      setError(null);
      void loadCurrentUser(token).catch(() => undefined);
    };
    const handleClearedSession = () => resetToAnonymous();

    window.addEventListener("storage", handleStorage);
    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, handleClearedSession);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, handleClearedSession);
    };
  }, [loadCurrentUser, resetToAnonymous]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setStatus("initializing");
    setError(null);

    try {
      const { token, user: loginUser } = await loginWithPassword(credentials);
      setAuthSession({ token });
      setUser(loginUser);
      setStatus("authenticated");
    } catch (loginError) {
      clearAuthSession();
      const message = loginError instanceof Error ? loginError.message : "登录失败，请稍后重试";
      setError(message);
      setStatus("anonymous");
      throw loginError;
    }
  }, []);

  const hasRole = useCallback(
    (role: UserRole | UserRole[]) => {
      if (!user) return false;
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(user.role);
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated: status === "authenticated" && user !== null,
      user,
      error,
      login,
      logout: () => {
        clearAuthSession();
        setUser(null);
        setError(null);
        setStatus("anonymous");
      },
      retryCurrentUser: async () => {
        const token = getAuthSession().token;
        if (!token) {
          resetToAnonymous();
          return;
        }
        setStatus("initializing");
        setError(null);
        await loadCurrentUser(token);
      },
      hasRole
    }),
    [error, hasRole, loadCurrentUser, login, resetToAnonymous, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
