import type { ApiResponse } from "@/shared/request/types";

import type {
  DashboardFilters,
  DashboardOverview,
  DashboardRankingItem,
  DashboardResourceUsageItem,
  DashboardStatusItem,
  DashboardTrendPoint
} from "./dashboardTypes";

const owners = ["平台组", "算法组", "数据组"];
const categories = ["training", "evaluation", "inference"];

function wait(ms = 360) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getDateRange(filters: DashboardFilters) {
  const start = new Date(filters.start_date);
  const end = new Date(filters.end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 90) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function filterSeed(filters: DashboardFilters) {
  const categoryOffset = filters.category ? categories.indexOf(filters.category) + 1 : 2;
  const ownerOffset = filters.owner ? owners.indexOf(filters.owner) + 1 : 2;
  return Math.max(1, categoryOffset + ownerOffset);
}

function buildTrend(filters: DashboardFilters): DashboardTrendPoint[] {
  const seed = filterSeed(filters);
  return getDateRange(filters).map((date, index) => ({
    date,
    succeeded: 110 + seed * 12 + index * 9 + (index % 3) * 18,
    failed: 8 + seed * 2 + (index % 4) * 3,
    processing: 22 + seed * 3 + (index % 5) * 4
  }));
}

function buildStatus(trend: DashboardTrendPoint[]): DashboardStatusItem[] {
  const succeeded = trend.reduce((total, item) => total + item.succeeded, 0);
  const failed = trend.reduce((total, item) => total + item.failed, 0);
  const processing = trend.reduce((total, item) => total + item.processing, 0);
  const pending = Math.round((succeeded + failed + processing) * 0.08);

  return [
    { status: "succeeded", label: "成功", value: succeeded },
    { status: "failed", label: "失败", value: failed },
    { status: "processing", label: "处理中", value: processing },
    { status: "pending", label: "等待中", value: pending }
  ];
}

function buildRanking(seed: number): DashboardRankingItem[] {
  return [
    "图像训练模块",
    "语音识别模块",
    "数据清洗模块",
    "模型评估模块",
    "向量检索模块",
    "报告生成模块",
    "批量推理模块",
    "特征抽取模块"
  ]
    .map((name, index) => ({ name, value: 480 - index * 37 + seed * 16 + (index % 2) * 20 }))
    .sort((a, b) => b.value - a.value);
}

function buildUsage(seed: number): DashboardResourceUsageItem[] {
  return ["训练集群", "推理集群", "评估集群", "数据集群", "报告集群"].map((name, index) => ({
    name,
    cpu: 48 + seed * 3 + index * 5,
    memory: 52 + seed * 2 + index * 4,
    storage: 38 + seed * 4 + index * 6
  }));
}

export const dashboardMockApi = {
  async overview(filters: DashboardFilters): Promise<ApiResponse<DashboardOverview>> {
    await wait();
    const trend = buildTrend(filters);
    const statusDistribution = buildStatus(trend);
    const seed = filterSeed(filters);
    const totalTasks = statusDistribution.reduce((total, item) => total + item.value, 0);
    const failedTasks = statusDistribution.find((item) => item.status === "failed")?.value ?? 0;
    const successRate =
      totalTasks > 0 ? Number((((totalTasks - failedTasks) / totalTasks) * 100).toFixed(1)) : 0;

    return {
      code: 0,
      msg: "success",
      data: {
        metrics: [
          {
            key: "totalTasks",
            title: "任务总量",
            value: totalTasks,
            unit: "次",
            description: "当前筛选范围内的任务运行总数",
            trendValue: 8.6,
            trendDirection: "up"
          },
          {
            key: "successRate",
            title: "成功率",
            value: successRate,
            unit: "%",
            description: "成功任务占全部任务比例",
            trendValue: 1.8,
            trendDirection: "up",
            status: successRate < 95 ? "warning" : "normal"
          },
          {
            key: "failedTasks",
            title: "失败任务",
            value: failedTasks,
            unit: "次",
            description: "需要排查的异常任务数量",
            trendValue: 3.2,
            trendDirection: "down",
            status: failedTasks > 120 ? "danger" : "normal"
          },
          {
            key: "avgDuration",
            title: "平均耗时",
            value: 18 + seed * 2,
            unit: "分钟",
            description: "任务从排队到完成的平均时长",
            trendValue: 0.8,
            trendDirection: "flat"
          }
        ],
        trend,
        statusDistribution,
        topRanking: buildRanking(seed),
        resourceUsage: buildUsage(seed)
      }
    };
  }
};
