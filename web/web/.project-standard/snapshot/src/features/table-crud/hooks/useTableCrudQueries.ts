import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { feedback } from "@/shared/feedback/feedback";

import { tableCrudApi, tableCrudKeys } from "../api/tableCrudApi";
import type { TableResourceFormValues, TableResourceListParams } from "../api/tableCrudTypes";

export function useTableResourceList(params: TableResourceListParams) {
  return useQuery({
    queryKey: tableCrudKeys.list(params),
    queryFn: () => tableCrudApi.list(params),
    placeholderData: keepPreviousData
  });
}

export function useTableResourceDetail(id?: string) {
  return useQuery({
    queryKey: tableCrudKeys.detail(id ?? ""),
    queryFn: () => tableCrudApi.detail(id ?? ""),
    enabled: Boolean(id),
    retry: false
  });
}

export function useCreateTableResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: TableResourceFormValues) => tableCrudApi.create(values),
    onSuccess: () => {
      feedback.message()?.success("创建成功");
      void queryClient.invalidateQueries({ queryKey: tableCrudKeys.lists() });
    }
  });
}

export function useUpdateTableResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: TableResourceFormValues }) =>
      tableCrudApi.update(id, values),
    onSuccess: (_result, variables) => {
      feedback.message()?.success("保存成功");
      void queryClient.invalidateQueries({ queryKey: tableCrudKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: tableCrudKeys.detail(variables.id) });
    }
  });
}

export function useDeleteTableResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tableCrudApi.delete(id),
    onSuccess: () => {
      feedback.message()?.success("删除成功");
      void queryClient.invalidateQueries({ queryKey: tableCrudKeys.lists() });
    }
  });
}
