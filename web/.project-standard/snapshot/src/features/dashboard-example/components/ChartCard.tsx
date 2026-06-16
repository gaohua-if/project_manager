import { Alert, Card, Empty } from "antd";
import type { ReactNode } from "react";

import { ChartLoadingSkeleton } from "./ChartLoadingSkeleton";
import type { ChartSkeletonType } from "./ChartLoadingSkeleton";
import "./DashboardComponents.css";

interface ChartCardProps {
  className?: string;
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  height?: number;
  skeletonType?: ChartSkeletonType;
  loading?: boolean;
  empty?: boolean;
  error?: boolean;
  errorMessage?: string;
  children: ReactNode;
}

export function ChartCard({
  className,
  title,
  description,
  extra,
  height = 340,
  skeletonType = "groupedBar",
  loading = false,
  empty = false,
  error = false,
  errorMessage = "图表加载失败",
  children
}: ChartCardProps) {
  const content = () => {
    if (error) {
      return (
        <div className="chart-card__state" style={{ minHeight: height }}>
          <Alert type="error" showIcon message={errorMessage} />
        </div>
      );
    }
    if (empty) {
      return (
        <div className="chart-card__state" style={{ minHeight: height }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无图表数据" />
        </div>
      );
    }
    if (loading) {
      return <ChartLoadingSkeleton height={height} type={skeletonType} />;
    }
    return children;
  };

  return (
    <Card
      className={["chart-card", className].filter(Boolean).join(" ")}
      title={
        <div className="chart-card__title">
          <span>{title}</span>
          {description && <small>{description}</small>}
        </div>
      }
      extra={extra}
    >
      {content()}
    </Card>
  );
}
