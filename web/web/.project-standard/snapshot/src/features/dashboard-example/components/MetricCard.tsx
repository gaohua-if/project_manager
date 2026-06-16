import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";

import type { DashboardMetric } from "../api/dashboardTypes";
import "./DashboardComponents.css";
import { useCountUp } from "./useCountUp";

export type MetricCardTone = "primary" | "success" | "warning" | "danger" | "info";

interface MetricCardProps {
  metric?: DashboardMetric;
  loading?: boolean;
  icon?: ReactNode;
  tone?: MetricCardTone;
}

const trendIcon = {
  up: <ArrowUpOutlined />,
  down: <ArrowDownOutlined />,
  flat: <MinusOutlined />
};

function formatMetricValue(value: number, sourceValue: number) {
  const normalizedValue = Number.isInteger(sourceValue)
    ? Math.round(value)
    : Number(value.toFixed(1));
  return normalizedValue.toLocaleString();
}

export function MetricCard({ metric, loading = false, icon, tone = "primary" }: MetricCardProps) {
  const animatedValue = useCountUp(metric?.value ?? 0, { disabled: loading || !metric });

  if (loading || !metric) {
    return (
      <div className={`metric-card metric-card--tone-${tone}`}>
        <div className="metric-card__title">
          <span className="dashboard-skeleton dashboard-skeleton--metric-title" />
          <span className="dashboard-skeleton dashboard-skeleton--metric-icon" />
        </div>
        <span className="dashboard-skeleton dashboard-skeleton--metric-value" />
        <span className="dashboard-skeleton dashboard-skeleton--metric-line" />
      </div>
    );
  }

  return (
    <div
      className={[
        "metric-card",
        `metric-card--${metric.status ?? "normal"}`,
        `metric-card--tone-${tone}`
      ].join(" ")}
    >
      <div className="metric-card__title">
        <span>{metric.title}</span>
        {icon && (
          <span className="metric-card__icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className="metric-card__value">
        <span>{formatMetricValue(animatedValue, metric.value)}</span>
        {metric.unit && <small>{metric.unit}</small>}
      </div>
      <div className="metric-card__meta">
        <span>{metric.description}</span>
        {metric.trendValue !== undefined && metric.trendDirection && (
          <em className={`metric-card__trend metric-card__trend--${metric.trendDirection}`}>
            {trendIcon[metric.trendDirection]}
            {metric.trendValue}%
          </em>
        )}
      </div>
    </div>
  );
}
