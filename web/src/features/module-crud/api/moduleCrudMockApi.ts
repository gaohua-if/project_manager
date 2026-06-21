import type { ApiResponse } from "@/shared/request/types";
import {
  assertUniqueName,
  compareValue,
  createPageResult,
  MockApiError,
  nowIso,
  wait
} from "@/shared/mock/mockApi";

import type {
  ModuleCategory,
  ModuleFormValues,
  ModuleListParams,
  ModuleResource,
  PageResult
} from "./moduleCrudTypes";

export const moduleCategories: ModuleCategory[] = [
  { id: "training", label: "训练", color: "#2E9F75" },
  { id: "data", label: "数据处理", color: "#D9902F" },
  { id: "eval", label: "评估", color: "#7A5CCF" },
  { id: "deploy", label: "部署", color: "#3B6FD8" }
];

const owners = ["平台组", "算法组", "数据组"];
const frameworks: ModuleResource["framework"][] = ["PyTorchJob", "MpiJob", "TensorFlowJob"];

let modules: ModuleResource[] = Array.from({ length: 30 }, (_, index) => {
  const category = moduleCategories[index % moduleCategories.length];
  return {
    id: `module-${index + 1}`,
    name: `${category.label}模块 ${String(index + 1).padStart(2, "0")}`,
    categoryId: category.id,
    owner: owners[index % owners.length],
    status: index % 4 === 0 ? "draft" : index % 5 === 0 ? "offline" : "published",
    framework: frameworks[index % frameworks.length],
    image: `registry.aihub.local/${category.id}/module:${index + 1}`,
    command: "python train.py --data $dataset_path --output /outputs/model",
    description: "用于验证 AIHub 模块类页面的数据流、参数组和详情展示。",
    hardware_suggestion: "GPU x 8 / CPU x 64 / Memory 512Gi",
    tags: [category.label, index % 2 === 0 ? "GPU" : "CPU"],
    ran_cnt: 40 + index * 7,
    used_cnt: 20 + index * 3,
    updated_at: new Date(Date.now() - index * 36e5).toISOString(),
    envs: [{ key: "NCCL_DEBUG", is_optional: false, description: "通信调试等级" }],
    inputs: [{ name: "dataset_path", is_optional: false, description: "训练数据输入路径" }],
    outputs: [
      { name: "model_path", path: "/outputs/model", value_type: 1, description: "模型输出路径" }
    ]
  };
});

function normalize(
  values: ModuleFormValues
): Omit<ModuleResource, "id" | "ran_cnt" | "used_cnt" | "updated_at"> {
  return {
    ...values,
    tags: values.tags ?? [],
    envs: values.envs ?? [],
    inputs: values.inputs ?? [],
    outputs: values.outputs ?? []
  };
}

function assertUniqueParams(values: ModuleFormValues) {
  const inputs = values.inputs ?? [];
  const outputs = values.outputs ?? [];
  const inputNames = inputs.map((item) => item.name).filter(Boolean);
  const outputNames = outputs.map((item) => item.name).filter(Boolean);
  const duplicatedInput = inputNames.find((name, index) => inputNames.indexOf(name) !== index);
  const duplicatedOutput = outputNames.find((name, index) => outputNames.indexOf(name) !== index);
  const crossDuplicate = inputNames.find((name) => outputNames.includes(name));

  if (duplicatedInput) {
    throw new MockApiError("输入参数重复", {
      status: 422,
      fieldErrors: [
        {
          field: ["inputs", inputNames.indexOf(duplicatedInput), "name"],
          message: "输入参数名称不能重复"
        }
      ]
    });
  }
  if (duplicatedOutput) {
    throw new MockApiError("输出参数重复", {
      status: 422,
      fieldErrors: [
        {
          field: ["outputs", outputNames.indexOf(duplicatedOutput), "name"],
          message: "输出参数名称不能重复"
        }
      ]
    });
  }
  if (crossDuplicate) {
    throw new MockApiError("输入参数不能与输出参数重复", {
      status: 422,
      fieldErrors: [
        {
          field: ["inputs", inputNames.indexOf(crossDuplicate), "name"],
          message: "不能与输出参数重复"
        }
      ]
    });
  }
}

export const moduleCrudMockApi = {
  async categories(): Promise<ApiResponse<ModuleCategory[]>> {
    await wait(160);
    return {
      code: 0,
      msg: "success",
      data: moduleCategories.map((category) => ({
        ...category,
        count: modules.filter((module) => module.categoryId === category.id).length
      }))
    };
  },

  async list(params: ModuleListParams): Promise<ApiResponse<PageResult<ModuleResource>>> {
    await wait();
    let rows = [...modules];
    const keyword = params.keyword?.trim().toLowerCase();
    if (params.category_id) rows = rows.filter((item) => item.categoryId === params.category_id);
    if (params.user_id) rows = rows.filter((item) => item.owner === params.user_id);
    if (keyword) {
      rows = rows.filter((item) =>
        `${item.name} ${item.description ?? ""}`.toLowerCase().includes(keyword)
      );
    }
    if (params.order_by) {
      rows.sort((a, b) =>
        compareValue(
          a[params.order_by as keyof ModuleResource] as string | number | undefined,
          b[params.order_by as keyof ModuleResource] as string | number | undefined,
          params.order_type
        )
      );
    }
    return {
      code: 0,
      msg: "success",
      data: createPageResult(rows, params.page_num, params.page_size)
    };
  },

  async detail(id: string): Promise<ApiResponse<ModuleResource>> {
    await wait();
    const item = modules.find((module) => module.id === id);
    if (!item) throw new MockApiError("模块不存在或已被删除", { status: 404 });
    return { code: 0, msg: "success", data: item };
  },

  async logs(id: string): Promise<ApiResponse<string>> {
    await wait(180);
    if (!modules.some((module) => module.id === id))
      throw new MockApiError("模块不存在", { status: 404 });
    return {
      code: 0,
      msg: "success",
      data: `[2026-05-27 10:30:01] INFO  pull image\n[2026-05-27 10:30:12] INFO  prepare inputs\n[2026-05-27 10:31:04] INFO  run command\n[2026-05-27 10:41:22] INFO  job completed`
    };
  },

  async create(values: ModuleFormValues): Promise<ApiResponse<ModuleResource>> {
    await wait();
    assertUniqueName(modules, values.name);
    assertUniqueParams(values);
    const next: ModuleResource = {
      ...normalize(values),
      id: `module-${Date.now()}`,
      ran_cnt: 0,
      used_cnt: 0,
      updated_at: nowIso()
    };
    modules = [next, ...modules];
    return { code: 0, msg: "success", data: next };
  },

  async update(id: string, values: ModuleFormValues): Promise<ApiResponse<ModuleResource>> {
    await wait();
    if (!modules.some((item) => item.id === id))
      throw new MockApiError("模块不存在或已被删除", { status: 404 });
    assertUniqueName(modules, values.name, id);
    assertUniqueParams(values);
    const current = modules.find((item) => item.id === id)!;
    const next: ModuleResource = { ...current, ...normalize(values), updated_at: nowIso() };
    modules = modules.map((item) => (item.id === id ? next : item));
    return { code: 0, msg: "success", data: next };
  },

  async delete(id: string): Promise<ApiResponse<null>> {
    await wait();
    if (!modules.some((item) => item.id === id))
      throw new MockApiError("模块不存在或已被删除", { status: 404 });
    modules = modules.filter((item) => item.id !== id);
    return { code: 0, msg: "success", data: null };
  }
};
