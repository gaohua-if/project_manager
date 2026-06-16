import { Skeleton } from "antd";

import "./AuthLoadingState.css";

export function AuthLoadingState() {
  return (
    <div className="auth-loading" role="status" aria-label="正在恢复登录状态">
      <div className="auth-loading__progress" aria-hidden="true" />
      <div className="auth-loading__heading">
        <Skeleton.Input active size="small" className="auth-loading__title" />
        <Skeleton.Button active size="small" />
      </div>
      <div className="auth-loading__metrics">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="auth-loading__metric" key={index}>
            <Skeleton active title={{ width: "42%" }} paragraph={{ rows: 1, width: "68%" }} />
          </div>
        ))}
      </div>
      <div className="auth-loading__surface">
        <Skeleton active title={{ width: "24%" }} paragraph={{ rows: 6 }} />
      </div>
    </div>
  );
}
