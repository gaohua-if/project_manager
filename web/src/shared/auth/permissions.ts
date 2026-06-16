// AIDashboard uses role-based access control, not permission nodes.
// This file is kept as a no-op shim so any lingering AIHub imports still compile.

export interface PermissionLike {
  id: number;
  name: string;
  auth: string;
  authName: string;
}

export const starterPermissions: PermissionLike[] = [];

export function flattenPermissions(nodes: PermissionLike[] = []): PermissionLike[] {
  return nodes;
}

export function getStoredPermissions(): PermissionLike[] {
  return [];
}

export function setStoredPermissions(_permissions: PermissionLike[]): void {
  // no-op — roles are stored on the User, not in localStorage.
  void _permissions;
}

export function clearStoredPermissions(): void {
  // no-op
}
