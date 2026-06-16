import type { EChartsOption } from "echarts";
import { useMemo } from "react";

import type { DashboardStatusItem } from "../api/dashboardTypes";
import { BaseEChart } from "../components/BaseEChart";
import { ChartCard } from "../components/ChartCard";
import { statusChartColors } from "./chartColors";

interface StatusDonutChartProps {
  data?: DashboardStatusItem[];
  loading?: boolean;
  error?: boolean;
  height?: number;
}

export function StatusDonutChart({ data = [], loading, error, height = 340 }: StatusDonutChartProps) {
  const empty = !loading && !error && data.every((item) => item.value === 0);
  const option = useMemo<EChartsOption>(
    () => ({
      color: statusChartColors,
      tooltip: {
        trigger: "item",
        valueFormatter: (value) => `${Number(value).toLocaleString()} 次`
      },
      legend: {
        bottom: 0,
        left: "center",
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: "#64748b" }
      },
      series: [
        {
          name: "状态占比",
          type: "pie",
          radius: ["48%", "68%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: true,
          label: { formatter: "{b}\n{d}%", color: "#64748b" },
          labelLine: { length: 10, length2: 8 },
          data: data.map((item) => ({ name: item.label, value: item.value }))
        }
      ]
    }),
    [data]
  );

  return (
    <ChartCard
      className="chart-card--compact"
      title="状态占比"
      description="当前筛选范围内的任务状态分布"
      height={height}
      skeletonType="donut"
      loading={loading}
      empty={empty}
      error={error}
      errorMessage="状态占比加载失败"
    >
      <BaseEChart option={option} height={height} loading={loading} empty={empty} error={error} />
    </ChartCard>
  );
}
