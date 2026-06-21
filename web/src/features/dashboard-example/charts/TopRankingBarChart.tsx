import type { EChartsOption } from "echarts";
import { useMemo } from "react";

import type { DashboardRankingItem } from "../api/dashboardTypes";
import { BaseEChart } from "../components/BaseEChart";
import { ChartCard } from "../components/ChartCard";
import { chartPalette } from "./chartColors";

interface TopRankingBarChartProps {
  data?: DashboardRankingItem[];
  loading?: boolean;
  error?: boolean;
  height?: number;
}

function truncateName(name: string) {
  return name.length > 8 ? `${name.slice(0, 8)}...` : name;
}

export function TopRankingBarChart({
  data = [],
  loading,
  error,
  height = 340
}: TopRankingBarChartProps) {
  const sortedData = useMemo(
    () => [...data].sort((a, b) => b.value - a.value).slice(0, 10),
    [data]
  );
  const empty = !loading && !error && sortedData.length === 0;
  const option = useMemo<EChartsOption>(
    () => ({
      color: [chartPalette.ranking],
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params;
          const source = sortedData[item.dataIndex];
          return `${source.name}<br />运行次数：${source.value.toLocaleString()}`;
        }
      },
      grid: { top: 8, right: 28, bottom: 16, left: 104 },
      xAxis: {
        type: "value",
        axisLabel: { color: chartPalette.axis },
        splitLine: { lineStyle: { color: chartPalette.splitLine } }
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: sortedData.map((item) => truncateName(item.name)),
        axisLabel: { color: chartPalette.axis },
        axisTick: { show: false },
        axisLine: { show: false }
      },
      series: [
        {
          name: "运行次数",
          type: "bar",
          barMaxWidth: 18,
          itemStyle: {
            borderRadius: [0, 6, 6, 0],
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: "rgba(37, 99, 235, 0.58)" },
                { offset: 1, color: chartPalette.ranking }
              ]
            }
          },
          data: sortedData.map((item) => item.value)
        }
      ]
    }),
    [sortedData]
  );

  return (
    <ChartCard
      className="chart-card--subtle"
      title="TopN 排名"
      description="模块运行次数排行"
      extra={<span className="chart-card__badge">Top 10</span>}
      height={height}
      skeletonType="horizontalBar"
      loading={loading}
      empty={empty}
      error={error}
      errorMessage="排名数据加载失败"
    >
      <BaseEChart option={option} height={height} loading={loading} empty={empty} error={error} />
    </ChartCard>
  );
}
