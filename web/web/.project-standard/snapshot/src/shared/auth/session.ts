const TOKEN_KEY = "token";
export const AUTH_SESSION_CLEARED_EVENT = "auth:session-cleared";

export interface AuthSession {
  token: string | null;
}

export function getAuthSession(): AuthSession {
  return {
    token: localStorage.getItem(TOKEN_KEY)
  };
}

export function setAuthSession(session: { token: string }) {
  localStorage.setItem(TOKEN_KEY, session.token);
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_SESSION_CLEARED_EVENT));
}

export function isAuthSessionStorageKey(key: string | null) {
  return key === null || key === TOKEN_KEY;
}
