import type { ApiResponse } from "@/shared/request/types";
import {
  assertUniqueName,
  compareValue,
  createPageResult,
  MockApiError,
  nowIso,
  wait
} from "@/shared/mock/mockApi";

import type {
  PageResult,
  TableResource,
  TableResourceFormValues,
  TableResourceListParams,
  TableResourcePriority,
  TableResourceStatus
} from "./tableCrudTypes";

const statuses: TableResourceStatus[] = ["running", "paused", "failed", "draft"];
const priorities: TableResourcePriority[] = ["high", "normal", "low"];
const owners = ["平台组", "算法组", "工程组", "数据组"];
const regions = ["华北一区", "华东一区", "华南一区"];

let tableResources: TableResource[] = Array.from({ length: 48 }, (_, index) => {
  const updatedAt = new Date(Date.now() - index * 42e5).toISOString();
  return {
    id: `table-${index + 1}`,
    name: `表格资源 ${String(index + 1).padStart(2, "0")}`,
    owner: owners[index % owners.length],
    status: statuses[index % statuses.length],
    priority: priorities[index % priorities.length],
    region: regions[index % regions.length],
    quota: (index % 8) + 1,
    enabled: index % 5 !== 0,
    tags: index % 2 === 0 ? ["训练", "GPU"] : ["推理"],
    envs: [
      {
        key: "RUNTIME_ENV",
        is_optional: false,
        description: "资源运行环境"
      },
      {
        key: "MAX_WORKERS",
        is_optional: true,
        description: "并发 worker 数"
      }
    ],
    effectiveDate: "2026-06-01",
    description: "用于验证标准 Table CRUD 的数据流、异常和表单边界。",
    attachment: null,
    createdAt: updatedAt,
    updatedAt
  };
});

function normalize(values: TableResourceFormValues) {
  return {
    ...values,
    tags: values.tags ?? [],
    envs: values.envs ?? [],
    attachment: values.attachment instanceof File ? values.attachment.name : values.attachment
  };
}

export const tableCrudMockApi = {
  async list(params: TableResourceListParams): Promise<ApiResponse<PageResult<TableResource>>> {
    await wait();
    let rows = [...tableResources];
    const keyword = params.keyword?.trim().toLowerCase();

    if (keyword) {
      rows = rows.filter((item) =>
        `${item.name} ${item.owner} ${item.description ?? ""}`.toLowerCase().includes(keyword)
      );
    }

    if (params.status) rows = rows.filter((item) => item.status === params.status);
    if (params.priority) rows = rows.filter((item) => item.priority === params.priority);

    if (params.order_by) {
      rows.sort((a, b) => compareValue(
        a[params.order_by as keyof TableResource] as string | number | undefined,
        b[params.order_by as keyof TableResource] as string | number | undefined,
        params.order_type
      ));
    }

    return {
      code: 0,
      msg: "success",
      data: createPageResult(rows, params.page_num, params.page_size)
    };
  },

  async detail(id: string): Promise<ApiResponse<TableResource>> {
    await wait();
    const item = tableResources.find((resource) => resource.id === id);
    if (!item) throw new MockApiError("资源不存在或已被删除", { status: 404 });
    return { code: 0, msg: "success", data: item };
  },

  async create(values: TableResourceFormValues): Promise<ApiResponse<TableResource>> {
    await wait();
    assertUniqueName(tableResources, values.name);
    assertQuotaPriority(values);
    const timestamp = nowIso();
    const next: TableResource = {
      ...normalize(values),
      id: `table-${Date.now()}`,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    tableResources = [next, ...tableResources];
    return { code: 0, msg: "success", data: next };
  },

  async update(id: string, values: TableResourceFormValues): Promise<ApiResponse<TableResource>> {
    await wait();
    if (!tableResources.some((item) => item.id === id)) {
      throw new MockApiError("资源不存在或已被删除", { status: 404 });
    }
    assertUniqueName(tableResources, values.name, id);
    assertQuotaPriority(values);
    const current = tableResources.find((item) => item.id === id)!;
    const next: TableResource = {
      ...current,
      ...normalize(values),
      updatedAt: nowIso()
    };
    tableResources = tableResources.map((item) => (item.id === id ? next : item));
    return { code: 0, msg: "success", data: next };
  },

  async delete(id: string): Promise<ApiResponse<null>> {
    await wait();
    if (!tableResources.some((item) => item.id === id)) {
      throw new MockApiError("资源不存在或已被删除", { status: 404 });
    }
    tableResources = tableResources.filter((item) => item.id !== id);
    return { code: 0, msg: "success", data: null };
  }
};

function assertQuotaPriority(values: TableResourceFormValues) {
  if (values.quota > 8 && values.priority !== "high") {
    throw new MockApiError("配额超过 8 时优先级必须为高", {
      status: 422,
      fieldErrors: [{ field: "priority", message: "高配额资源必须选择高优先级" }]
    });
  }
}
