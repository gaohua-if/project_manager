import { matchPath } from "react-router-dom";

import type { PermissionNode } from "@/shared/auth/types";

import type { AppRoute } from "./types";

export function hasRoutePermission(permission: string | undefined, permissions: PermissionNode[]) {
  if (!permission) return true;
  return permissions.some((item) => item.authName === permission || item.auth === permission);
}

export function findRouteByPath(pathname: string, routes: AppRoute[]): AppRoute | null {
  for (const route of routes) {
    if (matchPath({ path: route.path, end: true }, pathname)) {
      return route;
    }

    if (route.children) {
      const child = findRouteByPath(pathname, route.children);
      if (child) return child;
    }
  }

  return null;
}

export function findBestMenuMatch(pathname: string, routes: AppRoute[]): AppRoute | null {
  let bestMatch: AppRoute | null = null;
  let longestMatchLength = 0;

  const visit = (items: AppRoute[]) => {
    items.forEach((route) => {
      if (route.hideInMenu) return;
      const matched =
        matchPath({ path: route.path, end: true }, pathname) ||
        pathname.startsWith(`${route.path}/`);

      if (matched && route.path.length > longestMatchLength) {
        bestMatch = route;
        longestMatchLength = route.path.length;
      }

      if (route.children) visit(route.children);
    });
  };

  visit(routes);
  return bestMatch;
}

export function findFirstAccessibleRoute(
  routes: AppRoute[],
  permissions: PermissionNode[]
): string | null {
  for (const route of routes) {
    if (route.children) {
      const childPath: string | null = findFirstAccessibleRoute(route.children, permissions);
      if (childPath) return childPath;
    }

    if (!route.hideInMenu && hasRoutePermission(route.permission ?? route.access, permissions)) {
      return route.path;
    }
  }

  return null;
}
