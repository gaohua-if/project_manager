export interface PageQueryFallback {
  page_num: number;
  page_size: number;
}

export interface PageResult<T> {
  page_num: number;
  page_size: number;
  total: number;
  data: T[];
}

interface PagePayload {
  [key: string]: unknown;
}

const DEFAULT_ARRAY_KEYS = ["list", "items", "records", "rows", "data"] as const;

function isRecord(value: unknown): value is PagePayload {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function pickFirstArray<T>(payload: PagePayload, keys: readonly string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

function pickFirstNumber(payload: PagePayload, keys: readonly string[], fallback: number) {
  for (const key of keys) {
    const value = payload[key];
    const parsed = toNumber(value, Number.NaN);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function normalizePageResult<T>(
  payload: unknown,
  query: PageQueryFallback,
  options?: { arrayKeys?: readonly string[] }
): PageResult<T> {
  if (Array.isArray(payload)) {
    return {
      page_num: query.page_num,
      page_size: query.page_size,
      total: payload.length,
      data: payload as T[]
    };
  }

  if (!isRecord(payload)) {
    return {
      page_num: query.page_num,
      page_size: query.page_size,
      total: 0,
      data: []
    };
  }

  const data = pickFirstArray<T>(payload, options?.arrayKeys ?? DEFAULT_ARRAY_KEYS);

  return {
    page_num: pickFirstNumber(payload, ["page_num", "pageNum", "page"], query.page_num),
    page_size: pickFirstNumber(payload, ["page_size", "pageSize", "size"], query.page_size),
    total: pickFirstNumber(payload, ["total", "count", "totalCount"], data.length),
    data
  };
}
