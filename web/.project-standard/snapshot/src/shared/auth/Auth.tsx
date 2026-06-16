import type { PropsWithChildren } from "react";

import { useAuth } from "./authContext";

interface AuthProps extends PropsWithChildren {
  permission?: string;
  fallback?: React.ReactNode;
}

export function Auth({ permission, fallback = null, children }: AuthProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
