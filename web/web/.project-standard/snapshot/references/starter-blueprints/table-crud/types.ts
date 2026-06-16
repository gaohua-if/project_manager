// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the pattern, not the mock data.

export type ResourceStatus = "running" | "paused" | "failed" | "draft";

export interface ResourceRecord {
  id: string;
  name: string;
  owner: string;
  status: ResourceStatus;
  priority: "high" | "normal" | "low";
  region: string;
  quota: number;
  updatedAt: string;
  description?: string;
}

export interface ResourceListQuery {
  page_num: number;
  page_size: number;
  keyword?: string;
  status?: ResourceStatus;
  priority?: string;
  order_by?: string;
  order_type?: "asc" | "desc";
}

export interface ResourceFormValues {
  name: string;
  owner: string;
  status: ResourceStatus;
  priority: "high" | "normal" | "low";
  region: string;
  quota: number;
  description?: string;
}

export interface PageResult<T> {
  page_num: number;
  page_size: number;
  total: number;
  data: T[];
}
