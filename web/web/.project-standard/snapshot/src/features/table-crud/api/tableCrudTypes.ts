export type TableResourceStatus = "running" | "paused" | "failed" | "draft";
export type TableResourcePriority = "high" | "normal" | "low";

export interface TableResource {
  id: string;
  name: string;
  owner: string;
  status: TableResourceStatus;
  priority: TableResourcePriority;
  region: string;
  quota: number;
  enabled: boolean;
  tags: string[];
  envs?: TableResourceEnvVar[];
  effectiveDate?: string;
  description?: string;
  attachment?: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface TableResourceEnvVar {
  key: string;
  is_optional?: boolean;
  description?: string;
}

export interface TableResourceListParams {
  page_num: number;
  page_size: number;
  keyword?: string;
  status?: string;
  priority?: string;
  order_by?: string;
  order_type?: string;
}

export interface PageResult<T> {
  page_num: number;
  page_size: number;
  total: number;
  data: T[];
}

export interface TableResourceFormValues {
  name: string;
  owner: string;
  status: TableResourceStatus;
  priority: TableResourcePriority;
  region: string;
  quota: number;
  enabled: boolean;
  tags?: string[];
  envs?: TableResourceEnvVar[];
  effectiveDate?: string;
  description?: string;
  attachment?: string | File | null;
}
