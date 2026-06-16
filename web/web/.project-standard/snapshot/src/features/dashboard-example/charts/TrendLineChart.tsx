import type { EChartsOption } from "echarts";
import { useMemo } from "react";

import { BaseEChart } from "../components/BaseEChart";
import { ChartCard } from "../components/ChartCard";
import type { DashboardTrendPoint } from "../api/dashboardTypes";
import { chartPalette } from "./chartColors";

interface TrendLineChartProps {
  data?: DashboardTrendPoint[];
  loading?: boolean;
  error?: boolean;
  height?: number;
}

export function TrendLineChart({ data = [], loading, error, height = 340 }: TrendLineChartProps) {
  const empty = !loading && !error && data.length === 0;
  const option = useMemo<EChartsOption>(
    () => ({
      color: [chartPalette.succeeded, chartPalette.failed, chartPalette.processing],
      tooltip: { trigger: "axis" },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: chartPalette.legend },
        data: ["成功", "失败", "处理中"]
      },
      grid: { top: 42, right: 22, bottom: 28, left: 48 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((item) => item.date.slice(5)),
        axisLabel: { color: chartPalette.axis },
        axisLine: { lineStyle: { color: chartPalette.splitLine } },
        axisTick: { show: false }
      },
      yAxis: {
        type: "value",
        name: "任务数",
        nameTextStyle: { color: chartPalette.axis, padding: [0, 26, 0, 0] },
        axisLabel: { color: chartPalette.axis },
        splitLine: { lineStyle: { color: chartPalette.splitLine } }
      },
      series: [
        {
          name: "成功",
          type: "line",
          smooth: true,
          lineStyle: { width: 2.4 },
          areaStyle: { opacity: 0.045 },
          symbol: "circle",
          symbolSize: 4,
          data: data.map((item) => item.succeeded)
        },
        {
          name: "失败",
          type: "line",
          smooth: true,
          lineStyle: { width: 2.2 },
          symbol: "circle",
          symbolSize: 4,
          data: data.map((item) => item.failed)
        },
        {
          name: "处理中",
          type: "line",
          smooth: true,
          lineStyle: { width: 2.4 },
          areaStyle: { opacity: 0.04 },
          symbol: "circle",
          symbolSize: 4,
          data: data.map((item) => item.processing)
        }
      ]
    }),
    [data]
  );

  return (
    <ChartCard
      className="chart-card--hero"
      title="任务趋势"
      description="成功、失败、处理中任务的日期趋势"
      height={height}
      skeletonType="line"
      loading={loading}
      empty={empty}
      error={error}
      errorMessage="任务趋势加载失败"
    >
      <BaseEChart option={option} height={height} loading={loading} empty={empty} error={error} />
    </ChartCard>
  );
}
