export interface PermissionNode {
  id: number;
  name: string;
  parent: number;
  auth: string;
  authName: string;
  children?: PermissionNode[];
}

export interface UserRole {
  id: number;
  name: string;
  role_type: number;
  menu_ids: number[] | null;
}

export interface UserTag {
  id: number;
  name: string;
}

export interface CurrentUser {
  id: number | string;
  username: string;
  nickname?: string | null;
  email?: string | null;
  roles: UserRole[];
  status: number;
  tags: UserTag[];
  created_at: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
}
