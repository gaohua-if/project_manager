import { Button, Result } from "antd";
import { Navigate, Link } from "react-router-dom";

import { useAuth } from "@/shared/auth/authContext";
import { AuthLoadingState } from "@/shared/auth/AuthLoadingState";

import { appRoutes } from "./routes";
import { findFirstAccessibleRoute } from "./routeAccess";
import type { AppRoute } from "./types";

function hasVisibleRoute(routes: AppRoute[]): boolean {
  return routes.some((route) => !route.hideInMenu || hasVisibleRoute(route.children ?? []));
}

function EmptyProjectHome() {
  return (
    <Result
      status="info"
      title="项目已创建，暂无业务页面"
      subTitle="当前项目已保留登录、布局、权限、请求和组件基础。请根据业务需求添加路由页面。"
      extra={
        <Button type="primary">
          <Link to="/login">返回登录页</Link>
        </Button>
      }
    />
  );
}

export function FirstAccessibleRedirect() {
  const { status, isAuthenticated, error, permissions, retryCurrentUser } = useAuth();

  if (status === "initializing") {
    return <AuthLoadingState />;
  }

  if (status === "error") {
    return (
      <Result
        status="warning"
        title="当前用户加载失败"
        subTitle={error ?? "请检查网络后重试"}
        extra={
          <Button type="primary" onClick={() => void retryCurrentUser()}>
            重新加载
          </Button>
        }
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const firstPath = findFirstAccessibleRoute(appRoutes, permissions);
  if (firstPath) {
    return <Navigate to={firstPath} replace />;
  }

  if (!hasVisibleRoute(appRoutes)) {
    return <EmptyProjectHome />;
  }

  return <Navigate to="/403" replace />;
}
