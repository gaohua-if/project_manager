import { useQuery } from "@tanstack/react-query";

import { dashboardApi, dashboardKeys } from "../api/dashboardApi";
import type { DashboardFilters } from "../api/dashboardTypes";

export function useDashboardOverview(filters: DashboardFilters) {
  return useQuery({
    queryKey: dashboardKeys.overview(filters),
    queryFn: () => dashboardApi.overview(filters)
  });
}
