// Copy this file and dashboard-pattern.css into the business feature.

import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from "@ant-design/icons";
import { Alert, Card, Empty, Skeleton } from "antd";
import type { ReactNode } from "react";

import "./dashboard-pattern.css";

export interface DashboardMetric {
  key: string;
  title: string;
  value: ReactNode;
  description?: string;
  trend?: string;
  trendDirection?: "up" | "down" | "flat";
  status?: "normal" | "warning" | "danger";
}

export type DashboardMetricTone = "primary" | "success" | "warning" | "danger" | "info";

const trendIcons = {
  up: <ArrowUpOutlined />,
  down: <ArrowDownOutlined />,
  flat: <MinusOutlined />
};

export function DashboardMetricCard({
  metric,
  loading = false,
  icon,
  tone = "primary"
}: {
  metric: DashboardMetric;
  loading?: boolean;
  icon?: ReactNode;
  tone?: DashboardMetricTone;
}) {
  const direction = metric.trendDirection ?? "flat";

  return (
    <article
      className={[
        "business-metric-card",
        `business-metric-card--${metric.status ?? "normal"}`,
        `business-metric-card--tone-${tone}`
      ].join(" ")}
    >
      {loading ? (
        <>
          <div className="business-metric-card__header">
            <span className="business-metric-card__skeleton business-metric-card__skeleton--title" />
            <span className="business-metric-card__skeleton business-metric-card__skeleton--icon" />
          </div>
          <span className="business-metric-card__skeleton business-metric-card__skeleton--value" />
          <span className="business-metric-card__skeleton business-metric-card__skeleton--line" />
        </>
      ) : (
        <>
          <div className="business-metric-card__header">
            <div className="business-metric-card__title">{metric.title}</div>
            {icon && (
              <span className="business-metric-card__icon" aria-hidden="true">
                {icon}
              </span>
            )}
          </div>
          <div className="business-metric-card__value">{metric.value}</div>
          <div className="business-metric-card__meta">
            <span>{metric.description}</span>
            {metric.trend && (
              <em className={`business-metric-card__trend is-${direction}`}>
                {trendIcons[direction]}
                {metric.trend}
              </em>
            )}
          </div>
        </>
      )}
    </article>
  );
}

interface DashboardChartCardProps {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  error?: boolean;
  children: ReactNode;
}

export function DashboardChartCard({
  title,
  description,
  extra,
  loading = false,
  empty = false,
  error = false,
  children
}: DashboardChartCardProps) {
  return (
    <Card
      className="business-chart-card"
      title={
        <div className="business-chart-card__title">
          <span>{title}</span>
          {description && <small>{description}</small>}
        </div>
      }
      extra={extra}
    >
      {error ? (
        <div className="business-chart-card__state">
          <Alert type="error" showIcon message="数据加载失败" />
        </div>
      ) : empty ? (
        <div className="business-chart-card__state">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
        </div>
      ) : loading ? (
        <div className="business-chart-card__state">
          <Skeleton active paragraph={{ rows: 6 }} title={false} />
        </div>
      ) : (
        children
      )}
    </Card>
  );
}

export function DashboardMetricGrid({ children }: { children: ReactNode }) {
  return <section className="business-metric-grid">{children}</section>;
}

export function DashboardChartGrid({ children }: { children: ReactNode }) {
  return <section className="business-chart-grid">{children}</section>;
}
