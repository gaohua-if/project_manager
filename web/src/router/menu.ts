import type { User } from "@/shared/auth/types";

import { appRoutes } from "./routes";
import { hasRouteRole } from "./routeAccess";
import type { AppRoute } from "./types";

export const menuRoutes = appRoutes.filter((route) => !route.hideInMenu);

export function getMenuRoutesForUser(routes: AppRoute[], user: User | null): AppRoute[] {
  return routes
    .filter((route) => !route.hideInMenu && hasRouteRole(route, user))
    .map((route) => ({
      ...route,
      children: route.children ? getMenuRoutesForUser(route.children, user) : undefined
    }));
}
