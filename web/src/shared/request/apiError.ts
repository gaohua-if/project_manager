import { HttpError } from "./types";

export interface ApiFieldError {
  field: string | Array<string | number>;
  message: string;
}

export interface FieldErrorCarrier {
  fieldErrors?: ApiFieldError[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

function toNamePath(field: unknown): ApiFieldError["field"] | undefined {
  if (Array.isArray(field)) {
    const path = field.filter((item): item is string | number => typeof item === "string" || typeof item === "number");
    return path.length > 0 ? path : undefined;
  }

  if (typeof field !== "string" || !field) return undefined;

  return field.includes(".")
    ? field.split(".").map((item) => (/^\d+$/.test(item) ? Number(item) : item))
    : field;
}

function normalizeFieldError(item: unknown): ApiFieldError | undefined {
  if (!isRecord(item)) return undefined;

  const field = toNamePath(item.field ?? item.name ?? item.path);
  const message = item.message ?? item.msg ?? item.error;
  if (!field || typeof message !== "string" || !message) return undefined;

  return { field, message };
}

function readFieldErrors(payload: unknown): ApiFieldError[] {
  if (!isRecord(payload)) return [];

  const candidates = [
    payload.fieldErrors,
    payload.field_errors,
    payload.errors,
    isRecord(payload.data) ? payload.data.fieldErrors : undefined,
    isRecord(payload.data) ? payload.data.field_errors : undefined,
    isRecord(payload.Data) ? payload.Data.fieldErrors : undefined,
    isRecord(payload.Data) ? payload.Data.field_errors : undefined
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.map(normalizeFieldError).filter(Boolean) as ApiFieldError[];
    }

    if (isRecord(candidate)) {
      return Object.entries(candidate)
        .map(([field, message]) => normalizeFieldError({ field, message }))
        .filter(Boolean) as ApiFieldError[];
    }
  }

  return [];
}

export function getApiFieldErrors(error: unknown): ApiFieldError[] {
  if (error instanceof HttpError) {
    return readFieldErrors(error.payload);
  }

  return readFieldErrors(error);
}

export function getApiErrorMessage(error: unknown, fallback = "请求失败，请稍后重试") {
  if (error instanceof HttpError || error instanceof Error) {
    return error.message || fallback;
  }
  return fallback;
}
