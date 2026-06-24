import type { ReactNode } from "react";

import "./RequirementMetricCard.css";

export type RequirementMetricTone = "primary" | "success" | "warning" | "danger" | "info";

export interface RequirementMetric {
  key: string;
  title: string;
  value: ReactNode;
  description: string;
}

export function RequirementMetricGrid({ children }: { children: ReactNode }) {
  return <section className="requirements-metric-grid">{children}</section>;
}

export function RequirementMetricCard({
  metric,
  icon,
  tone = "primary",
  loading = false
}: {
  metric: RequirementMetric;
  icon: ReactNode;
  tone?: RequirementMetricTone;
  loading?: boolean;
}) {
  return (
    <article className={`requirements-metric-card requirements-metric-card--tone-${tone}`}>
      {loading ? (
        <>
          <div className="requirements-metric-card__header">
            <span className="requirements-metric-card__skeleton requirements-metric-card__skeleton--title" />
            <span className="requirements-metric-card__skeleton requirements-metric-card__skeleton--icon" />
          </div>
          <span className="requirements-metric-card__skeleton requirements-metric-card__skeleton--value" />
          <span className="requirements-metric-card__skeleton requirements-metric-card__skeleton--line" />
        </>
      ) : (
        <>
          <div className="requirements-metric-card__header">
            <span className="requirements-metric-card__title">{metric.title}</span>
            <span className="requirements-metric-card__icon" aria-hidden="true">
              {icon}
            </span>
          </div>
          <strong className="requirements-metric-card__value">{metric.value}</strong>
          <span className="requirements-metric-card__description">{metric.description}</span>
        </>
      )}
    </article>
  );
}
