import { useCallback, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";

import { AuthRequestError, getCurrentUser, loginWithPassword } from "./authApi";
import { AuthContext } from "./authContext";
import {
  AUTH_SESSION_CLEARED_EVENT,
  clearAuthSession,
  getAuthSession,
  isAuthSessionStorageKey,
  setAuthSession
} from "./session";
import {
  clearStoredPermissions,
  getStoredPermissions,
  setStoredPermissions,
  starterPermissions
} from "./permissions";
import { getTokenUserId } from "./jwt";
import type { CurrentUser, LoginCredentials, PermissionNode } from "./types";
import type { AuthContextValue } from "./authContext";

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthContextValue["status"]>(() =>
    getAuthSession().token ? "initializing" : "anonymous"
  );
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissionsState] = useState<PermissionNode[]>(() => {
    const stored = getStoredPermissions();
    if (stored.length === 0) return starterPermissions;
    return [
      ...starterPermissions,
      ...stored.filter(
        (storedPermission) =>
          !starterPermissions.some((starterPermission) => starterPermission.authName === storedPermission.authName)
      )
    ];
  });

  const resetToAnonymous = useCallback(() => {
    setUser(null);
    setError(null);
    setStatus("anonymous");
  }, []);

  const loadCurrentUser = useCallback(async (token: string, signal?: AbortSignal) => {
    try {
      const userId = getTokenUserId(token);
      const nextUser = await getCurrentUser(token, userId, signal);
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
          ? typeof loadError.status === "number" && loadError.status >= 400 && loadError.status < 500
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

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setStatus("initializing");
      setError(null);

      let token: string;
      try {
        token = await loginWithPassword(credentials);
      } catch (loginError) {
        clearAuthSession();
        const message = loginError instanceof Error ? loginError.message : "登录失败，请稍后重试";
        setError(message);
        setStatus("anonymous");
        throw loginError;
      }

      setAuthSession({ token });
      await loadCurrentUser(token);
      setStoredPermissions(starterPermissions);
      setPermissionsState(starterPermissions);
    },
    [loadCurrentUser]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isAuthenticated: status === "authenticated" && user !== null,
      user,
      error,
      permissions,
      login,
      logout: () => {
        clearAuthSession();
        clearStoredPermissions();
        setUser(null);
        setError(null);
        setStatus("anonymous");
        setPermissionsState([]);
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
      hasPermission: (permission?: string) => {
        if (!permission) {
          return true;
        }
        return permissions.some((item) => item.authName === permission || item.auth === permission);
      },
      setPermissions: (nextPermissions: PermissionNode[]) => {
        setStoredPermissions(nextPermissions);
        setPermissionsState(nextPermissions);
      }
    }),
    [error, loadCurrentUser, login, permissions, resetToAnonymous, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
