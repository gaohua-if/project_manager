import { Button, Result } from "antd";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/shared/auth/authContext";
import { AuthLoadingState } from "@/shared/auth/AuthLoadingState";

import { appRoutes } from "./routes";
import { findRouteByPath } from "./routeAccess";

interface PermissionGuardProps {
  permission?: string;
  children: React.ReactNode;
}

export function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const location = useLocation();
  const { status, isAuthenticated, error, retryCurrentUser, hasPermission } = useAuth();
  const route = findRouteByPath(location.pathname, appRoutes);
  const requiredPermission = permission ?? route?.permission ?? route?.access;

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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!hasPermission(requiredPermission)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
