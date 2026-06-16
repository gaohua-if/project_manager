import { Button, Result } from "antd";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/shared/auth/authContext";
import { AuthLoadingState } from "@/shared/auth/AuthLoadingState";

import { appRoutes } from "./routes";
import { findRouteByPath, hasRouteRole } from "./routeAccess";

interface RoleGuardProps {
  children: React.ReactNode;
}

export function PermissionGuard({ children }: RoleGuardProps) {
  const location = useLocation();
  const { status, isAuthenticated, error, retryCurrentUser, user } = useAuth();
  const route = findRouteByPath(location.pathname, appRoutes);

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

  if (route && !hasRouteRole(route, user)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
