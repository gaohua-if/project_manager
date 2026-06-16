export interface LoginCredentials {
  username: string;
  password: string;
}

export interface CurrentUser {
  id: number | string;
  username: string;
  nickname?: string | null;
  email?: string | null;
  roles: Array<{
    id: number;
    name: string;
    role_type: number;
    menu_ids: number[] | null;
  }>;
  status: number;
  tags: Array<{
    id: number;
    name: string;
  }>;
  created_at: number;
}
