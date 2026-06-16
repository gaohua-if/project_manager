import { Alert } from "antd";
import type { EChartsOption } from "echarts";
import { useMemo } from "react";

import { BaseEChart } from "@/shared/charts/BaseEChart";

import { formatTokens } from "./shared";
import type { TeamStat, TokenGroup, TokenPoint } from "../api/types";

// ───────────────────────── AlertBanner ─────────────────────────

export function AlertBanner({
  level,
  children
}: {
  level: "danger" | "warning" | "info";
  children: React.ReactNode;
}) {
  return (
    <Alert
      type={level === "danger" ? "error" : level}
      showIcon
      message={children}
      style={{ marginTop: 16 }}
    />
  );
}

// ───────────────────────── TokenTrendChart ─────────────────────────

export function TokenTrendChart({ series, height = 140 }: { series: TokenPoint[]; height?: number }) {
  const empty = series.length === 0;
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: "axis",
        valueFormatter: (v) => formatTokens(Number(v))
      },
      grid: { top: 10, right: 12, bottom: 24, left: 40 },
      xAxis: {
        type: "category",
        data: series.map((p) => p.date.slice(5)),
        axisLabel: { fontSize: 10 },
        axisTick: { show: false }
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 10, formatter: (v: number) => formatTokens(v) },
        splitLine: { lineStyle: { color: "#f0f0f0" } }
      },
      series: [
        {
          type: "bar",
          data: series.map((p) => p.value),
          itemStyle: { color: "#1677ff", borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 22
        }
      ]
    }),
    [series]
  );
  return <BaseEChart option={option} height={height} empty={empty} />;
}

// ───────────────────────── TokenDistributionPie ─────────────────────────

const PIE_COLORS = ["#1677ff", "#722ed1", "#52c41a", "#faad14", "#ff4d4f", "#13c2c2", "#fa8c16", "#8c8c8c"];

export function TokenDistributionPie({
  groups,
  centerLabel,
  height = 180
}: {
  groups: TokenGroup[];
  centerLabel?: string;
  height?: number;
}) {
  const empty = !groups || groups.length === 0;
  const total = groups.reduce((s, g) => s + g.value, 0);
  const option = useMemo<EChartsOption>(
    () => ({
      color: PIE_COLORS,
      tooltip: {
        trigger: "item",
        formatter: (p: unknown) => {
          const item = p as { name: string; value: number; percent: number };
          return `${item.name}<br/>${formatTokens(item.value)} (${item.percent}%)`;
        }
      },
      legend: {
        type: "scroll",
        orient: "vertical",
        right: 0,
        top: "center",
        textStyle: { fontSize: 12 },
        formatter: (name: string) => {
          const g = groups.find((x) => x.label === name);
          return g ? `${name}  ${g.percent.toFixed(0)}%` : name;
        }
      },
      series: [
        {
          type: "pie",
          radius: ["55%", "85%"],
          center: ["38%", "50%"],
          avoidLabelOverlap: true,
          label: { show: false },
          labelLine: { show: false },
          data: groups.map((g) => ({ name: g.label, value: g.value, percent: g.percent }))
        }
      ],
      graphic: empty
        ? undefined
        : {
            type: "text",
            left: "38%",
            top: "center",
            style: {
              text: centerLabel || formatTokens(total),
              textAlign: "center",
              fill: "#1f2937",
              fontSize: 14,
              fontWeight: 700,
              textVerticalAlign: "middle"
            },
            z: 10
          }
    }),
    [centerLabel, empty, groups, total]
  );
  return <BaseEChart option={option} height={height} empty={empty} />;
}

// ───────────────────────── TeamActivityBars ─────────────────────────

const TEAM_COLORS = ["#1677ff", "#722ed1", "#52c41a"];

export function TeamActivityBars({ teams }: { teams: TeamStat[] }) {
  if (!teams || teams.length === 0) {
    return <div style={{ padding: 24, textAlign: "center", color: "#9ca3af", fontSize: 12 }}>暂无团队</div>;
  }
  const maxTotal = Math.max(...teams.map((t) => t.total), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", minHeight: 110 }}>
      {teams.map((t, i) => {
        const h = (t.total / maxTotal) * 80;
        const activeH = t.total > 0 ? (t.active / t.total) * h : 0;
        return (
          <div key={t.team_id} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 80 }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                height: 80,
                width: 44
              }}
            >
              <div
                style={{
                  width: "100%",
                  borderRadius: "4px 4px 0 0",
                  height: `${h}px`,
                  background: "#e5e7eb"
                }}
                title={`${t.active}/${t.total}`}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  width: "100%",
                  borderRadius: "4px 4px 0 0",
                  height: `${activeH}px`,
                  background: TEAM_COLORS[i % TEAM_COLORS.length]
                }}
              />
            </div>
            <div style={{ marginTop: 8, textAlign: "center", fontSize: 12 }}>
              <div style={{ color: "#1f2937" }}>{t.team_name}</div>
              <div style={{ marginTop: 2 }}>
                <span style={{ color: "#52c41a", fontWeight: 600 }}>{t.active}</span>
                <span style={{ color: "#9ca3af" }}>/{t.total}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
