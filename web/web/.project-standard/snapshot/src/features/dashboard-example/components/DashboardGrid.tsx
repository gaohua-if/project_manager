import type { ReactNode } from "react";

import "./DashboardComponents.css";

export function DashboardContent({ children }: { children: ReactNode }) {
  return <div className="dashboard-content">{children}</div>;
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <section className="metric-grid">{children}</section>;
}

export function ChartGrid({ children }: { children: ReactNode }) {
  return <section className="chart-grid">{children}</section>;
}

export function ChartGridItem({
  span,
  children
}: {
  span: 4 | 6 | 8 | 12;
  children: ReactNode;
}) {
  return <div className={`chart-span-${span}`}>{children}</div>;
}
