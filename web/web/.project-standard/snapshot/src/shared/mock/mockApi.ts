import type { ApiFieldError } from "@/shared/request/apiError";

export class MockApiError extends Error {
  status?: number;
  fieldErrors?: ApiFieldError[];

  constructor(message: string, options?: { status?: number; fieldErrors?: ApiFieldError[] }) {
    super(message);
    this.name = "MockApiError";
    this.status = options?.status;
    this.fieldErrors = options?.fieldErrors;
  }
}

export function wait(ms = 260) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function nowIso() {
  return new Date().toISOString();
}

export function createPageResult<T>(rows: T[], pageNum: number, pageSize: number) {
  const start = (pageNum - 1) * pageSize;
  return {
    page_num: pageNum,
    page_size: pageSize,
    total: rows.length,
    data: rows.slice(start, start + pageSize)
  };
}

export function compareValue(
  a: string | number | undefined,
  b: string | number | undefined,
  orderType?: string
) {
  const result =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a ?? "").localeCompare(String(b ?? ""));
  return orderType === "asc" ? result : -result;
}

export function assertUniqueName(
  rows: Array<{ id: string; name: string }>,
  name: string,
  currentId?: string
) {
  const duplicated = rows.some((item) => item.name === name && item.id !== currentId);
  if (duplicated) {
    throw new MockApiError("名称已存在", {
      status: 422,
      fieldErrors: [{ field: "name", message: "名称已存在，请修改后再提交" }]
    });
  }
}
