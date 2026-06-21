import { runtimeConfig } from "@/config/runtimeConfig";

import type { LoginCredentials, LoginResponse, RegisterPayload, User } from "./types";

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

function getApiUrl(baseUrl: string, path: string) {
  return `${trimTrailingSlash(baseUrl)}${path}`;
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

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
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

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  return pickString(payload, ["message", "msg", "error"]) ?? fallback;
}

function resolveUser(payload: unknown): User {
  const record = getRecord(payload);
  if (!record) {
    throw new Error("登录响应格式无效");
  }
  const id = pickString(record, ["id"]);
  if (!id) {
    throw new Error("登录响应缺少用户 ID");
  }
  return {
    id,
    employee_id: pickString(record, ["employee_id"]) ?? "",
    email: pickString(record, ["email"]) ?? "",
    name: pickString(record, ["name"]) ?? "",
    role: (pickString(record, ["role"]) ?? "employee") as User["role"],
    team_id: pickString(record, ["team_id"]) ?? null,
    team_name: pickString(record, ["team_name"]) ?? null,
    created_at: pickString(record, ["created_at"]) ?? undefined
  };
}

function resolveLoginResponse(payload: unknown): LoginResponse {
  const record = getRecord(payload) ?? {};
  const recordData = getRecord(record.data);
  const token = pickString(record, ["token"]) ?? pickString(recordData, ["token"]);
  if (!token) {
    throw new Error("登录响应缺少 Token");
  }
  const userRecordFromTop = getRecord(record.user);
  const userRecordFromData = getRecord(recordData?.user);
  const userPayload: unknown = userRecordFromTop ?? userRecordFromData ?? recordData ?? record;
  return { token, user: resolveUser(userPayload) };
}

export async function loginWithPassword(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch(getApiUrl(runtimeConfig.authApiBaseUrl, "/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  });
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new AuthRequestError(
      getErrorMessage(payload, "登录失败，请检查工号或密码"),
      response.status
    );
  }
  return resolveLoginResponse(payload);
}

export async function registerUser(payload: RegisterPayload): Promise<LoginResponse> {
  const response = await fetch(getApiUrl(runtimeConfig.authApiBaseUrl, "/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await readPayload(response);
  if (!response.ok) {
    throw new AuthRequestError(getErrorMessage(body, "注册失败"), response.status);
  }
  return resolveLoginResponse(body);
}

export async function fetchCurrentUser(token: string, signal?: AbortSignal): Promise<User> {
  const response = await fetch(getApiUrl(runtimeConfig.userApiBaseUrl, "/auth/me"), {
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
  return resolveUser(payload);
}
