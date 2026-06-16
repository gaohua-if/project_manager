// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the pattern, not the mock data.

import { api } from "@/shared/request/httpClient";
import { normalizePageResult } from "@/shared/request/pageResult";

import type { PageResult, ResourceFormValues, ResourceListQuery, ResourceRecord } from "./types";

interface BackendListParams {
  page: number;
  pageSize: number;
  search?: string;
  state?: string;
  priority?: string;
  orderBy?: string;
  orderType?: "asc" | "desc";
}

function toBackendListParams(query: ResourceListQuery): BackendListParams {
  return {
    page: query.page_num,
    pageSize: query.page_size,
    search: query.keyword,
    state: query.status,
    priority: query.priority,
    orderBy: query.order_by,
    orderType: query.order_type
  };
}

export const resourceApi = {
  async list(query: ResourceListQuery) {
    const response = await api.get<unknown>(
      "/resources",
      toBackendListParams(query)
    );
    const data: PageResult<ResourceRecord> = normalizePageResult<ResourceRecord>(
      response.data,
      query
    );
    return { ...response, data };
  },
  detail(id: string) {
    return api.get<ResourceRecord>(`/resources/${id}`);
  },
  create(values: ResourceFormValues) {
    return api.post<ResourceRecord>("/resources", values);
  },
  update(id: string, values: ResourceFormValues) {
    return api.put<ResourceRecord>(`/resources/${id}`, values);
  },
  delete(id: string) {
    return api.delete<null>(`/resources/${id}`);
  }
};
