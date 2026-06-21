import type { EChartsOption } from "echarts";
import { useMemo } from "react";

import type { DashboardResourceUsageItem } from "../api/dashboardTypes";
import { BaseEChart } from "../components/BaseEChart";
import { ChartCard } from "../components/ChartCard";
import { chartPalette } from "./chartColors";

interface ResourceUsageBarChartProps {
  data?: DashboardResourceUsageItem[];
  loading?: boolean;
  error?: boolean;
  height?: number;
}

export function ResourceUsageBarChart({
  data = [],
  loading,
  error,
  height = 340
}: ResourceUsageBarChartProps) {
  const empty = !loading && !error && data.length === 0;
  const option = useMemo<EChartsOption>(
    () => ({
      color: [chartPalette.cpu, chartPalette.memory, chartPalette.storage],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (value) => `${value}%`
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: chartPalette.legend },
        data: ["CPU", "Memory", "Storage"]
      },
      grid: { top: 42, right: 18, bottom: 34, left: 44 },
      xAxis: {
        type: "category",
        data: data.map((item) => item.name),
        axisLabel: { color: chartPalette.axis },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: chartPalette.splitLine } }
      },
      yAxis: {
        type: "value",
        max: 100,
        axisLabel: { color: chartPalette.axis, formatter: "{value}%" },
        splitLine: { lineStyle: { color: chartPalette.splitLine } }
      },
      series: [
        {
          name: "CPU",
          type: "bar",
          barMaxWidth: 16,
          itemStyle: { borderRadius: [6, 6, 0, 0] },
          data: data.map((item) => item.cpu)
        },
        {
          name: "Memory",
          type: "bar",
          barMaxWidth: 16,
          itemStyle: { borderRadius: [6, 6, 0, 0] },
          data: data.map((item) => item.memory)
        },
        {
          name: "Storage",
          type: "bar",
          barMaxWidth: 16,
          itemStyle: { borderRadius: [6, 6, 0, 0] },
          data: data.map((item) => item.storage)
        }
      ]
    }),
    [data]
  );

  return (
    <ChartCard
      className="chart-card--subtle"
      title="资源使用"
      description="集群 CPU、内存、存储使用率"
      extra={<span className="chart-card__badge">Realtime mix</span>}
      height={height}
      skeletonType="groupedBar"
      loading={loading}
      empty={empty}
      error={error}
      errorMessage="资源使用加载失败"
    >
      <BaseEChart option={option} height={height} loading={loading} empty={empty} error={error} />
    </ChartCard>
  );
}
