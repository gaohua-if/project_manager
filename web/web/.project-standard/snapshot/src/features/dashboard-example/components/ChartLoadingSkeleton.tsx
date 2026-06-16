import "./DashboardComponents.css";

export type ChartSkeletonType = "line" | "donut" | "horizontalBar" | "groupedBar";

function SkeletonLegend({ count = 3 }: { count?: number }) {
  return (
    <div className="dashboard-chart-skeleton__legend">
      {Array.from({ length: count }).map((_, index) => (
        <span key={index} className="dashboard-skeleton dashboard-chart-skeleton__legend-item" />
      ))}
    </div>
  );
}

function SkeletonAxis() {
  return (
    <div className="dashboard-chart-skeleton__axis">
      <span className="dashboard-skeleton dashboard-chart-skeleton__axis-item" />
      <span className="dashboard-skeleton dashboard-chart-skeleton__axis-item" />
      <span className="dashboard-skeleton dashboard-chart-skeleton__axis-item" />
      <span className="dashboard-skeleton dashboard-chart-skeleton__axis-item" />
    </div>
  );
}

interface ChartLoadingSkeletonProps {
  height: number;
  type: ChartSkeletonType;
}

export function ChartLoadingSkeleton({ height, type }: ChartLoadingSkeletonProps) {
  if (type === "donut") {
    return (
      <div className="dashboard-chart-skeleton dashboard-chart-skeleton--donut" style={{ height }} aria-hidden="true">
        <div className="dashboard-chart-skeleton__donut-wrap">
          <span className="dashboard-chart-skeleton__donut" />
        </div>
        <SkeletonLegend count={4} />
      </div>
    );
  }

  if (type === "horizontalBar") {
    return (
      <div className="dashboard-chart-skeleton" style={{ height }} aria-hidden="true">
        <div className="dashboard-chart-skeleton__horizontal-plot">
          {[78, 66, 58, 50, 44, 38].map((width, index) => (
            <div key={index} className="dashboard-chart-skeleton__horizontal-row">
              <span className="dashboard-skeleton dashboard-chart-skeleton__horizontal-label" />
              <span className="dashboard-chart-skeleton__horizontal-track">
                <span className="dashboard-chart-skeleton__horizontal-fill" style={{ width: `${width}%` }} />
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-chart-skeleton" style={{ height }} aria-hidden="true">
      <SkeletonLegend />
      <div className={`dashboard-chart-skeleton__plot dashboard-chart-skeleton__plot--${type}`}>
        <span className="dashboard-chart-skeleton__grid-line" />
        <span className="dashboard-chart-skeleton__grid-line" />
        <span className="dashboard-chart-skeleton__grid-line" />
        <span className="dashboard-chart-skeleton__grid-line" />
        {type === "line" ? (
          <>
            <span className="dashboard-chart-skeleton__line-path dashboard-chart-skeleton__line-path--primary" />
            <span className="dashboard-chart-skeleton__line-path dashboard-chart-skeleton__line-path--secondary" />
            <span className="dashboard-chart-skeleton__point dashboard-chart-skeleton__point--1" />
            <span className="dashboard-chart-skeleton__point dashboard-chart-skeleton__point--2" />
            <span className="dashboard-chart-skeleton__point dashboard-chart-skeleton__point--3" />
            <span className="dashboard-chart-skeleton__point dashboard-chart-skeleton__point--4" />
          </>
        ) : (
          <>
            <span className="dashboard-chart-skeleton__bar dashboard-chart-skeleton__bar--1" />
            <span className="dashboard-chart-skeleton__bar dashboard-chart-skeleton__bar--2" />
            <span className="dashboard-chart-skeleton__bar dashboard-chart-skeleton__bar--3" />
            <span className="dashboard-chart-skeleton__bar dashboard-chart-skeleton__bar--4" />
            <span className="dashboard-chart-skeleton__bar dashboard-chart-skeleton__bar--5" />
          </>
        )}
      </div>
      <SkeletonAxis />
    </div>
  );
}
