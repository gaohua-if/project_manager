import { runtimeConfig } from "@/config/runtimeConfig";

import type { CurrentUser, LoginCredentials } from "./types";

type RecordLike = Record<string, unknown>;

export class AuthRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AuthRequestError";
    this.status = status;
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" ? (value as RecordLike) : null;
}

function pickString(value: unknown, keys: string[]) {
  const record = getRecord(value);
  if (!record) return null;

  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  const direct = pickString(payload, ["message", "msg", "error"]);
  if (direct) return direct;
  return pickString(getRecord(payload)?.data, ["message", "msg", "error"]) ?? fallback;
}

function ensureSuccessfulPayload(payload: unknown, fallback: string) {
  const record = getRecord(payload);
  const code = record?.code ?? record?.Code;
  if (typeof code === "number" && code !== 0) {
    throw new Error(getErrorMessage(payload, fallback));
  }
}

function getApiUrl(baseUrl: string, path: string) {
  return `${trimTrailingSlash(baseUrl)}${path}`;
}

function resolveLoginToken(payload: unknown) {
  const record = getRecord(payload);
  const data = record?.data ?? record?.Data;
  const token =
    pickString(payload, ["token", "access_token", "accessToken"]) ??
    pickString(data, ["token", "access_token", "accessToken"]);

  if (!token) {
    throw new Error("登录接口未返回有效 Token");
  }
  return token;
}

function resolveCurrentUser(payload: unknown): CurrentUser {
  const record = getRecord(payload);
  const data = getRecord(record?.data ?? record?.Data ?? payload);
  if (!data || (typeof data.id !== "number" && typeof data.id !== "string")) {
    throw new Error("当前用户接口返回格式无效");
  }

  return {
    id: data.id,
    username: typeof data.username === "string" ? data.username : "",
    nickname: typeof data.nickname === "string" ? data.nickname : null,
    email: typeof data.email === "string" ? data.email : null,
    roles: Array.isArray(data.roles) ? (data.roles as CurrentUser["roles"]) : [],
    status: typeof data.status === "number" ? data.status : 0,
    tags: Array.isArray(data.tags) ? (data.tags as CurrentUser["tags"]) : [],
    created_at: typeof data.created_at === "number" ? data.created_at : 0
  };
}

export async function loginWithPassword(credentials: LoginCredentials) {
  const response = await fetch(getApiUrl(runtimeConfig.authApiBaseUrl, "/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(credentials)
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new AuthRequestError(getErrorMessage(payload, "登录失败，请检查账号或密码"), response.status);
  }
  ensureSuccessfulPayload(payload, "登录失败，请检查账号或密码");
  return resolveLoginToken(payload);
}

export async function getCurrentUser(token: string, userId: string, signal?: AbortSignal) {
  const response = await fetch(getApiUrl(runtimeConfig.userApiBaseUrl, `/users/${userId}`), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    },
    signal
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new AuthRequestError(getErrorMessage(payload, "当前用户加载失败"), response.status);
  }
  ensureSuccessfulPayload(payload, "当前用户加载失败");
  return resolveCurrentUser(payload);
}
