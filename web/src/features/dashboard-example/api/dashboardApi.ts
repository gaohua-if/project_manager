import { runtimeConfig } from "@/config/runtimeConfig";
import { api } from "@/shared/request/httpClient";

import { dashboardMockApi } from "./dashboardMockApi";
import type { DashboardFilters, DashboardOverview } from "./dashboardTypes";

export const dashboardKeys = {
  all: ["dashboard-example"] as const,
  overview: (filters: DashboardFilters) => [...dashboardKeys.all, "overview", filters] as const
};

export const dashboardApi = {
  overview: (filters: DashboardFilters) =>
    runtimeConfig.enableMock
      ? dashboardMockApi.overview(filters)
      : api.get<DashboardOverview>("/examples/dashboard/overview", filters)
};
