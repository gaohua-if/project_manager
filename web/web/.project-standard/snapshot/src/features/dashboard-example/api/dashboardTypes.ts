export interface DashboardFilters {
  start_date: string;
  end_date: string;
  category?: string;
  owner?: string;
}

export interface DashboardMetric {
  key: string;
  title: string;
  value: number;
  unit?: string;
  description: string;
  trendValue?: number;
  trendDirection?: "up" | "down" | "flat";
  status?: "normal" | "warning" | "danger";
}

export interface DashboardTrendPoint {
  date: string;
  succeeded: number;
  failed: number;
  processing: number;
}

export interface DashboardStatusItem {
  status: "succeeded" | "failed" | "processing" | "pending";
  label: string;
  value: number;
}

export interface DashboardRankingItem {
  name: string;
  value: number;
}

export interface DashboardResourceUsageItem {
  name: string;
  cpu: number;
  memory: number;
  storage: number;
}

export interface DashboardOverview {
  metrics: DashboardMetric[];
  trend: DashboardTrendPoint[];
  statusDistribution: DashboardStatusItem[];
  topRanking: DashboardRankingItem[];
  resourceUsage: DashboardResourceUsageItem[];
}
