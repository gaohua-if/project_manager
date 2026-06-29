export type UserRole = "admin" | "director" | "pm" | "team_leader" | "employee";

export interface User {
  id: number;
  aihub_username?: string;
  email: string;
  name: string;
  role: UserRole;
  team_id?: string | null;
  team_name?: string | null;
  created_at?: string;
}

export interface LoginCredentials {
  username: string;
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
