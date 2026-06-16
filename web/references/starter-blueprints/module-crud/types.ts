// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the pattern, not the mock data.

export type ModuleStatus = "draft" | "published" | "offline";
export type ModuleOrderType = "asc" | "desc";

export interface ModuleCategory {
  id: string;
  label: string;
  count?: number;
  color?: string;
}

export interface ModuleRecord {
  id: string;
  name: string;
  description?: string;
  owner: string;
  categoryId: string;
  status: ModuleStatus;
  tags: string[];
  used_cnt: number;
  ran_cnt: number;
  updated_at: string;
}

export interface ModuleListQuery {
  page_num: number;
  page_size: number;
  keyword?: string;
  category_id?: string;
  owner?: string;
  order_by?: string;
  order_type?: ModuleOrderType;
}

export interface ModuleFormValues {
  name: string;
  description?: string;
  owner: string;
  categoryId: string;
  status: ModuleStatus;
  image: string;
  command: string;
  tags?: string[];
}

export interface PageResult<T> {
  page_num: number;
  page_size: number;
  total: number;
  data: T[];
}
