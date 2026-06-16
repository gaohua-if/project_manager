import type { ReactNode } from "react";

export interface AppRoute {
  path: string;
  title: string;
  element: ReactNode;
  icon?: ReactNode;
  permission?: string;
  access?: string;
  authName?: string;
  hideInMenu?: boolean;
  menuGroup?: string;
  menuOrder?: number;
  layout?: boolean;
  children?: AppRoute[];
}
