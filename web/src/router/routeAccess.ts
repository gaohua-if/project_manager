import { matchPath } from "react-router-dom";

import type { User } from "@/shared/auth/types";

import type { AppRoute } from "./types";

export function hasRouteRole(route: AppRoute, user: User | null): boolean {
  if (!route.roles || route.roles.length === 0) return true;
  if (!user) return false;
  return route.roles.includes(user.role);
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

export function findFirstAccessibleRoute(routes: AppRoute[], user: User | null): string | null {
  for (const route of routes) {
    if (route.children) {
      const childPath = findFirstAccessibleRoute(route.children, user);
      if (childPath) return childPath;
    }

    if (!route.hideInMenu && hasRouteRole(route, user)) {
      return route.path;
    }
  }

  return null;
}
