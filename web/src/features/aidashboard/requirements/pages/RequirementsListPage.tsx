import {
  AppstoreOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DownOutlined,
  FileTextOutlined,
  HolderOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  TeamOutlined,
  UnorderedListOutlined,
  WarningOutlined
} from "@ant-design/icons";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import type { DropResult } from "@hello-pangea/dnd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Collapse,
  Descriptions,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Progress,
  Select,
  Segmented,
  Skeleton,
  Slider,
  Space,
  Tag
} from "antd";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "@/shared/auth/authContext";
import { ROLE_LABELS, type UserRole } from "@/shared/auth/types";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { appendSearch } from "@/shared/utils/urlQuery";

import { TaskStatusTag } from "../../dashboard/shared";
import {
  RequirementMetricCard,
  RequirementMetricGrid,
  type RequirementMetricTone
} from "../components/RequirementMetricCard";
import { requirementsBoardMockApi } from "../mock/requirementsBoardMockApi";
import type {
  MockRequirement,
  MockTask,
  RequirementPriority,
  RequirementStage
} from "../mock/types";
import "./RequirementsBoard.css";

type BoardView = "board" | "tree";
type RiskFilter = "blocked" | "deadline";

const STATUS_COLUMNS: Array<{
  value: RequirementStage;
  label: string;
  description: string;
  tone: string;
}> = [
  { value: "todo", label: "待开始", description: "等待拆解或排期", tone: "gray" },
  { value: "review", label: "评审", description: "确认范围和验收标准", tone: "purple" },
  { value: "active", label: "进行中", description: "任务正在推进", tone: "blue" },
  { value: "completed", label: "完成", description: "已完成交付验收", tone: "green" }
];

const CANCELLED_COLUMN = {
  value: "cancelled" as const,
  label: "已取消",
  description: "仅展示筛选出的取消需求",
  tone: "gray"
};

const STATUS_OPTIONS = [
  ...STATUS_COLUMNS.map(({ value, label }) => ({ value, label })),
  { value: "cancelled", label: "已取消" }
];

const PRIORITY_OPTIONS: Array<{ value: RequirementPriority; label: string }> = [
  { value: "urgent", label: "紧急" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" }
];

const RISK_OPTIONS: Array<{ value: RiskFilter; label: string }> = [
  { value: "blocked", label: "存在依赖阻塞" },
  { value: "deadline", label: "截止日期风险" }
];

const EMPTY_REQUIREMENTS: MockRequirement[] = [];
const EMPTY_TASKS: MockTask[] = [];

const STAGE_META: Record<RequirementStage, { label: string; color: string }> = {
  todo: { label: "待开始", color: "default" },
  review: { label: "评审", color: "purple" },
  active: { label: "进行中", color: "processing" },
  completed: { label: "完成", color: "success" },
  cancelled: { label: "已取消", color: "default" }
};

const PRIORITY_META: Record<RequirementPriority, { label: string; color: string }> = {
  low: { label: "低", color: "default" },
  medium: { label: "中", color: "gold" },
  high: { label: "高", color: "orange" },
  urgent: { label: "紧急", color: "red" }
};

function RequirementStageTag({ stage }: { stage: RequirementStage }) {
  const meta = STAGE_META[stage];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function RequirementPriorityTag({ priority }: { priority: RequirementPriority }) {
  const meta = PRIORITY_META[priority];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function isDeadlineRisk(requirement: MockRequirement) {
  if (!requirement.deadline || ["completed", "cancelled"].includes(requirement.status))
    return false;
  return dayjs(requirement.deadline).diff(dayjs().startOf("day"), "day") <= 7;
}

function formatDateTime(value?: string) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";
}

function formatRecentUpdate(value?: string) {
  if (!value) return "未更新";
  const days = dayjs().startOf("day").diff(dayjs(value).startOf("day"), "day");
  if (days <= 0) return "今天更新";
  if (days === 1) return "昨天更新";
  return `${days} 天前更新`;
}

function formatDate(value?: string) {
  return value ? dayjs(value).format("YYYY-MM-DD") : "未设置";
}

function formatTokens(value: number) {
  if (!value) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

function RequirementProgress({ value }: { value: number }) {
  return (
    <div className="requirements-board__progress">
      <Progress percent={value} showInfo={false} strokeColor={{ from: "#2563eb", to: "#14b8a6" }} />
      <strong>{value}%</strong>
    </div>
  );
}

export function RequirementsListPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState(searchParams.get("keyword") ?? "");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedRequirement, setSelectedRequirement] = useState<MockRequirement>();
  const [selectedTask, setSelectedTask] = useState<MockTask>();

  const view = (searchParams.get("view") as BoardView | null) ?? "board";
  const keyword = searchParams.get("keyword") ?? "";
  const priority = (searchParams.get("priority") as RequirementPriority | null) ?? undefined;
  const status = (searchParams.get("status") as RequirementStage | null) ?? undefined;
  const risk = (searchParams.get("risk") as RiskFilter | null) ?? undefined;

  const updateParam = (key: string, value?: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  };

  const requirementsQuery = useQuery({
    queryKey: ["requirements-board", "requirements"],
    queryFn: () => requirementsBoardMockApi.listRequirements(),
    staleTime: 60_000
  });
  const tasksQuery = useQuery({
    queryKey: ["requirements-board", "tasks"],
    queryFn: () => requirementsBoardMockApi.listTasks(),
    staleTime: 30_000
  });

  const canMoveRequirement = Boolean(
    user && ["admin", "director", "pm", "team_leader"].includes(user.role)
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: RequirementStage }) =>
      requirementsBoardMockApi.updateRequirementStage(id, nextStatus),
    onMutate: async ({ id, nextStatus }) => {
      const queryKey = ["requirements-board", "requirements"] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MockRequirement[]>(queryKey);
      queryClient.setQueryData<MockRequirement[]>(queryKey, (current = []) =>
        current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item))
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["requirements-board", "requirements"], context.previous);
      }
      message.error(error instanceof Error ? error.message : "需求阶段更新失败");
    },
    onSuccess: () => message.success("需求阶段已更新（Mock）"),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: ["requirements-board", "requirements"] })
  });

  const requirements = requirementsQuery.data ?? EMPTY_REQUIREMENTS;
  const tasks = tasksQuery.data ?? EMPTY_TASKS;
  const tasksByRequirement = useMemo(() => {
    const result = new Map<string, MockTask[]>();
    tasks.forEach((task) => {
      const list = result.get(task.requirement_id) ?? [];
      list.push(task);
      result.set(task.requirement_id, list);
    });
    return result;
  }, [tasks]);

  const filteredRequirements = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return requirements.filter((requirement) => {
      const requirementTasks = tasksByRequirement.get(requirement.id) ?? [];
      const searchContent = [
        requirement.title,
        requirement.description,
        requirement.creator_name,
        ...requirement.team_names,
        ...requirement.acceptance_criteria,
        ...requirementTasks.flatMap((task) => [task.title, task.assignee_name ?? ""])
      ]
        .join(" ")
        .toLowerCase();
      const blocked = requirementTasks.some((task) => task.status === "blocked");
      const riskMatched =
        !risk ||
        (risk === "blocked" && blocked) ||
        (risk === "deadline" && isDeadlineRisk(requirement));
      const statusMatched = status
        ? requirement.status === status
        : requirement.status !== "cancelled";
      return (
        (!normalizedKeyword || searchContent.includes(normalizedKeyword)) &&
        (!priority || requirement.priority === priority) &&
        statusMatched &&
        riskMatched
      );
    });
  }, [keyword, priority, requirements, risk, status, tasksByRequirement]);

  const metrics = useMemo<
    Array<{
      key: string;
      title: string;
      value: number;
      description: string;
      tone: RequirementMetricTone;
      icon: ReactNode;
    }>
  >(
    () => [
      {
        key: "total",
        title: "有效需求",
        value: requirements.filter((item) => item.status !== "cancelled").length,
        description: "不含已取消需求",
        tone: "primary",
        icon: <UnorderedListOutlined />
      },
      {
        key: "review",
        title: "待评审",
        value: requirements.filter((item) => item.status === "review").length,
        description: "确认范围和验收标准",
        tone: "warning",
        icon: <FileTextOutlined />
      },
      {
        key: "active",
        title: "进行中",
        value: requirements.filter((item) => item.status === "active").length,
        description: "任务正在推进",
        tone: "info",
        icon: <ClockCircleOutlined />
      },
      {
        key: "blocked",
        title: "依赖阻塞",
        value: tasks.filter((item) => item.status === "blocked").length,
        description: "仅由任务依赖产生",
        tone: "danger",
        icon: <WarningOutlined />
      }
    ],
    [requirements, tasks]
  );

  const visibleColumns = status === "cancelled" ? [CANCELLED_COLUMN] : STATUS_COLUMNS;

  const handleDrop = (result: DropResult) => {
    if (!result.destination || !canMoveRequirement) return;
    const nextStatus = result.destination.droppableId as RequirementStage;
    const requirement = requirements.find((item) => item.id === result.draggableId);
    if (!requirement || requirement.status === nextStatus || nextStatus === "cancelled") return;
    statusMutation.mutate({ id: requirement.id, nextStatus });
  };

  const toggleRequirement = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addTask = (requirementId: string) =>
    navigate(`/tasks/create?requirement_id=${encodeURIComponent(requirementId)}`);

  const refreshAll = () => void Promise.all([requirementsQuery.refetch(), tasksQuery.refetch()]);

  return (
    <PagePanel
      title="需求看板"
      className="requirements-board-page"
      description="按需求阶段查看整体推进，在任务树中定位进度、依赖与执行证据"
      breadcrumbs={[{ title: "业务" }, { title: "需求看板" }]}
    >
      <RequirementMetricGrid>
        {metrics.map((metric) => (
          <RequirementMetricCard
            key={metric.key}
            metric={metric}
            icon={metric.icon}
            tone={metric.tone}
            loading={requirementsQuery.isLoading || tasksQuery.isLoading}
          />
        ))}
      </RequirementMetricGrid>

      <section className="requirements-board__workspace">
        <div className="requirements-board__workspace-head">
          <div className="requirements-board__workspace-title">
            <div>
              <h2>{view === "board" ? "按阶段推进" : "需求与任务树"}</h2>
              <p>
                {view === "board"
                  ? "需求卡片仅展示摘要；拖动卡片可调整推进阶段。"
                  : "展开需求查看任务负责人、状态、进度、依赖和最近更新。"}
              </p>
            </div>
            <div className="requirements-board__workspace-actions">
              <Segmented
                value={view}
                onChange={(next) => updateParam("view", String(next))}
                options={[
                  { value: "board", label: "需求看板", icon: <AppstoreOutlined /> },
                  { value: "tree", label: "任务树", icon: <UnorderedListOutlined /> }
                ]}
              />
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  loading={requirementsQuery.isFetching || tasksQuery.isFetching}
                  onClick={refreshAll}
                >
                  刷新
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate(appendSearch("/requirements/create", searchParams))}
                >
                  新建需求
                </Button>
              </Space>
            </div>
          </div>

          <div className="requirements-board__toolbar">
            <Input.Search
              allowClear
              value={searchDraft}
              placeholder="搜索需求、任务或负责人"
              onChange={(event) => setSearchDraft(event.target.value)}
              onSearch={(value) => updateParam("keyword", value.trim() || undefined)}
            />
            <Select
              allowClear
              placeholder="全部阶段"
              value={status}
              onChange={(next) => updateParam("status", next)}
              options={STATUS_OPTIONS}
            />
            <Select
              allowClear
              placeholder="全部优先级"
              value={priority}
              onChange={(next) => updateParam("priority", next)}
              options={PRIORITY_OPTIONS}
            />
            <Select
              allowClear
              placeholder="全部风险"
              value={risk}
              onChange={(next) => updateParam("risk", next)}
              options={RISK_OPTIONS}
            />
            {view === "tree" ? (
              <Button
                onClick={() =>
                  setExpanded(
                    filteredRequirements.every((item) => expanded.has(item.id))
                      ? new Set()
                      : new Set(filteredRequirements.map((item) => item.id))
                  )
                }
              >
                展开 / 收起全部
              </Button>
            ) : null}
            <Button
              onClick={() => {
                setSearchDraft("");
                setSearchParams(view === "board" ? {} : { view }, { replace: true });
              }}
            >
              重置
            </Button>
          </div>
        </div>

        {requirementsQuery.isError || tasksQuery.isError ? (
          <Alert
            className="requirements-board__alert"
            type="error"
            showIcon
            message="Mock 数据加载失败"
            description="需求或任务数据未能正确加载，请重试。"
            action={<Button onClick={refreshAll}>重试</Button>}
          />
        ) : null}

        <div className="requirements-board__content">
          {requirementsQuery.isLoading ? (
            <div className="requirements-board__loading">
              <Skeleton active paragraph={{ rows: 8 }} />
            </div>
          ) : filteredRequirements.length === 0 ? (
            <Empty description="没有符合条件的需求" />
          ) : view === "board" ? (
            <DragDropContext onDragEnd={handleDrop}>
              <div
                className={`requirements-board__columns${
                  visibleColumns.length === 1 ? " is-filter-result" : ""
                }`}
              >
                {visibleColumns.map((column) => {
                  const columnRequirements = filteredRequirements.filter(
                    (item) => item.status === column.value
                  );
                  return (
                    <Droppable droppableId={column.value} key={column.value}>
                      {(provided, snapshot) => (
                        <section
                          className={`requirements-board__column is-${column.tone}${
                            snapshot.isDraggingOver ? " is-dragging-over" : ""
                          }`}
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                        >
                          <header>
                            <div>
                              <span className="requirements-board__status-dot" />
                              <strong>{column.label}</strong>
                              <Tag bordered={false}>{columnRequirements.length}</Tag>
                            </div>
                            <small>{column.description}</small>
                          </header>
                          <div className="requirements-board__card-list">
                            {columnRequirements.map((requirement, index) => (
                              <RequirementCard
                                key={requirement.id}
                                requirement={requirement}
                                tasks={tasksByRequirement.get(requirement.id) ?? []}
                                index={index}
                                draggable={canMoveRequirement && column.value !== "cancelled"}
                                onOpen={() => setSelectedRequirement(requirement)}
                                onAddTask={() => addTask(requirement.id)}
                              />
                            ))}
                            {provided.placeholder}
                            {!columnRequirements.length ? (
                              <div className="requirements-board__column-empty">暂无需求</div>
                            ) : null}
                          </div>
                        </section>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </DragDropContext>
          ) : (
            <RequirementTree
              requirements={filteredRequirements}
              expanded={expanded}
              tasksByRequirement={tasksByRequirement}
              onToggle={toggleRequirement}
              onOpenRequirement={setSelectedRequirement}
              onOpenTask={(task) => setSelectedTask(task)}
              onAddTask={addTask}
            />
          )}
        </div>
      </section>

      <RequirementDrawer
        requirement={selectedRequirement}
        tasks={selectedRequirement ? (tasksByRequirement.get(selectedRequirement.id) ?? []) : []}
        onClose={() => setSelectedRequirement(undefined)}
        onAddTask={addTask}
        onOpenTask={(task) => setSelectedTask(task)}
        onOpenDetail={(requirementId) => navigate(`/requirements/${requirementId}`)}
      />
      <TaskDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(undefined)}
        onSaved={(updated) => setSelectedTask(updated)}
      />
    </PagePanel>
  );
}

function RequirementCard({
  requirement,
  tasks,
  index,
  draggable,
  onOpen,
  onAddTask
}: {
  requirement: MockRequirement;
  tasks: MockTask[];
  index: number;
  draggable: boolean;
  onOpen: () => void;
  onAddTask: () => void;
}) {
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const tokenTotal = tasks.reduce((total, task) => total + task.token_total, 0);

  return (
    <Draggable draggableId={requirement.id} index={index} isDragDisabled={!draggable}>
      {(provided, snapshot) => (
        <article
          className={`requirements-board__card${snapshot.isDragging ? " is-dragging" : ""}`}
          ref={provided.innerRef}
          {...provided.draggableProps}
          onClick={onOpen}
        >
          <div className="requirements-board__card-head">
            <div className="requirements-board__drag" {...provided.dragHandleProps}>
              {draggable ? <HolderOutlined /> : null}
            </div>
            <div>
              <h3>{requirement.title}</h3>
              <p>{requirement.description || "暂无需求描述"}</p>
            </div>
          </div>
          <div className="requirements-board__tags">
            <RequirementPriorityTag priority={requirement.priority} />
            {blockedTasks ? <Tag color="error">{blockedTasks} 个依赖阻塞</Tag> : null}
            {isDeadlineRisk(requirement) ? <Tag color="warning">截止风险</Tag> : null}
            {!requirement.acceptance_criteria.length ? <Tag color="warning">缺验收标准</Tag> : null}
          </div>

          {!tasks.length ? (
            <div className="requirements-board__unsplit">
              <span>未拆分任务</span>
              <Button
                size="small"
                type="link"
                icon={<PlusOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  onAddTask();
                }}
              >
                添加任务
              </Button>
            </div>
          ) : (
            <div className="requirements-board__card-summary">
              <strong>任务 {completedTasks}/{tasks.length}</strong>
              {tokenTotal > 0 ? <span>Token {formatTokens(tokenTotal)}</span> : null}
            </div>
          )}
          <footer>
            <span>
              <TeamOutlined /> {requirement.team_names.join("、") || "未分配团队"}
            </span>
            <span>
              <CalendarOutlined /> {formatDate(requirement.deadline)}
            </span>
          </footer>
        </article>
      )}
    </Draggable>
  );
}

function RequirementTree({
  requirements,
  expanded,
  tasksByRequirement,
  onToggle,
  onOpenRequirement,
  onOpenTask,
  onAddTask
}: {
  requirements: MockRequirement[];
  expanded: Set<string>;
  tasksByRequirement: Map<string, MockTask[]>;
  onToggle: (id: string) => void;
  onOpenRequirement: (requirement: MockRequirement) => void;
  onOpenTask: (task: MockTask) => void;
  onAddTask: (requirementId: string) => void;
}) {
  return (
    <div className="requirements-tree">
      <div className="requirements-tree__header">
        <span>需求 / 任务</span>
        <span>团队 / 负责人</span>
        <span>状态</span>
        <span>进度</span>
        <span>上游依赖</span>
        <span>最近更新</span>
        <span>操作</span>
      </div>
      <div className="requirements-tree__body">
        {requirements.map((requirement) => {
          const requirementTasks = tasksByRequirement.get(requirement.id) ?? [];
          const isExpanded = expanded.has(requirement.id);
          return (
            <div key={requirement.id}>
              <div
                className="requirements-tree__row is-requirement"
                onClick={() => onOpenRequirement(requirement)}
              >
                <div className="requirements-tree__title">
                  <button
                    type="button"
                    aria-label={isExpanded ? "收起任务" : "展开任务"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggle(requirement.id);
                    }}
                  >
                    {isExpanded ? <DownOutlined /> : <RightOutlined />}
                  </button>
                  <Tag color="blue">需求</Tag>
                  <div>
                    <strong>{requirement.title}</strong>
                    <small>{requirement.description || "暂无描述"}</small>
                  </div>
                </div>
                <span>{requirement.team_names.join("、") || "-"}</span>
                <RequirementStageTag stage={requirement.status} />
                <span>-</span>
                <span>-</span>
                <span>{formatRecentUpdate(requirement.updated_at)}</span>
                <Space size={4}>
                  {!requirementTasks.length ? (
                    <Button
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAddTask(requirement.id);
                      }}
                    >
                      添加任务
                    </Button>
                  ) : null}
                </Space>
              </div>

              {isExpanded && !requirementTasks.length ? (
                <div className="requirements-tree__empty">
                  <span>该需求尚未拆分任务</span>
                  <Button
                    size="small"
                    type="link"
                    icon={<PlusOutlined />}
                    onClick={() => onAddTask(requirement.id)}
                  >
                    添加任务
                  </Button>
                </div>
              ) : null}

              {isExpanded
                ? requirementTasks.map((task) => (
                    <div
                      className="requirements-tree__row is-task"
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                    >
                      <div className="requirements-tree__title">
                        <span className="requirements-tree__indent" />
                        <Tag color="purple">任务</Tag>
                        <div>
                          <strong>{task.title}</strong>
                          <small>{formatDateTime(task.updated_at)} 更新</small>
                        </div>
                      </div>
                      <span>{task.assignee_name || "未分配"}</span>
                      <TaskStatusTag status={task.status} />
                      <RequirementProgress value={task.progress} />
                      <div className="requirements-tree__dependencies">
                        {task.dependencies.length ? (
                          task.dependencies.map((dependency) => (
                            <Tag
                              key={dependency.task_id}
                              color={dependency.status === "done" ? "success" : "warning"}
                            >
                              {dependency.task_title}
                            </Tag>
                          ))
                        ) : (
                          <span>-</span>
                        )}
                      </div>
                      <div className="requirements-tree__update">
                        <span>{formatRecentUpdate(task.updated_at)}</span>
                        <small>{task.token_total > 0 ? `${formatTokens(task.token_total)} Token` : "人工更新"}</small>
                      </div>
                      <Space size={4}>
                        <Button
                          size="small"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenTask(task);
                          }}
                        >
                          详情
                        </Button>
                      </Space>
                    </div>
                  ))
                : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RequirementDrawer({
  requirement,
  tasks,
  onClose,
  onAddTask,
  onOpenTask,
  onOpenDetail
}: {
  requirement?: MockRequirement;
  tasks: MockTask[];
  onClose: () => void;
  onAddTask: (requirementId: string) => void;
  onOpenTask: (task: MockTask) => void;
  onOpenDetail: (requirementId: string) => void;
}) {
  const tokenTotal = tasks.reduce((total, task) => total + task.token_total, 0);
  const completedCount = tasks.filter((task) => task.status === "done").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;

  return (
    <Drawer
      className="requirements-drawer"
      width={580}
      open={Boolean(requirement)}
      onClose={onClose}
      title={
        requirement ? (
          <div className="requirements-drawer__title">
            <small>需求详情</small>
            <strong>{requirement.title}</strong>
          </div>
        ) : null
      }
      extra={
        requirement ? <Button onClick={() => onOpenDetail(requirement.id)}>完整详情</Button> : null
      }
    >
      {requirement ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <section className="requirements-drawer__summary">
            <div>
              <RequirementStageTag stage={requirement.status} />
              <RequirementPriorityTag priority={requirement.priority} />
            </div>
            <p>{requirement.description || "暂无需求描述"}</p>
            {tasks.length ? (
              <RequirementProgress value={requirement.progress} />
            ) : (
              <Tag>未拆分任务</Tag>
            )}
          </section>

          <section className="requirements-drawer__section">
            <h3>基础信息</h3>
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="创建者">
                {requirement.creator_name}（
                {ROLE_LABELS[requirement.creator_role as UserRole] ?? requirement.creator_role}）
              </Descriptions.Item>
              <Descriptions.Item label="参与团队">
                {requirement.team_names.join("、") || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="截止日期">
                {formatDate(requirement.deadline)}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {formatDateTime(requirement.updated_at)}
              </Descriptions.Item>
              <Descriptions.Item label="飞书文档">
                {requirement.feishu_doc_url ? (
                  <a href={requirement.feishu_doc_url} target="_blank" rel="noreferrer">
                    <LinkOutlined /> 打开文档
                  </a>
                ) : (
                  "-"
                )}
              </Descriptions.Item>
            </Descriptions>
          </section>

          <section className="requirements-drawer__section">
            <div className="requirements-drawer__section-head">
              <h3>验收标准</h3>
              <Tag>{requirement.acceptance_criteria.length} 项</Tag>
            </div>
            {requirement.acceptance_criteria.length ? (
              <ol className="requirements-drawer__ac-list">
                {requirement.acceptance_criteria.map((item, index) => (
                  <li key={`${index}-${item}`}>
                    <span>标准 {index + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无验收标准" />
            )}
          </section>

          <section className="requirements-drawer__section">
            <div className="requirements-drawer__section-head">
              <h3>执行拆解</h3>
              <Space size={6} wrap>
                <Tag>{tasks.length} 个任务</Tag>
                <Tag color="success">{completedCount} 个完成</Tag>
                <Tag color={blockedCount ? "error" : "default"}>{blockedCount} 个依赖阻塞</Tag>
              </Space>
            </div>
            {!tasks.length ? (
              <div className="requirements-drawer__execution-empty">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="该需求尚未拆分任务，拆分任务后可聚合进度、依赖阻塞和 Token。"
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => onAddTask(requirement.id)}
                >
                  添加第一个任务
                </Button>
              </div>
            ) : (
              <div className="requirements-drawer__task-list">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="requirements-drawer__task-item"
                    onClick={() => onOpenTask(task)}
                  >
                    <div>
                      <strong>{task.title}</strong>
                      <span>
                        {task.assignee_name || "未分配"} · {formatDate(task.due_date)}
                      </span>
                    </div>
                    <TaskStatusTag status={task.status} />
                    <RequirementProgress value={task.progress} />
                    <small>
                      {task.dependencies.length ? `${task.dependencies.length} 个上游依赖` : "无上游依赖"}
                      {task.token_total > 0 ? ` · ${formatTokens(task.token_total)} Token` : " · 人工更新"}
                    </small>
                  </button>
                ))}
              </div>
            )}
            {tasks.length ? (
              <div className="requirements-drawer__execution-footer">
                <Button icon={<PlusOutlined />} onClick={() => onAddTask(requirement.id)}>
                  继续添加任务
                </Button>
              </div>
            ) : null}
          </section>
          <section className="requirements-drawer__section">
            <div className="requirements-drawer__section-head">
              <h3>Token 摘要</h3>
              {tokenTotal > 0 ? <strong>{formatTokens(tokenTotal)} Token</strong> : <span>暂无已关联 Token</span>}
            </div>
            {tokenTotal > 0 ? (
              <Collapse
                ghost
                items={[{
                  key: "token-sources",
                  label: "Token 来源明细",
                  children: (
                    <Space direction="vertical" size={8} style={{ width: "100%" }}>
                      {tasks.filter((task) => task.token_total > 0).map((task) => (
                        <div key={task.id} className="requirements-drawer__token-source">
                          <span>{task.title}</span>
                          <strong>{formatTokens(task.token_total)} Token</strong>
                        </div>
                      ))}
                    </Space>
                  )
                }]}
              />
            ) : null}
          </section>
        </Space>
      ) : null}
    </Drawer>
  );
}

function TaskDrawer({
  task,
  onClose,
  onSaved
}: {
  task?: MockTask;
  onClose: () => void;
  onSaved: (task: MockTask) => void;
}) {
  return (
    <Drawer
      className="requirements-drawer"
      width={540}
      open={Boolean(task)}
      onClose={onClose}
      title={task ? `任务详情 · ${task.title}` : "任务详情"}
    >
      {task ? (
        <TaskDrawerContent key={`${task.id}-${task.updated_at}`} task={task} onSaved={onSaved} />
      ) : null}
    </Drawer>
  );
}

function TaskDrawerContent({ task, onSaved }: { task: MockTask; onSaved: (task: MockTask) => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(task.progress);
  const dependencyBlocked = task.dependencies.some((dependency) => dependency.status !== "done");
  const mutation = useMutation({
    mutationFn: () => requirementsBoardMockApi.updateTaskProgress(task.id, progress),
    onSuccess: (updated) => {
      message.success("任务进度已保存（Mock）");
      onSaved(updated);
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "进度保存失败")
  });

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <section className="requirements-drawer__section">
        <h3>基础信息</h3>
        <Descriptions column={1} size="small" colon={false}>
          <Descriptions.Item label="所属需求">{task.requirement_title}</Descriptions.Item>
          <Descriptions.Item label="负责人">{task.assignee_name || "未分配"}</Descriptions.Item>
          <Descriptions.Item label="状态"><TaskStatusTag status={task.status} /></Descriptions.Item>
          <Descriptions.Item label="上游依赖">
            {task.dependencies.length
              ? task.dependencies.map((dependency) => (
                  <Tag key={dependency.task_id} color={dependency.status === "done" ? "success" : "error"}>
                    {dependency.task_title}
                  </Tag>
                ))
              : "无"}
          </Descriptions.Item>
        </Descriptions>
        {dependencyBlocked ? (
          <Alert type="warning" showIcon message="上游任务未完成，当前任务处于依赖阻塞" />
        ) : null}
      </section>

      <section className="requirements-drawer__section">
        <h3>进度更新</h3>
        <p>进度由用户确认，可不关联 Token 来源。</p>
        <div className="requirements-drawer__progress-editor">
          <Slider min={0} max={100} value={progress} onChange={setProgress} />
          <InputNumber
            min={0}
            max={100}
            value={progress}
            addonAfter="%"
            onChange={(value) => setProgress(value ?? 0)}
          />
          <Button
            type="primary"
            loading={mutation.isPending}
            disabled={progress === task.progress}
            onClick={() => mutation.mutate()}
          >
            保存进度
          </Button>
        </div>
      </section>

      <section className="requirements-drawer__section">
        <div className="requirements-drawer__section-head">
          <h3>Token 来源</h3>
          {task.token_total > 0 ? <strong>已关联 {formatTokens(task.token_total)} Token</strong> : <span>人工更新</span>}
        </div>
        {task.token_total > 0 ? (
          <Collapse
            ghost
            items={[{
              key: "sources",
              label: "Token 来源明细",
              children: <p>AI 编码工作记录 · {formatTokens(task.token_total)} Token</p>
            }]}
          />
        ) : (
          <p>当前任务未关联 Token 来源，仍可正常更新进度。</p>
        )}
      </section>
    </Space>
  );
}
