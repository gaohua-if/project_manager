import type {
  CreateMockRequirementInput,
  CreateMockTaskInput,
  FavoriteTargetType,
  MockAssignee,
  MockFavorite,
  MockRequirement,
  MockTask,
  MockTaskStatus,
  MockTeam,
  MockTokenSource,
  RequirementStage
} from "./types";

const teams: MockTeam[] = [
  { id: "team-ai", name: "AI 工程" },
  { id: "team-platform", name: "平台研发" },
  { id: "team-product", name: "产品设计" }
];

const assignees: MockAssignee[] = [
  { id: "user-zhang", name: "张三", employee_id: "zhangsan", team_id: "team-ai" },
  { id: "user-li", name: "李四", employee_id: "lisi", team_id: "team-ai" },
  { id: "user-wang", name: "王五", employee_id: "wangwu", team_id: "team-platform" },
  { id: "user-zhao", name: "赵六", employee_id: "zhaoliu", team_id: "team-platform" }
];

const tokenSources: MockTokenSource[] = [
  {
    id: "ts-001",
    recorded_at: "2026-06-24T09:30:00Z",
    tool: "Claude Code",
    uploader: "王五",
    token: 86200,
    summary: "实现日报聚合接口的初步联调"
  },
  {
    id: "ts-002",
    recorded_at: "2026-06-24T11:10:00Z",
    tool: "Claude Code",
    uploader: "王五",
    token: 100200,
    summary: "补齐聚合接口字段与单测"
  },
  {
    id: "ts-003",
    recorded_at: "2026-06-23T16:45:00Z",
    tool: "Codex",
    uploader: "赵六",
    token: 94200,
    summary: "日报任务进展视图组件搭建"
  },
  {
    id: "ts-004",
    recorded_at: "2026-06-22T14:00:00Z",
    tool: "Claude Code",
    uploader: "张三",
    token: 128700,
    summary: "设计 Token 来源与任务关联的数据模型"
  },
  {
    id: "ts-005",
    recorded_at: "2026-06-19T15:30:00Z",
    tool: "Claude Code",
    uploader: "王五",
    token: 212500,
    summary: "权限中间件收敛与回归"
  },
  {
    id: "ts-006",
    recorded_at: "2026-06-24T10:20:00Z",
    tool: "Claude Code",
    uploader: "陈 PM",
    token: 42100,
    summary: "需求范围对齐与会议纪要"
  },
  {
    id: "ts-007",
    recorded_at: "2026-06-23T09:00:00Z",
    tool: "Codex",
    uploader: "陈 PM",
    token: 31500,
    summary: "需求澄清与上下游接口梳理"
  },
  {
    id: "ts-008",
    recorded_at: "2026-06-22T17:20:00Z",
    tool: "Claude Code",
    uploader: "李四",
    token: 0,
    summary: "尚未上传完整内容（占位）"
  }
];

let requirements: MockRequirement[] = [
  {
    id: "req-daily-report",
    title: "控制台日报任务进展上报",
    description: "统一汇总任务进度、Token 来源和依赖风险，形成可追踪的日报视图。",
    acceptance_criteria: [
      "任务负责人可提交当日进展",
      "日报能关联任务与 Token 来源",
      "依赖阻塞在汇总视图中可见"
    ],
    creator_id: "user-pm",
    creator_name: "陈 PM",
    creator_role: "pm",
    status: "active",
    priority: "urgent",
    progress: 58,
    deadline: "2026-07-05",
    team_ids: ["team-product", "team-platform"],
    team_names: ["产品设计", "平台研发"],
    token_source_ids: ["ts-006"],
    created_at: "2026-06-12T09:20:00Z",
    updated_at: "2026-06-24T08:30:00Z"
  },
  {
    id: "req-session-evidence",
    title: "Token 来源关联与回溯",
    description: "支持将开发工作记录作为 Token 来源关联到具体任务，并在执行链路中查看摘要。",
    acceptance_criteria: [
      "Token 来源可关联到任务",
      "任务详情展示 Token 来源摘要",
      "任务详情可回溯执行证据"
    ],
    creator_id: "user-pm",
    creator_name: "陈 PM",
    creator_role: "pm",
    status: "review",
    priority: "high",
    progress: 30,
    deadline: "2026-07-12",
    team_ids: ["team-ai"],
    team_names: ["AI 工程"],
    token_source_ids: ["ts-007"],
    created_at: "2026-06-18T10:00:00Z",
    updated_at: "2026-06-24T07:20:00Z"
  },
  {
    id: "req-permission",
    title: "角色权限矩阵优化",
    description: "收敛需求、任务和 Token 来源的角色可见与编辑边界。",
    acceptance_criteria: ["权限规则覆盖五类角色", "越权操作返回明确提示"],
    creator_id: "user-director",
    creator_name: "李总监",
    creator_role: "director",
    status: "completed",
    priority: "high",
    progress: 100,
    deadline: "2026-06-21",
    team_ids: ["team-platform"],
    team_names: ["平台研发"],
    token_source_ids: [],
    created_at: "2026-06-02T08:00:00Z",
    updated_at: "2026-06-21T16:40:00Z"
  },
  {
    id: "req-old-export",
    title: "旧版日报导出",
    description: "已取消的历史方案，仅保留用于筛选与追溯。",
    acceptance_criteria: ["支持导出旧版日报"],
    creator_id: "user-pm",
    creator_name: "陈 PM",
    creator_role: "pm",
    status: "cancelled",
    priority: "low",
    progress: 0,
    team_ids: ["team-product"],
    team_names: ["产品设计"],
    token_source_ids: [],
    created_at: "2026-05-20T08:00:00Z",
    updated_at: "2026-06-01T14:00:00Z"
  },
  ...buildArchivedCompletedRequirements()
];

function buildArchivedCompletedRequirements(): MockRequirement[] {
  const records: Array<{
    id: string;
    title: string;
    description: string;
    updated: string;
    deadline: string;
    teamIds: string[];
    teamNames: string[];
    creatorId: string;
    creatorName: string;
    creatorRole: string;
  }> = [
    {
      id: "req-archived-01",
      title: "看板筛选状态持久化",
      description: "将看板筛选条件写入查询参数，刷新后仍可恢复。",
      updated: "2026-06-24T05:00:00Z",
      deadline: "2026-06-22",
      teamIds: ["team-platform"],
      teamNames: ["平台研发"],
      creatorId: "user-pm",
      creatorName: "陈 PM",
      creatorRole: "pm"
    },
    {
      id: "req-archived-02",
      title: "任务详情依赖图重构",
      description: "依赖关系以列表形式展示，去除原有树形复杂度。",
      updated: "2026-06-23T18:30:00Z",
      deadline: "2026-06-22",
      teamIds: ["team-ai"],
      teamNames: ["AI 工程"],
      creatorId: "user-director",
      creatorName: "李总监",
      creatorRole: "director"
    },
    {
      id: "req-archived-03",
      title: "需求看板拖拽体验优化",
      description: "调整阶段切换的过渡动画与拖拽落点反馈。",
      updated: "2026-06-23T11:00:00Z",
      deadline: "2026-06-21",
      teamIds: ["team-product"],
      teamNames: ["产品设计"],
      creatorId: "user-pm",
      creatorName: "陈 PM",
      creatorRole: "pm"
    },
    {
      id: "req-archived-04",
      title: "Token 来源筛选项",
      description: "Token 来源列表支持按工具与上传者筛选。",
      updated: "2026-06-22T14:15:00Z",
      deadline: "2026-06-21",
      teamIds: ["team-platform"],
      teamNames: ["平台研发"],
      creatorId: "user-director",
      creatorName: "李总监",
      creatorRole: "director"
    },
    {
      id: "req-archived-05",
      title: "需求验收标准批量录入",
      description: "支持在创建需求时批量粘贴验收标准。",
      updated: "2026-06-22T09:00:00Z",
      deadline: "2026-06-20",
      teamIds: ["team-product"],
      teamNames: ["产品设计"],
      creatorId: "user-pm",
      creatorName: "陈 PM",
      creatorRole: "pm"
    },
    {
      id: "req-archived-06",
      title: "任务进度滑块组件统一",
      description: "替换旧版进度组件，使用滑块与数值同步编辑。",
      updated: "2026-06-21T17:45:00Z",
      deadline: "2026-06-20",
      teamIds: ["team-platform"],
      teamNames: ["平台研发"],
      creatorId: "user-director",
      creatorName: "李总监",
      creatorRole: "director"
    },
    {
      id: "req-archived-07",
      title: "需求详情抽屉宽度调整",
      description: "需求与任务抽屉宽度统一，提升信息密度。",
      updated: "2026-06-20T16:00:00Z",
      deadline: "2026-06-19",
      teamIds: ["team-product"],
      teamNames: ["产品设计"],
      creatorId: "user-pm",
      creatorName: "陈 PM",
      creatorRole: "pm"
    },
    {
      id: "req-archived-08",
      title: "看板搜索高亮匹配",
      description: "搜索结果中高亮匹配关键字，便于快速定位。",
      updated: "2026-06-19T15:20:00Z",
      deadline: "2026-06-18",
      teamIds: ["team-ai"],
      teamNames: ["AI 工程"],
      creatorId: "user-director",
      creatorName: "李总监",
      creatorRole: "director"
    },
    {
      id: "req-archived-09",
      title: "任务详情快捷操作",
      description: "在任务详情顶部提供常用状态切换按钮。",
      updated: "2026-06-19T09:10:00Z",
      deadline: "2026-06-18",
      teamIds: ["team-platform"],
      teamNames: ["平台研发"],
      creatorId: "user-pm",
      creatorName: "陈 PM",
      creatorRole: "pm"
    },
    {
      id: "req-archived-10",
      title: "需求列表导出 CSV",
      description: "支持当前筛选结果导出为 CSV 文件。",
      updated: "2026-06-18T08:00:00Z",
      deadline: "2026-06-17",
      teamIds: ["team-product"],
      teamNames: ["产品设计"],
      creatorId: "user-pm",
      creatorName: "陈 PM",
      creatorRole: "pm"
    },
    {
      id: "req-archived-11",
      title: "需求看板空状态插画",
      description: "为空状态补充插画与引导文案。",
      updated: "2026-06-15T12:00:00Z",
      deadline: "2026-06-12",
      teamIds: ["team-product"],
      teamNames: ["产品设计"],
      creatorId: "user-pm",
      creatorName: "陈 PM",
      creatorRole: "pm"
    },
    {
      id: "req-archived-12",
      title: "Token 来源月度归档",
      description: "Token 来源支持按月份归档，减少列表压力。",
      updated: "2026-06-10T10:00:00Z",
      deadline: "2026-06-08",
      teamIds: ["team-platform"],
      teamNames: ["平台研发"],
      creatorId: "user-director",
      creatorName: "李总监",
      creatorRole: "director"
    }
  ];
  return records.map((record) => ({
    id: record.id,
    title: record.title,
    description: record.description,
    acceptance_criteria: ["验收标准已闭环"],
    creator_id: record.creatorId,
    creator_name: record.creatorName,
    creator_role: record.creatorRole,
    status: "completed",
    priority: "medium",
    progress: 100,
    deadline: record.deadline,
    team_ids: record.teamIds,
    team_names: record.teamNames,
    token_source_ids: [],
    created_at: "2026-05-25T08:00:00Z",
    updated_at: record.updated
  }));
}

let tasks: MockTask[] = [
  {
    id: "task-report-api",
    requirement_id: "req-daily-report",
    requirement_title: "控制台日报任务进展上报",
    title: "实现日报聚合接口",
    acceptance_criteria_ids: [0],
    assignee_id: "user-wang",
    assignee_name: "王五",
    status: "in_progress",
    priority: "high",
    progress: 65,
    due_date: "2026-06-29",
    dependencies: [],
    blocking: [],
    token_source_ids: ["ts-001", "ts-002"],
    created_at: "2026-06-13T08:30:00Z",
    updated_at: "2026-06-24T08:10:00Z"
  },
  {
    id: "task-report-ui",
    requirement_id: "req-daily-report",
    requirement_title: "控制台日报任务进展上报",
    title: "实现日报任务进展视图",
    acceptance_criteria_ids: [0, 1],
    assignee_id: "user-zhao",
    assignee_name: "赵六",
    status: "blocked",
    priority: "high",
    progress: 40,
    due_date: "2026-07-01",
    dependencies: [
      { task_id: "task-report-api", task_title: "实现日报聚合接口", status: "in_progress" }
    ],
    blocking: [],
    token_source_ids: ["ts-003"],
    created_at: "2026-06-14T09:00:00Z",
    updated_at: "2026-06-24T07:50:00Z"
  },
  {
    id: "task-session-link",
    requirement_id: "req-session-evidence",
    requirement_title: "Token 来源关联与回溯",
    title: "设计 Token 来源与任务关联模型",
    acceptance_criteria_ids: [0],
    assignee_id: "user-zhang",
    assignee_name: "张三",
    status: "done",
    priority: "high",
    progress: 100,
    due_date: "2026-06-25",
    dependencies: [],
    blocking: [{ task_id: "task-session-tree", task_title: "任务树证据摘要", status: "todo" }],
    token_source_ids: ["ts-004"],
    created_at: "2026-06-19T08:00:00Z",
    updated_at: "2026-06-23T18:00:00Z"
  },
  {
    id: "task-session-tree",
    requirement_id: "req-session-evidence",
    requirement_title: "Token 来源关联与回溯",
    title: "任务树证据摘要",
    acceptance_criteria_ids: [1],
    assignee_id: "user-li",
    assignee_name: "李四",
    status: "todo",
    priority: "medium",
    progress: 0,
    due_date: "2026-07-06",
    dependencies: [
      { task_id: "task-session-link", task_title: "设计 Token 来源与任务关联模型", status: "done" }
    ],
    blocking: [],
    token_source_ids: [],
    created_at: "2026-06-20T08:00:00Z",
    updated_at: "2026-06-20T08:00:00Z"
  },
  {
    id: "task-permission-api",
    requirement_id: "req-permission",
    requirement_title: "角色权限矩阵优化",
    title: "权限中间件收敛",
    acceptance_criteria_ids: [0, 1],
    assignee_id: "user-wang",
    assignee_name: "王五",
    status: "done",
    priority: "high",
    progress: 100,
    due_date: "2026-06-19",
    dependencies: [],
    blocking: [],
    token_source_ids: ["ts-005"],
    created_at: "2026-06-03T08:00:00Z",
    updated_at: "2026-06-19T17:00:00Z"
  }
];

const CURRENT_USER_ID = "user-current";
let favorites: MockFavorite[] = [
  {
    user_id: CURRENT_USER_ID,
    target_type: "requirement",
    target_id: "req-002",
    created_at: "2026-06-22T08:00:00Z"
  }
];

function wait(ms = 180) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function now() {
  return new Date().toISOString();
}

function progressFor(requirement: MockRequirement) {
  const relatedTasks = tasks.filter((task) => task.requirement_id === requirement.id);
  if (!relatedTasks.length) return requirement.progress;
  return Math.round(
    relatedTasks.reduce((total, task) => total + task.progress, 0) / relatedTasks.length
  );
}

function hydrateRequirement(requirement: MockRequirement): MockRequirement {
  return { ...requirement, progress: progressFor(requirement) };
}

function syncDependencies() {
  const statusById = new Map(tasks.map((task) => [task.id, task.status]));
  tasks = tasks.map((task) => ({
    ...task,
    dependencies: task.dependencies.map((dependency) => ({
      ...dependency,
      status: statusById.get(dependency.task_id) ?? dependency.status
    }))
  }));
}

function findTokenSource(id: string) {
  return tokenSources.find((source) => source.id === id);
}

export const requirementsBoardMockApi = {
  async listRequirements() {
    await wait();
    return requirements.map(hydrateRequirement);
  },

  async getRequirement(id: string) {
    await wait();
    const requirement = requirements.find((item) => item.id === id);
    if (!requirement) throw new Error("需求不存在或已被删除");
    return hydrateRequirement(requirement);
  },

  async createRequirement(input: CreateMockRequirementInput) {
    await wait(260);
    const timestamp = now();
    const selectedTeams = teams.filter((team) => input.team_ids.includes(team.id));
    const requirement: MockRequirement = {
      ...input,
      id: `req-mock-${Date.now()}`,
      creator_id: "user-current",
      creator_name: "当前用户",
      creator_role: "pm",
      status: "todo",
      progress: 0,
      team_names: selectedTeams.map((team) => team.name),
      token_source_ids: [],
      created_at: timestamp,
      updated_at: timestamp
    };
    requirements = [requirement, ...requirements];
    return requirement;
  },

  async updateRequirementStage(id: string, status: RequirementStage) {
    await wait();
    const current = requirements.find((item) => item.id === id);
    if (!current) throw new Error("需求不存在或已被删除");
    const updated = { ...current, status, updated_at: now() };
    requirements = requirements.map((item) => (item.id === id ? updated : item));
    return hydrateRequirement(updated);
  },

  async listTasks(requirementId?: string) {
    await wait();
    syncDependencies();
    return requirementId
      ? tasks.filter((task) => task.requirement_id === requirementId)
      : [...tasks];
  },

  async getTask(id: string) {
    await wait();
    syncDependencies();
    const task = tasks.find((item) => item.id === id);
    if (!task) throw new Error("任务不存在或已被删除");
    return task;
  },

  async createTask(input: CreateMockTaskInput) {
    await wait(260);
    const requirement = requirements.find((item) => item.id === input.requirement_id);
    if (!requirement) throw new Error("所属需求不存在");
    const assignee = assignees.find((item) => item.id === input.assignee_id);
    const timestamp = now();
    const dependencyIds = input.dependency_task_ids ?? [];
    const dependencies = dependencyIds
      .map((depId) => tasks.find((item) => item.id === depId))
      .filter((item): item is MockTask => Boolean(item))
      .map((item) => ({ task_id: item.id, task_title: item.title, status: item.status }));
    const task: MockTask = {
      ...input,
      id: `task-mock-${Date.now()}`,
      requirement_title: requirement.title,
      assignee_name: assignee?.name,
      status: "todo",
      progress: 0,
      dependencies,
      blocking: [],
      token_source_ids: [],
      created_at: timestamp,
      updated_at: timestamp
    };
    tasks = [task, ...tasks];
    return task;
  },

  async updateTaskStatus(id: string, status: Exclude<MockTaskStatus, "blocked">) {
    await wait();
    const task = tasks.find((item) => item.id === id);
    if (!task) throw new Error("任务不存在或已被删除");
    const progress =
      status === "done" ? 100 : status === "todo" && task.progress === 100 ? 0 : task.progress;
    const updated = { ...task, status, progress, updated_at: now() };
    tasks = tasks.map((item) => (item.id === id ? updated : item));
    syncDependencies();
    return updated;
  },

  async updateTaskProgress(id: string, progress: number) {
    await wait();
    const task = tasks.find((item) => item.id === id);
    if (!task) throw new Error("任务不存在或已被删除");
    const normalizedProgress = Math.min(100, Math.max(0, Math.round(progress)));
    const status: MockTaskStatus =
      normalizedProgress === 100 ? "done" : task.status === "done" ? "in_progress" : task.status;
    const updated = { ...task, progress: normalizedProgress, status, updated_at: now() };
    tasks = tasks.map((item) => (item.id === id ? updated : item));
    return updated;
  },

  async listTeams() {
    await wait(120);
    return [...teams];
  },

  async listAssignees() {
    await wait(120);
    return [...assignees];
  },

  async listTokenSources() {
    await wait(120);
    return [...tokenSources];
  },

  async getTokenSourcesByIds(ids: string[]) {
    await wait(80);
    return ids.map(findTokenSource).filter((source): source is MockTokenSource => Boolean(source));
  },

  async linkRequirementTokenSources(requirementId: string, sourceIds: string[]) {
    await wait();
    const target = requirements.find((item) => item.id === requirementId);
    if (!target) throw new Error("需求不存在或已被删除");
    const next = Array.from(new Set([...target.token_source_ids, ...sourceIds]));
    const updated: MockRequirement = { ...target, token_source_ids: next, updated_at: now() };
    requirements = requirements.map((item) => (item.id === requirementId ? updated : item));
    return hydrateRequirement(updated);
  },

  async unlinkRequirementTokenSource(requirementId: string, sourceId: string) {
    await wait();
    const target = requirements.find((item) => item.id === requirementId);
    if (!target) throw new Error("需求不存在或已被删除");
    const updated: MockRequirement = {
      ...target,
      token_source_ids: target.token_source_ids.filter((id) => id !== sourceId),
      updated_at: now()
    };
    requirements = requirements.map((item) => (item.id === requirementId ? updated : item));
    return hydrateRequirement(updated);
  },

  async linkTaskTokenSources(taskId: string, sourceIds: string[]) {
    await wait();
    const target = tasks.find((item) => item.id === taskId);
    if (!target) throw new Error("任务不存在或已被删除");
    const next = Array.from(new Set([...target.token_source_ids, ...sourceIds]));
    const updated: MockTask = { ...target, token_source_ids: next, updated_at: now() };
    tasks = tasks.map((item) => (item.id === taskId ? updated : item));
    return updated;
  },

  async unlinkTaskTokenSource(taskId: string, sourceId: string) {
    await wait();
    const target = tasks.find((item) => item.id === taskId);
    if (!target) throw new Error("任务不存在或已被删除");
    const updated: MockTask = {
      ...target,
      token_source_ids: target.token_source_ids.filter((id) => id !== sourceId),
      updated_at: now()
    };
    tasks = tasks.map((item) => (item.id === taskId ? updated : item));
    return updated;
  },

  async listFavorites() {
    await wait(80);
    return favorites.filter((item) => item.user_id === CURRENT_USER_ID).map((item) => ({ ...item }));
  },

  async toggleFavorite(target_type: FavoriteTargetType, target_id: string) {
    await wait(80);
    if (target_type === "requirement" && !requirements.some((item) => item.id === target_id)) {
      throw new Error("需求不存在或已被删除");
    }
    if (target_type === "task" && !tasks.some((item) => item.id === target_id)) {
      throw new Error("任务不存在或已被删除");
    }
    const existed = favorites.find(
      (item) =>
        item.user_id === CURRENT_USER_ID &&
        item.target_type === target_type &&
        item.target_id === target_id
    );
    if (existed) {
      favorites = favorites.filter((item) => item !== existed);
      return { favorited: false, target_type, target_id };
    }
    favorites = [
      ...favorites,
      {
        user_id: CURRENT_USER_ID,
        target_type,
        target_id,
        created_at: now()
      }
    ];
    return { favorited: true, target_type, target_id };
  }
};
