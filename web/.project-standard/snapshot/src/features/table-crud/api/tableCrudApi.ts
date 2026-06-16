import { runtimeConfig } from "@/config/runtimeConfig";
import { api } from "@/shared/request/httpClient";

import { tableCrudMockApi } from "./tableCrudMockApi";
import type { PageResult, TableResource, TableResourceFormValues, TableResourceListParams } from "./tableCrudTypes";

export const tableCrudKeys = {
  all: ["table-crud"] as const,
  lists: () => [...tableCrudKeys.all, "list"] as const,
  list: (params: TableResourceListParams) => [...tableCrudKeys.lists(), params] as const,
  details: () => [...tableCrudKeys.all, "detail"] as const,
  detail: (id: string) => [...tableCrudKeys.details(), id] as const
};

export const tableCrudApi = {
  list: (params: TableResourceListParams) =>
    runtimeConfig.enableMock
      ? tableCrudMockApi.list(params)
      : api.get<PageResult<TableResource>>("/examples/table-crud", params),
  detail: (id: string) =>
    runtimeConfig.enableMock
      ? tableCrudMockApi.detail(id)
      : api.get<TableResource>(`/examples/table-crud/${id}`),
  create: (values: TableResourceFormValues) =>
    runtimeConfig.enableMock
      ? tableCrudMockApi.create(values)
      : api.post<TableResource>("/examples/table-crud", values),
  update: (id: string, values: TableResourceFormValues) =>
    runtimeConfig.enableMock
      ? tableCrudMockApi.update(id, values)
      : api.put<TableResource>(`/examples/table-crud/${id}`, values),
  delete: (id: string) =>
    runtimeConfig.enableMock
      ? tableCrudMockApi.delete(id)
      : api.delete<null>(`/examples/table-crud/${id}`)
};
