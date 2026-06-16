import { Skeleton } from "antd";

import "./PageSkeleton.css";

interface PageSkeletonProps {
  rows?: number;
}

export function PageSkeleton({ rows = 8 }: PageSkeletonProps) {
  return (
    <div className="page-skeleton">
      <Skeleton active paragraph={{ rows }} />
    </div>
  );
}
