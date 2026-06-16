export interface ModuleCategory {
  id: string;
  label: string;
  color: string;
  count?: number;
}

export interface ModuleParameter {
  name: string;
  description?: string;
  is_optional?: boolean;
}

export interface ModuleEnvVar {
  key: string;
  description?: string;
  is_optional?: boolean;
}

export interface ModuleOutputParameter {
  name: string;
  path: string;
  value_type: 0 | 1;
  description?: string;
}

export interface ModuleResource {
  id: string;
  name: string;
  categoryId: string;
  owner: string;
  status: "draft" | "published" | "offline";
  framework: "PyTorchJob" | "MpiJob" | "TensorFlowJob";
  image: string;
  command: string;
  description?: string;
  hardware_suggestion?: string;
  tags: string[];
  ran_cnt: number;
  used_cnt: number;
  updated_at: string;
  envs: ModuleEnvVar[];
  inputs: ModuleParameter[];
  outputs: ModuleOutputParameter[];
}

export interface ModuleListParams {
  page_num: number;
  page_size: number;
  keyword?: string;
  category_id?: string;
  user_id?: string;
  order_by?: string;
  order_type?: string;
}

export interface ModuleFormValues {
  name: string;
  categoryId: string;
  owner: string;
  status: ModuleResource["status"];
  framework: ModuleResource["framework"];
  image: string;
  command: string;
  description?: string;
  hardware_suggestion?: string;
  tags?: string[];
  always_pull_image?: boolean;
  timeoutMinutes?: number;
  envs?: ModuleEnvVar[];
  inputs?: ModuleParameter[];
  outputs?: ModuleOutputParameter[];
}

export interface PageResult<T> {
  page_num: number;
  page_size: number;
  total: number;
  data: T[];
}
