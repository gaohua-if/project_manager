export type UserRole = "admin" | "director" | "pm" | "team_leader" | "employee";
export type UserStatus = "active" | "deactivated";

export interface User {
  id: string;
  username: string;
  nickname: string;
  employee_id: string;
  email: string;
  name: string;
  app_role: UserRole;
  role: UserRole;
  team_id?: string | null;
  team_name?: string | null;
  local_enabled?: boolean;
  status?: UserStatus;
  deactivated_at?: string | null;
  last_synced_at?: string | null;
  created_at?: string;
}

export interface LoginCredentials {
  username: string;
  employee_id?: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export const ALL_ROLES: UserRole[] = ["admin", "director", "pm", "team_leader", "employee"];

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "管理员",
  director: "部门总监",
  pm: "产品经理",
  team_leader: "团队负责人",
  employee: "工程师"
};
