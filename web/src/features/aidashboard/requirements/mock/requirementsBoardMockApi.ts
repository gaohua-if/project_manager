import type {
  CreateMockRequirementInput,
  CreateMockTaskInput,
  MockAssignee,
  MockRequirement,
  MockTask,
  MockTaskStatus,
  MockTeam,
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
    created_at: "2026-06-18T10:00:00Z",
    updated_at: "2026-06-24T07:20:00Z"
  },
  {
    id: "req-task-template",
    title: "标准任务模板",
    description: "为常见研发工作提供可复用的任务拆解模板。",
    acceptance_criteria: ["支持选择模板创建任务", "模板可维护默认负责人角色和交付检查项"],
    creator_id: "user-pm",
    creator_name: "陈 PM",
    creator_role: "pm",
    status: "todo",
    priority: "medium",
    progress: 0,
    deadline: "2026-07-20",
    team_ids: ["team-product"],
    team_names: ["产品设计"],
    created_at: "2026-06-22T11:10:00Z",
    updated_at: "2026-06-22T11:10:00Z"
  },
  {
    id: "req-permission",
    title: "角色权限矩阵优化",
    description: "收敛需求、任务和 Session 的角色可见与编辑边界。",
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
    created_at: "2026-05-20T08:00:00Z",
    updated_at: "2026-06-01T14:00:00Z"
  }
];

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
    session_count: 7,
    token_total: 186400,
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
    session_count: 4,
    token_total: 94200,
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
    session_count: 5,
    token_total: 128700,
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
    session_count: 0,
    token_total: 0,
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
    session_count: 8,
    token_total: 212500,
    created_at: "2026-06-03T08:00:00Z",
    updated_at: "2026-06-19T17:00:00Z"
  }
];

function wait(ms = 180) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function now() {
  return new Date().toISOString();
}

function progressFor(requirementId: string) {
  const relatedTasks = tasks.filter((task) => task.requirement_id === requirementId);
  if (!relatedTasks.length) return 0;
  return Math.round(
    relatedTasks.reduce((total, task) => total + task.progress, 0) / relatedTasks.length
  );
}

function hydrateRequirement(requirement: MockRequirement): MockRequirement {
  return { ...requirement, progress: progressFor(requirement.id) };
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
    const task: MockTask = {
      ...input,
      id: `task-mock-${Date.now()}`,
      requirement_title: requirement.title,
      assignee_name: assignee?.name,
      status: "todo",
      progress: 0,
      dependencies: [],
      blocking: [],
      session_count: 0,
      token_total: 0,
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
  }
};
