import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { feedback } from "@/shared/feedback/feedback";

import { moduleCrudApi, moduleCrudKeys } from "../api/moduleCrudApi";
import type { ModuleFormValues, ModuleListParams } from "../api/moduleCrudTypes";

export function useModuleCategories() {
  return useQuery({
    queryKey: moduleCrudKeys.categories(),
    queryFn: moduleCrudApi.categories
  });
}

export function useModuleList(params: ModuleListParams) {
  return useQuery({
    queryKey: moduleCrudKeys.list(params),
    queryFn: () => moduleCrudApi.list(params),
    placeholderData: keepPreviousData
  });
}

export function useModuleDetail(id?: string) {
  return useQuery({
    queryKey: moduleCrudKeys.detail(id ?? ""),
    queryFn: () => moduleCrudApi.detail(id ?? ""),
    enabled: Boolean(id),
    retry: false
  });
}

export function useModuleLogs(id?: string) {
  return useQuery({
    queryKey: moduleCrudKeys.logs(id ?? ""),
    queryFn: () => moduleCrudApi.logs(id ?? ""),
    enabled: Boolean(id)
  });
}

export function useCreateModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ModuleFormValues) => moduleCrudApi.create(values),
    onSuccess: () => {
      feedback.message()?.success("创建成功");
      void queryClient.invalidateQueries({ queryKey: moduleCrudKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: moduleCrudKeys.categories() });
    }
  });
}

export function useUpdateModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ModuleFormValues }) =>
      moduleCrudApi.update(id, values),
    onSuccess: (_result, variables) => {
      feedback.message()?.success("保存成功");
      void queryClient.invalidateQueries({ queryKey: moduleCrudKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: moduleCrudKeys.categories() });
      void queryClient.invalidateQueries({ queryKey: moduleCrudKeys.detail(variables.id) });
    }
  });
}

export function useDeleteModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => moduleCrudApi.delete(id),
    onSuccess: () => {
      feedback.message()?.success("删除成功");
      void queryClient.invalidateQueries({ queryKey: moduleCrudKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: moduleCrudKeys.categories() });
    }
  });
}
