// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the pattern, not the mock data.

import { api } from "@/shared/request/httpClient";
import { normalizePageResult } from "@/shared/request/pageResult";

import type {
  ModuleCategory,
  ModuleFormValues,
  ModuleListQuery,
  ModuleRecord,
  PageResult
} from "./types";

interface BackendModuleListParams {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  owner?: string;
  orderBy?: string;
  orderType?: "asc" | "desc";
}

function toBackendParams(query: ModuleListQuery): BackendModuleListParams {
  return {
    page: query.page_num,
    pageSize: query.page_size,
    search: query.keyword,
    categoryId: query.category_id,
    owner: query.owner,
    orderBy: query.order_by,
    orderType: query.order_type
  };
}

export const moduleApi = {
  async list(query: ModuleListQuery) {
    const response = await api.get<unknown>("/modules", toBackendParams(query));
    const data: PageResult<ModuleRecord> = normalizePageResult<ModuleRecord>(response.data, query);
    return { ...response, data };
  },
  categories() {
    return api.get<ModuleCategory[]>("/modules/categories");
  },
  detail(id: string) {
    return api.get<ModuleRecord>(`/modules/${id}`);
  },
  create(values: ModuleFormValues) {
    return api.post<ModuleRecord>("/modules", values);
  },
  update(id: string, values: ModuleFormValues) {
    return api.put<ModuleRecord>(`/modules/${id}`, values);
  },
  delete(id: string) {
    return api.delete<null>(`/modules/${id}`);
  }
};
