import { runtimeConfig } from "@/config/runtimeConfig";
import { api } from "@/shared/request/httpClient";

import { moduleCrudMockApi } from "./moduleCrudMockApi";
import type { ModuleCategory, ModuleFormValues, ModuleListParams, ModuleResource, PageResult } from "./moduleCrudTypes";

export const moduleCrudKeys = {
  all: ["module-crud"] as const,
  categories: () => [...moduleCrudKeys.all, "categories"] as const,
  lists: () => [...moduleCrudKeys.all, "list"] as const,
  list: (params: ModuleListParams) => [...moduleCrudKeys.lists(), params] as const,
  details: () => [...moduleCrudKeys.all, "detail"] as const,
  detail: (id: string) => [...moduleCrudKeys.details(), id] as const,
  logs: (id: string) => [...moduleCrudKeys.detail(id), "logs"] as const
};

export const moduleCrudApi = {
  categories: () =>
    runtimeConfig.enableMock ? moduleCrudMockApi.categories() : api.get<ModuleCategory[]>("/examples/module-categories"),
  list: (params: ModuleListParams) =>
    runtimeConfig.enableMock ? moduleCrudMockApi.list(params) : api.get<PageResult<ModuleResource>>("/examples/module-crud", params),
  detail: (id: string) =>
    runtimeConfig.enableMock ? moduleCrudMockApi.detail(id) : api.get<ModuleResource>(`/examples/module-crud/${id}`),
  logs: (id: string) =>
    runtimeConfig.enableMock ? moduleCrudMockApi.logs(id) : api.get<string>(`/examples/module-crud/${id}/logs`),
  create: (values: ModuleFormValues) =>
    runtimeConfig.enableMock ? moduleCrudMockApi.create(values) : api.post<ModuleResource>("/examples/module-crud", values),
  update: (id: string, values: ModuleFormValues) =>
    runtimeConfig.enableMock ? moduleCrudMockApi.update(id, values) : api.put<ModuleResource>(`/examples/module-crud/${id}`, values),
  delete: (id: string) =>
    runtimeConfig.enableMock ? moduleCrudMockApi.delete(id) : api.delete<null>(`/examples/module-crud/${id}`)
};
