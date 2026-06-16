import type { ReactNode } from "react";

import type { UserRole } from "@/shared/auth/types";

export interface AppRoute {
  path: string;
  title: string;
  element: ReactNode;
  icon?: ReactNode;
  /** Roles allowed to access this route. Undefined = any authenticated user. */
  roles?: UserRole[];
  hideInMenu?: boolean;
  menuGroup?: string;
  menuOrder?: number;
  layout?: boolean;
  children?: AppRoute[];
}
