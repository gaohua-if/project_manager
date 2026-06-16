import type { PermissionNode } from "./types";

const MENU_KEY = "menu";

export const starterPermissions: PermissionNode[] = [
  {
    id: 1,
    name: "组件样板",
    parent: 0,
    auth: "component_gallery",
    authName: "component_gallery"
  }
];

export function flattenPermissions(nodes: PermissionNode[] = [], parent?: PermissionNode): PermissionNode[] {
  return nodes.reduce<PermissionNode[]>((prev, current) => {
    const normalized: PermissionNode = {
      ...current,
      authName: parent ? `${parent.authName}_${current.auth}` : current.authName || current.auth
    };

    return [
      ...prev,
      normalized,
      ...flattenPermissions(current.children ?? [], normalized)
    ];
  }, []);
}

export function getStoredPermissions() {
  const menuCache = window.localStorage.getItem(MENU_KEY);
  if (!menuCache) return [];

  try {
    const parsed = JSON.parse(menuCache) as PermissionNode[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setStoredPermissions(permissions: PermissionNode[]) {
  window.localStorage.setItem(MENU_KEY, JSON.stringify(permissions));
}

export function clearStoredPermissions() {
  window.localStorage.removeItem(MENU_KEY);
}
