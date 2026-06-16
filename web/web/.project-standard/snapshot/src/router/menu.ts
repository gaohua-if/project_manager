import { appRoutes } from "./routes";
import { hasRoutePermission } from "./routeAccess";
import type { AppRoute } from "./types";

export const menuRoutes = appRoutes.filter((route) => !route.hideInMenu);

export function getMenuRoutesByPermission(
  routes: AppRoute[],
  permissions: Parameters<typeof hasRoutePermission>[1]
): AppRoute[] {
  return routes
    .filter((route) => !route.hideInMenu && hasRoutePermission(route.permission ?? route.access, permissions))
    .map((route) => ({
      ...route,
      children: route.children ? getMenuRoutesByPermission(route.children, permissions) : undefined
    }));
}
