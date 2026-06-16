import type { PropsWithChildren } from "react";

import { useAuth } from "./authContext";
import type { UserRole } from "./types";

interface AuthProps extends PropsWithChildren {
  role?: UserRole | UserRole[];
  fallback?: React.ReactNode;
}

export function Auth({ role, fallback = null, children }: AuthProps) {
  const { hasRole } = useAuth();

  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
