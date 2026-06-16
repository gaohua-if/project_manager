import type { CurrentUser, LoginCredentials } from "./types";

const DEFAULT_USER_API_BASE_URL = "/api/v1";

export async function login(credentials: LoginCredentials): Promise<string> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  });
  const payload = (await response.json()) as {
    code?: number;
    message?: string;
    data?: { token?: string; access_token?: string };
    token?: string;
  };
  const token = payload.token ?? payload.data?.token ?? payload.data?.access_token;

  if (!response.ok || (typeof payload.code === "number" && payload.code !== 0) || !token) {
    throw new Error(payload.message || "Login failed");
  }
  return token;
}

export async function loadCurrentUser(token: string, userId: string): Promise<CurrentUser> {
  const response = await fetch(`${DEFAULT_USER_API_BASE_URL}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const payload = (await response.json()) as {
    code?: number;
    message?: string;
    data?: CurrentUser;
  };

  if (!response.ok || (typeof payload.code === "number" && payload.code !== 0) || !payload.data) {
    throw new Error(payload.message || "Current user load failed");
  }
  return payload.data;
}
