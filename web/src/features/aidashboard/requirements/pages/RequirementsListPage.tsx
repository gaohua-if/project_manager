import {
  AppstoreOutlined,
  CalendarOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  DownOutlined,
  FileTextOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  StarFilled,
  StarOutlined,
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
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Segmented,
  Skeleton,
  Slider,
  Space,
  Table,
  Tag
} from "antd";
import type { TableProps } from "antd";
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
import { requirementsBoardApi } from "../api/requirementsBoardApi";
import type {
  FavoriteTargetType,
  MockAssignee,
  MockFavorite,
  MockRequirement,
  MockTask,
  MockTaskPriority,
  MockTaskStatus,
  MockTokenSource,
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
  emptyText: string;
  tone: string;
}> = [
  {
    value: "todo",
    label: "待开始",
    description: "等待拆解或排期",
    emptyText: "暂无待开始需求",
    tone: "gray"
  },
  {
    value: "review",
    label: "评审",
    description: "确认范围与验收标准",
    emptyText: "暂无评审中需求",
    tone: "purple"
  },
  {
    value: "active",
    label: "进行中",
    description: "任务正在推进",
    emptyText: "暂无进行中需求",
    tone: "blue"
  },
  {
    value: "completed",
    label: "完成",
    description: "最近 5 个",
    emptyText: "暂无最近完成需求",
    tone: "green"
  }
];

const COMPLETED_RECENT_DAYS = 7;
const COMPLETED_RECENT_LIMIT = 10;

const CANCELLED_COLUMN = {
  value: "cancelled" as const,
  label: "已取消",
  description: "已取消的需求",
  emptyText: "暂无已取消需求",
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
const EMPTY_TOKEN_SOURCES: MockTokenSource[] = [];
const EMPTY_FAVORITES: MockFavorite[] = [];

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
  return Boolean(
    requirement.risk_summary &&
      (requirement.risk_summary.overdue > 0 || requirement.risk_summary.due_soon > 0)
  );
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

function sumTokensFromSources(ids: string[], sourceMap: Map<string, MockTokenSource>) {
  return ids.reduce((total, id) => total + (sourceMap.get(id)?.token ?? 0), 0);
}

function aggregateRequirementTokens(
  requirement: MockRequirement,
  requirementTasks: MockTask[],
  sourceMap: Map<string, MockTokenSource>
) {
  const reqLevel = sumTokensFromSources(requirement.token_source_ids, sourceMap);
  const taskLevel = requirementTasks.reduce(
    (total, task) => total + sumTokensFromSources(task.token_source_ids, sourceMap),
    0
  );
  return reqLevel + taskLevel;
}

function formatTokenSourceTime(value: string) {
  return dayjs(value).format("MM-DD HH:mm");
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
  const [creatorOpen, setCreatorOpen] = useState(false);

  const view = (searchParams.get("view") as BoardView | null) ?? "board";
  const keyword = searchParams.get("keyword") ?? "";
  const priority = (searchParams.get("priority") as RequirementPriority | null) ?? undefined;
  const status = (searchParams.get("status") as RequirementStage | null) ?? undefined;
  const risk = (searchParams.get("risk") as RiskFilter | null) ?? undefined;
  const onlyFavorite = searchParams.get("favorite") === "1";

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
    queryFn: () => requirementsBoardApi.listRequirements(),
    staleTime: 60_000
  });
  const tasksQuery = useQuery({
    queryKey: ["requirements-board", "tasks"],
    queryFn: () => requirementsBoardApi.listTasks(),
    staleTime: 30_000
  });
  const tokenSourcesQuery = useQuery({
    queryKey: ["requirements-board", "token-sources"],
    queryFn: () => requirementsBoardApi.listTokenSources(),
    staleTime: 60_000
  });
  const favoritesQuery = useQuery({
    queryKey: ["requirements-board", "favorites"],
    queryFn: () => requirementsBoardApi.listFavorites(),
    staleTime: 60_000
  });
  const tokenSources = tokenSourcesQuery.data ?? EMPTY_TOKEN_SOURCES;
  const tokenSourceMap = useMemo(
    () => new Map(tokenSources.map((source) => [source.id, source])),
    [tokenSources]
  );

  const favorites = favoritesQuery.data ?? EMPTY_FAVORITES;
  const favoriteRequirementIds = useMemo(
    () =>
      new Set(
        favorites.filter((item) => item.target_type === "requirement").map((item) => item.target_id)
      ),
    [favorites]
  );
  const favoriteTaskIds = useMemo(
    () => new Set(favorites.filter((item) => item.target_type === "task").map((item) => item.target_id)),
    [favorites]
  );

  const favoriteMutation = useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: FavoriteTargetType; targetId: string }) =>
      requirementsBoardApi.toggleFavorite(targetType, targetId),
    onSuccess: (result) => {
      message.success(result.favorited ? "已加入我关注的" : "已取消关注");
      void queryClient.invalidateQueries({ queryKey: ["requirements-board", "favorites"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "关注操作失败")
  });
  const toggleRequirementFavorite = (requirementId: string) =>
    favoriteMutation.mutate({ targetType: "requirement", targetId: requirementId });
  const toggleTaskFavorite = (taskId: string) =>
    favoriteMutation.mutate({ targetType: "task", targetId: taskId });

  const canMoveRequirement = Boolean(
    user && ["admin", "director", "pm", "team_leader"].includes(user.role)
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: RequirementStage }) =>
      requirementsBoardApi.updateRequirementStage(id, nextStatus),
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
    onSuccess: () => message.success("需求阶段已更新"),
    onSettled: () =>
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requirements-board", "requirements"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] })
      ])
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

  const navigationTask = tasks.find((item) => item.id === searchParams.get("taskId"));
  const navigationRequirement = navigationTask
    ? undefined
    : requirements.find((item) => item.id === searchParams.get("requirementId"));
  const activeRequirement = selectedRequirement ?? navigationRequirement;
  const activeTask = selectedTask ?? navigationTask;

  const clearNavigationTarget = () => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("requirementId");
        next.delete("taskId");
        return next;
      },
      { replace: true }
    );
  };

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
      const favoriteMatched =
        !onlyFavorite ||
        favoriteRequirementIds.has(requirement.id) ||
        requirementTasks.some((task) => favoriteTaskIds.has(task.id));
      return (
        (!normalizedKeyword || searchContent.includes(normalizedKeyword)) &&
        (!priority || requirement.priority === priority) &&
        statusMatched &&
        riskMatched &&
        favoriteMatched
      );
    });
  }, [
    favoriteRequirementIds,
    favoriteTaskIds,
    keyword,
    onlyFavorite,
    priority,
    requirements,
    risk,
    status,
    tasksByRequirement
  ]);

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
        description: "任务依赖未完成",
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

  const addTask = (requirementId: string) => {
    const target = requirements.find((item) => item.id === requirementId);
    if (!target) return;
    setSelectedRequirement(target);
    setSelectedTask(undefined);
    setCreatorOpen(true);
  };

  const refreshAll = () =>
    void Promise.all([
      requirementsQuery.refetch(),
      tasksQuery.refetch(),
      tokenSourcesQuery.refetch()
    ]);

  return (
    <PagePanel
      title="需求看板"
      className="requirements-board-page"
      description="按阶段管理需求推进，跟踪任务进度、依赖与 Token 来源"
      breadcrumbs={[{ title: "业务" }, { title: "需求看板" }]}
      showNav={false}
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
              <h2>{view === "board" ? "按阶段推进需求" : "需求与任务树"}</h2>
              <p>
                {view === "board"
                  ? "展示需求当前阶段、任务拆分和依赖状态。"
                  : "查看需求与任务两层结构、负责人、依赖与最近更新。"}
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
                  icon={onlyFavorite ? <StarFilled style={{ color: "#f59e0b" }} /> : <StarOutlined />}
                  type={onlyFavorite ? "primary" : "default"}
                  ghost={onlyFavorite}
                  onClick={() => updateParam("favorite", onlyFavorite ? undefined : "1")}
                >
                  我关注的
                </Button>
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
            message="需求数据加载失败"
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
            <Empty description="暂无符合条件的需求" />
          ) : view === "board" ? (
            <DragDropContext onDragEnd={handleDrop}>
              <div
                className={`requirements-board__columns${
                  visibleColumns.length === 1 ? " is-filter-result" : ""
                }`}
              >
                {visibleColumns.map((column) => {
                  const allColumnRequirements = filteredRequirements.filter(
                    (item) => item.status === column.value
                  );
                  const isCompletedColumn =
                    column.value === "completed" && status !== "completed";
                  const recentCompleted = isCompletedColumn
                    ? allColumnRequirements
                        .filter(
                          (item) =>
                            dayjs().diff(dayjs(item.updated_at), "day") < COMPLETED_RECENT_DAYS
                        )
                        .sort((a, b) => dayjs(b.updated_at).diff(dayjs(a.updated_at)))
                        .slice(0, COMPLETED_RECENT_LIMIT)
                    : null;
                  const columnRequirements = recentCompleted ?? allColumnRequirements;
                  const hiddenCompletedCount = isCompletedColumn
                    ? allColumnRequirements.length - columnRequirements.length
                    : 0;
                  const headerCountBadge = isCompletedColumn
                    ? allColumnRequirements.length
                    : columnRequirements.length;
                  const completedShownCount = columnRequirements.length;
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
                          <header title={column.description}>
                            <div className="requirements-board__column-head-left">
                              <span className="requirements-board__status-dot" />
                              <strong>{column.label}</strong>
                              <Tag bordered={false}>{headerCountBadge}</Tag>
                            </div>
                            {isCompletedColumn ? (
                              hiddenCompletedCount > 0 ? (
                                <button
                                  type="button"
                                  className="requirements-board__column-head-link"
                                  onClick={() =>
                                    setSearchParams(
                                      (previous) => {
                                        const nextParams = new URLSearchParams(previous);
                                        nextParams.set("status", "completed");
                                        nextParams.set("view", "tree");
                                        return nextParams;
                                      },
                                      { replace: true }
                                    )
                                  }
                                >
                                  查看全部
                                </button>
                              ) : (
                                <span className="requirements-board__column-head-meta">
                                  最近 {completedShownCount} 个
                                </span>
                              )
                            ) : null}
                          </header>
                          <div className="requirements-board__card-list">
                            {columnRequirements.map((requirement, index) => (
                              <RequirementCard
                                key={requirement.id}
                                requirement={requirement}
                                tasks={tasksByRequirement.get(requirement.id) ?? []}
                                tokenSourceMap={tokenSourceMap}
                                index={index}
                                draggable={canMoveRequirement && column.value !== "cancelled"}
                                isCompletedColumn={column.value === "completed"}
                                isFavorite={favoriteRequirementIds.has(requirement.id)}
                                onToggleFavorite={() => toggleRequirementFavorite(requirement.id)}
                                onOpen={() => setSelectedRequirement(requirement)}
                              />
                            ))}
                            {provided.placeholder}
                            {!columnRequirements.length ? (
                              <div className="requirements-board__column-empty">
                                {column.emptyText}
                              </div>
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
              tokenSourceMap={tokenSourceMap}
              favoriteRequirementIds={favoriteRequirementIds}
              favoriteTaskIds={favoriteTaskIds}
              onToggle={toggleRequirement}
              onOpenRequirement={setSelectedRequirement}
              onOpenTask={(task) => setSelectedTask(task)}
              onAddTask={addTask}
              onToggleRequirementFavorite={toggleRequirementFavorite}
              onToggleTaskFavorite={toggleTaskFavorite}
            />
          )}
        </div>
      </section>

      <RequirementDrawer
        requirement={activeRequirement}
        tasks={activeRequirement ? (tasksByRequirement.get(activeRequirement.id) ?? []) : []}
        tokenSources={tokenSources}
        tokenSourceMap={tokenSourceMap}
        creatorOpen={creatorOpen}
        isFavorite={
          activeRequirement ? favoriteRequirementIds.has(activeRequirement.id) : false
        }
        onToggleFavorite={
          activeRequirement
            ? () => toggleRequirementFavorite(activeRequirement.id)
            : undefined
        }
        onCreatorOpenChange={setCreatorOpen}
        onClose={() => {
          setSelectedRequirement(undefined);
          setCreatorOpen(false);
          clearNavigationTarget();
        }}
        onOpenTask={(task) => setSelectedTask(task)}
      />
      <TaskDrawer
        task={activeTask}
        requirementTasks={
          activeTask ? (tasksByRequirement.get(activeTask.requirement_id) ?? []) : []
        }
        tokenSources={tokenSources}
        tokenSourceMap={tokenSourceMap}
        isFavorite={activeTask ? favoriteTaskIds.has(activeTask.id) : false}
        onToggleFavorite={activeTask ? () => toggleTaskFavorite(activeTask.id) : undefined}
        onClose={() => {
          setSelectedTask(undefined);
          clearNavigationTarget();
        }}
        onSaved={(updated) => setSelectedTask(updated)}
      />
    </PagePanel>
  );
}

function RequirementCard({
  requirement,
  tasks,
  tokenSourceMap,
  index,
  draggable,
  isCompletedColumn,
  isFavorite,
  onToggleFavorite,
  onOpen
}: {
  requirement: MockRequirement;
  tasks: MockTask[];
  tokenSourceMap: Map<string, MockTokenSource>;
  index: number;
  draggable: boolean;
  isCompletedColumn: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onOpen: () => void;
}) {
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const tokenTotal = aggregateRequirementTokens(requirement, tasks, tokenSourceMap);
  const missingAC = requirement.acceptance_criteria.length === 0;
  const ownerLine =
    requirement.team_names.length > 0
      ? requirement.team_names.join("、")
      : requirement.creator_name;
  const summaryLeft = tasks.length
    ? `任务 ${completedTasks}/${tasks.length}${blockedTasks ? ` · ${blockedTasks} 个阻塞` : ""}`
    : "尚未拆分";
  const summaryRight = tokenTotal > 0 ? `Token ${formatTokens(tokenTotal)}` : "-";
  const showRiskRow =
    !isCompletedColumn && (missingAC || blockedTasks > 0 || isDeadlineRisk(requirement));
  const dateLabel = isCompletedColumn
    ? `完成 ${formatDate(requirement.updated_at)}`
    : formatDate(requirement.deadline);

  return (
    <Draggable draggableId={requirement.id} index={index} isDragDisabled={!draggable}>
      {(provided, snapshot) => (
        <article
          className={`requirements-board__card${snapshot.isDragging ? " is-dragging" : ""}`}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onOpen}
        >
          <div className="requirements-board__card-title">
            <h3 title={requirement.title}>{requirement.title}</h3>
            <Space size={6} align="center">
              <RequirementPriorityTag priority={requirement.priority} />
              <button
                type="button"
                className={`requirements-board__favorite${
                  isFavorite ? " is-active" : ""
                }`}
                aria-label={isFavorite ? "取消关注" : "关注需求"}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite();
                }}
              >
                {isFavorite ? (
                  <StarFilled style={{ color: "#f59e0b" }} />
                ) : (
                  <StarOutlined />
                )}
              </button>
            </Space>
          </div>

          {requirement.description ? (
            <p className="requirements-board__card-desc">{requirement.description}</p>
          ) : null}

          {showRiskRow ? (
            <div className="requirements-board__card-risks">
              {missingAC ? <Tag color="warning">缺验收标准</Tag> : null}
              {blockedTasks ? <Tag color="error">{blockedTasks} 个依赖阻塞</Tag> : null}
              {isDeadlineRisk(requirement) ? <Tag color="warning">截止风险</Tag> : null}
            </div>
          ) : null}

          <div className="requirements-board__card-summary">
            <span>{summaryLeft}</span>
            <span className="requirements-board__card-summary-right">{summaryRight}</span>
          </div>

          <footer>
            <span title={ownerLine || "未分配团队"}>
              <TeamOutlined /> {ownerLine || "未分配团队"}
            </span>
            <span>
              <CalendarOutlined /> {dateLabel}
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
  tokenSourceMap,
  favoriteRequirementIds,
  favoriteTaskIds,
  onToggle,
  onOpenRequirement,
  onOpenTask,
  onAddTask,
  onToggleRequirementFavorite,
  onToggleTaskFavorite
}: {
  requirements: MockRequirement[];
  expanded: Set<string>;
  tasksByRequirement: Map<string, MockTask[]>;
  tokenSourceMap: Map<string, MockTokenSource>;
  favoriteRequirementIds: Set<string>;
  favoriteTaskIds: Set<string>;
  onToggle: (id: string) => void;
  onOpenRequirement: (requirement: MockRequirement) => void;
  onOpenTask: (task: MockTask) => void;
  onAddTask: (requirementId: string) => void;
  onToggleRequirementFavorite: (requirementId: string) => void;
  onToggleTaskFavorite: (taskId: string) => void;
}) {
  return (
    <div className="requirements-tree">
      <div className="requirements-tree__header">
        <span>需求 / 任务</span>
        <span>团队 / 负责人</span>
        <span>状态</span>
        <span>进度</span>
        <span>上游依赖</span>
        <span>截止 / 更新</span>
        <span>操作</span>
      </div>
      <div className="requirements-tree__body">
        {requirements.map((requirement) => {
          const requirementTasks = tasksByRequirement.get(requirement.id) ?? [];
          const isExpanded = expanded.has(requirement.id);
          const doneTasks = requirementTasks.filter((t) => t.status === "done").length;
          const taskSummary = requirementTasks.length
            ? `${doneTasks}/${requirementTasks.length}`
            : "未拆分任务";
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
                  <button
                    type="button"
                    className={`requirements-tree__favorite${
                      favoriteRequirementIds.has(requirement.id) ? " is-active" : ""
                    }`}
                    aria-label={
                      favoriteRequirementIds.has(requirement.id) ? "取消关注" : "关注需求"
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleRequirementFavorite(requirement.id);
                    }}
                  >
                    {favoriteRequirementIds.has(requirement.id) ? (
                      <StarFilled style={{ color: "#f59e0b" }} />
                    ) : (
                      <StarOutlined />
                    )}
                  </button>
                </div>
                <span>{requirement.team_names.join("、") || "-"}</span>
                <RequirementStageTag stage={requirement.status} />
                <span>{taskSummary}</span>
                <span>-</span>
                <div className="requirements-tree__update">
                  <span>{formatDate(requirement.deadline)}</span>
                  <small>{formatRecentUpdate(requirement.updated_at)}</small>
                </div>
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
                  <span>尚未拆分任务</span>
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
                ? requirementTasks.map((task) => {
                    const taskTokens = sumTokensFromSources(task.token_source_ids, tokenSourceMap);
                    return (
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
                          <button
                            type="button"
                            className={`requirements-tree__favorite${
                              favoriteTaskIds.has(task.id) ? " is-active" : ""
                            }`}
                            aria-label={
                              favoriteTaskIds.has(task.id) ? "取消关注" : "关注任务"
                            }
                            onClick={(event) => {
                              event.stopPropagation();
                              onToggleTaskFavorite(task.id);
                            }}
                          >
                            {favoriteTaskIds.has(task.id) ? (
                              <StarFilled style={{ color: "#f59e0b" }} />
                            ) : (
                              <StarOutlined />
                            )}
                          </button>
                        </div>
                        <span>{task.assignee_name || "未分配"}</span>
                        <TaskStatusTag status={task.status} />
                        <RequirementProgress value={task.progress} />
                        <div className="requirements-tree__dependencies">
                          {task.dependencies.length ? (
                            task.dependencies.map((dependency) => (
                              <Tag
                                key={dependency.task_id}
                                color={dependency.status === "done" ? "success" : "error"}
                              >
                                {dependency.task_title}
                              </Tag>
                            ))
                          ) : (
                            <span>-</span>
                          )}
                        </div>
                        <div className="requirements-tree__update">
                          <span>{formatDate(task.due_date)}</span>
                          <small>{formatRecentUpdate(task.updated_at)}</small>
                        </div>
                        <Space size={4} direction="vertical" align="end">
                          {taskTokens > 0 ? (
                            <small style={{ color: "#7a879a", fontSize: 11 }}>
                              Token {formatTokens(taskTokens)}
                            </small>
                          ) : (
                            <small style={{ color: "#c2cad6", fontSize: 11 }}>-</small>
                          )}
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
                    );
                  })
                : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TokenSourcePickerProps {
  open: boolean;
  sources: MockTokenSource[];
  excludeIds: string[];
  onCancel: () => void;
  onConfirm: (ids: string[]) => Promise<void> | void;
  confirmLoading?: boolean;
}

function TokenSourcePicker({
  open,
  sources,
  excludeIds,
  onCancel,
  onConfirm,
  confirmLoading
}: TokenSourcePickerProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);
  const available = useMemo(
    () => sources.filter((source) => !excludeSet.has(source.id) && source.token > 0),
    [sources, excludeSet]
  );
  const selectedTokenTotal = useMemo(
    () =>
      selected.reduce((total, id) => {
        const source = available.find((item) => item.id === id);
        return total + (source?.token ?? 0);
      }, 0),
    [available, selected]
  );

  const columns: TableProps<MockTokenSource>["columns"] = [
    {
      title: "摘要",
      dataIndex: "summary",
      ellipsis: true
    },
    { title: "工具", dataIndex: "tool", width: 100 },
    { title: "上传人", dataIndex: "uploader", width: 100 },
    {
      title: "时间",
      dataIndex: "recorded_at",
      width: 120,
      render: (value: string) => formatTokenSourceTime(value)
    },
    {
      title: "Token",
      dataIndex: "token",
      width: 90,
      align: "right" as const,
      render: (value: number) => formatTokens(value)
    }
  ];

  return (
    <Modal
      title="关联 Token 来源"
      open={open}
      width={780}
      onCancel={() => {
        setSelected([]);
        onCancel();
      }}
      okText="确认关联"
      okButtonProps={{ disabled: !selected.length, loading: confirmLoading }}
      cancelText="取消"
      onOk={async () => {
        await onConfirm(selected);
        setSelected([]);
      }}
      destroyOnHidden
    >
      <p style={{ marginTop: 0, color: "#7a879a" }}>
        选择已上报的工作记录作为当前需求或任务的 Token 来源。
      </p>
      <Table<MockTokenSource>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={available}
        pagination={{ pageSize: 6, showSizeChanger: false }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as string[])
        }}
        locale={{ emptyText: "暂无可关联 Token 来源" }}
      />
      <div
        style={{
          marginTop: 12,
          color: "#526173",
          fontSize: 12,
          textAlign: "right"
        }}
      >
        已选 {selected.length} 条 · 累计 {formatTokens(selectedTokenTotal)} Token
      </div>
    </Modal>
  );
}

function RequirementDrawer({
  requirement,
  tasks,
  tokenSources,
  tokenSourceMap,
  creatorOpen,
  isFavorite,
  onToggleFavorite,
  onCreatorOpenChange,
  onClose,
  onOpenTask
}: {
  requirement?: MockRequirement;
  tasks: MockTask[];
  tokenSources: MockTokenSource[];
  tokenSourceMap: Map<string, MockTokenSource>;
  creatorOpen: boolean;
  isFavorite: boolean;
  onToggleFavorite?: () => void;
  onCreatorOpenChange: (open: boolean) => void;
  onClose: () => void;
  onOpenTask: (task: MockTask) => void;
}) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const requirementTokens = requirement
    ? sumTokensFromSources(requirement.token_source_ids, tokenSourceMap)
    : 0;
  const taskTokens = tasks.reduce(
    (total, task) => total + sumTokensFromSources(task.token_source_ids, tokenSourceMap),
    0
  );
  const totalTokens = requirementTokens + taskTokens;
  const completedCount = tasks.filter((task) => task.status === "done").length;
  const blockedCount = tasks.filter((task) => task.status === "blocked").length;

  const linkMutation = useMutation({
    mutationFn: (sourceIds: string[]) =>
      requirementsBoardApi.linkRequirementTokenSources(requirement!.id, sourceIds),
    onSuccess: () => {
      message.success("已关联 Token 来源");
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
      setPickerOpen(false);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "关联失败")
  });
  const unlinkMutation = useMutation({
    mutationFn: (sourceId: string) =>
      requirementsBoardApi.unlinkRequirementTokenSource(requirement!.id, sourceId),
    onSuccess: () => {
      message.success("已移除 Token 来源");
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "移除失败")
  });

  return (
    <Drawer
      className="requirements-drawer"
      width={720}
      open={Boolean(requirement)}
      onClose={onClose}
      title={
        requirement ? (
          <div className="requirements-drawer__title-row">
            <div className="requirements-drawer__title">
              <small>需求详情</small>
              <strong>{requirement.title}</strong>
            </div>
            {onToggleFavorite ? (
              <button
                type="button"
                className={`requirements-drawer__favorite${isFavorite ? " is-active" : ""}`}
                aria-label={isFavorite ? "取消关注" : "关注需求"}
                onClick={onToggleFavorite}
              >
                {isFavorite ? (
                  <StarFilled style={{ color: "#f59e0b" }} />
                ) : (
                  <StarOutlined />
                )}
              </button>
            ) : null}
          </div>
        ) : null
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
              <Tag>尚未拆分任务</Tag>
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
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="缺验收标准" />
            )}
          </section>

          <section className="requirements-drawer__section">
            <div className="requirements-drawer__section-head">
              <h3>任务拆解</h3>
              <Space size={6} wrap>
                <Tag>{tasks.length} 个任务</Tag>
                <Tag color="success">{completedCount} 个完成</Tag>
                <Tag color={blockedCount ? "error" : "default"}>{blockedCount} 个依赖阻塞</Tag>
              </Space>
            </div>
            {!tasks.length ? (
              <div className="requirements-drawer__execution-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未拆分任务" />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => onCreatorOpenChange(true)}
                >
                  添加任务
                </Button>
              </div>
            ) : (
              <div className="requirements-drawer__task-list">
                {tasks.map((task) => {
                  const tTokens = sumTokensFromSources(task.token_source_ids, tokenSourceMap);
                  return (
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
                        {task.dependencies.length
                          ? `${task.dependencies.length} 个上游依赖`
                          : "无上游依赖"}
                        {tTokens > 0 ? ` · Token ${formatTokens(tTokens)}` : ""}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
            {tasks.length ? (
              <div className="requirements-drawer__execution-footer">
                <Button icon={<PlusOutlined />} onClick={() => onCreatorOpenChange(true)}>
                  继续添加任务
                </Button>
              </div>
            ) : null}
          </section>

          <TaskCreateModal
            open={creatorOpen}
            requirementId={requirement.id}
            requirementTitle={requirement.title}
            existingTasks={tasks}
            onCancel={() => onCreatorOpenChange(false)}
            onCreated={() => onCreatorOpenChange(false)}
          />

          <section className="requirements-drawer__section">
            <div className="requirements-drawer__section-head">
              <h3>Token 摘要</h3>
              <Space size={8}>
                {totalTokens > 0 ? (
                  <span>合计 {formatTokens(totalTokens)} Token</span>
                ) : (
                  <span>暂无关联 Token 来源</span>
                )}
                <Button size="small" icon={<LinkOutlined />} onClick={() => setPickerOpen(true)}>
                  关联 Token 来源
                </Button>
              </Space>
            </div>
            <TokenSourceList
              requirementSources={requirement.token_source_ids
                .map((id) => tokenSourceMap.get(id))
                .filter((source): source is MockTokenSource => Boolean(source))}
              taskSources={tasks
                .flatMap((task) =>
                  task.token_source_ids
                    .map((id) => tokenSourceMap.get(id))
                    .filter((source): source is MockTokenSource => Boolean(source))
                    .map((source) => ({ source, taskTitle: task.title }))
                )}
              onRemoveRequirementSource={(id) => unlinkMutation.mutate(id)}
              removing={unlinkMutation.isPending ? unlinkMutation.variables : undefined}
            />
          </section>

          <TokenSourcePicker
            open={pickerOpen}
            sources={tokenSources}
            excludeIds={requirement.token_source_ids}
            confirmLoading={linkMutation.isPending}
            onCancel={() => setPickerOpen(false)}
            onConfirm={async (ids) => {
              await linkMutation.mutateAsync(ids);
            }}
          />
        </Space>
      ) : null}
    </Drawer>
  );
}

function TaskCreateModal({
  open,
  requirementId,
  requirementTitle,
  existingTasks,
  onCancel,
  onCreated
}: {
  open: boolean;
  requirementId: string;
  requirementTitle: string;
  existingTasks: MockTask[];
  onCancel: () => void;
  onCreated: (task: MockTask) => void;
}) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<{
    title: string;
    assignee_id: string;
    priority: MockTaskPriority;
    due_date?: dayjs.Dayjs;
    dependency_task_ids?: string[];
  }>();

  const assigneesQuery = useQuery({
    queryKey: ["requirements-board", "assignees"],
    queryFn: () => requirementsBoardApi.listAssignees(),
    staleTime: 5 * 60_000
  });

  const dependencyOptions = existingTasks.map((task) => ({
    value: task.id,
    label: task.title
  }));

  const createMutation = useMutation({
    mutationFn: (values: {
      title: string;
      assignee_id: string;
      priority: MockTaskPriority;
      due_date?: dayjs.Dayjs;
      dependency_task_ids?: string[];
    }) =>
      requirementsBoardApi.createTask({
        requirement_id: requirementId,
        title: values.title.trim(),
        acceptance_criteria_ids: [],
        assignee_id: values.assignee_id,
        priority: values.priority,
        due_date: values.due_date?.format("YYYY-MM-DD"),
        dependency_task_ids: values.dependency_task_ids
      }),
    onSuccess: (task) => {
      message.success("任务已创建");
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
      onCreated(task);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "创建任务失败")
  });

  const handleCancel = () => {
    if (createMutation.isPending) return;
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={`为「${requirementTitle}」添加任务`}
      open={open}
      width={560}
      destroyOnHidden
      onCancel={handleCancel}
      onOk={() => form.submit()}
      okText="创建任务"
      cancelText="取消"
      confirmLoading={createMutation.isPending}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ priority: "medium" }}
        onFinish={(values) => createMutation.mutate(values)}
      >
        <Form.Item
          label="任务标题"
          name="title"
          rules={[{ required: true, whitespace: true, message: "请输入任务标题" }]}
        >
          <Input placeholder="任务标题" />
        </Form.Item>
        <Form.Item
          label="负责人"
          name="assignee_id"
          rules={[{ required: true, message: "请选择负责人" }]}
        >
          <Select
            placeholder="选择负责人"
            loading={assigneesQuery.isLoading}
            disabled={assigneesQuery.isLoading || assigneesQuery.isError}
            options={(assigneesQuery.data ?? []).map((item: MockAssignee) => ({
              value: item.id,
              label: `${item.name} (${item.employee_id})`
            }))}
          />
        </Form.Item>
        <Form.Item
          label="优先级"
          name="priority"
          rules={[{ required: true, message: "请选择优先级" }]}
        >
          <Select
            options={[
              { value: "low", label: "低" },
              { value: "medium", label: "中" },
              { value: "high", label: "高" }
            ]}
          />
        </Form.Item>
        <Form.Item label="截止日期" name="due_date">
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="上游依赖" name="dependency_task_ids">
          <Select
            mode="multiple"
            placeholder={dependencyOptions.length ? "选择上游依赖任务" : "当前需求暂无可选任务"}
            disabled={!dependencyOptions.length}
            options={dependencyOptions}
            allowClear
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function TokenSourceList({
  requirementSources,
  taskSources,
  onRemoveRequirementSource,
  removing
}: {
  requirementSources: MockTokenSource[];
  taskSources: Array<{ source: MockTokenSource; taskTitle: string }>;
  onRemoveRequirementSource?: (id: string) => void;
  removing?: string;
}) {
  if (!requirementSources.length && !taskSources.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联 Token 来源" />;
  }
  return (
    <Space direction="vertical" size={8} style={{ width: "100%" }}>
      {requirementSources.map((source) => (
        <div key={source.id} className="requirements-drawer__token-row">
          <div className="requirements-drawer__token-row-main">
            <strong>{source.summary || "（无摘要）"}</strong>
            <span>
              {formatTokenSourceTime(source.recorded_at)} · {source.tool} · {source.uploader}
            </span>
          </div>
          <div className="requirements-drawer__token-row-meta">
            <Tag color="geekblue">需求关联</Tag>
            <span>{formatTokens(source.token)} Token</span>
            {onRemoveRequirementSource ? (
              <Button
                size="small"
                type="text"
                icon={<CloseOutlined />}
                loading={removing === source.id}
                onClick={() => onRemoveRequirementSource(source.id)}
                aria-label="移除"
              />
            ) : null}
          </div>
        </div>
      ))}
      {taskSources.map(({ source, taskTitle }) => (
        <div key={`${taskTitle}-${source.id}`} className="requirements-drawer__token-row">
          <div className="requirements-drawer__token-row-main">
            <strong>{source.summary || "（无摘要）"}</strong>
            <span>
              {formatTokenSourceTime(source.recorded_at)} · {source.tool} · {source.uploader}
            </span>
          </div>
          <div className="requirements-drawer__token-row-meta">
            <Tag color="purple">来自任务：{taskTitle}</Tag>
            <span>{formatTokens(source.token)} Token</span>
          </div>
        </div>
      ))}
    </Space>
  );
}

function TaskDrawer({
  task,
  requirementTasks,
  tokenSources,
  tokenSourceMap,
  isFavorite,
  onToggleFavorite,
  onClose,
  onSaved
}: {
  task?: MockTask;
  requirementTasks: MockTask[];
  tokenSources: MockTokenSource[];
  tokenSourceMap: Map<string, MockTokenSource>;
  isFavorite: boolean;
  onToggleFavorite?: () => void;
  onClose: () => void;
  onSaved: (task: MockTask) => void;
}) {
  return (
    <Drawer
      className="requirements-drawer"
      width={640}
      open={Boolean(task)}
      onClose={onClose}
      title={
        task ? (
          <div className="requirements-drawer__title-row">
            <span>任务详情 · {task.title}</span>
            {onToggleFavorite ? (
              <button
                type="button"
                className={`requirements-drawer__favorite${isFavorite ? " is-active" : ""}`}
                aria-label={isFavorite ? "取消关注" : "关注任务"}
                onClick={onToggleFavorite}
              >
                {isFavorite ? (
                  <StarFilled style={{ color: "#f59e0b" }} />
                ) : (
                  <StarOutlined />
                )}
              </button>
            ) : null}
          </div>
        ) : (
          "任务详情"
        )
      }
    >
      {task ? (
        <TaskDrawerContent
          key={`${task.id}-${task.updated_at}`}
          task={task}
          requirementTasks={requirementTasks}
          tokenSources={tokenSources}
          tokenSourceMap={tokenSourceMap}
          onSaved={onSaved}
        />
      ) : null}
    </Drawer>
  );
}

function TaskDrawerContent({
  task,
  requirementTasks,
  tokenSources,
  tokenSourceMap,
  onSaved
}: {
  task: MockTask;
  requirementTasks: MockTask[];
  tokenSources: MockTokenSource[];
  tokenSourceMap: Map<string, MockTokenSource>;
  onSaved: (task: MockTask) => void;
}) {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(task.progress);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dependencyDraft, setDependencyDraft] = useState<string>();
  const dependencyBlocked = task.status === "blocked";
  const progressMutation = useMutation({
    mutationFn: () => requirementsBoardApi.updateTaskProgress(task.id, progress),
    onSuccess: (updated) => {
      message.success("任务进度已保存");
      onSaved(updated);
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "进度保存失败")
  });
  const statusMutation = useMutation({
    mutationFn: (next: Exclude<MockTaskStatus, "blocked">) =>
      requirementsBoardApi.updateTaskStatus(task.id, next),
    onSuccess: (updated) => {
      message.success("任务状态已更新");
      onSaved(updated);
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "状态更新失败")
  });
  const addDependencyMutation = useMutation({
    mutationFn: (dependsOnId: string) =>
      requirementsBoardApi.addTaskDependency(task.id, dependsOnId),
    onSuccess: (updated) => {
      message.success("上游依赖已更新");
      setDependencyDraft(undefined);
      onSaved(updated);
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "依赖更新失败")
  });
  const removeDependencyMutation = useMutation({
    mutationFn: (dependsOnId: string) =>
      requirementsBoardApi.removeTaskDependency(task.id, dependsOnId),
    onSuccess: (updated) => {
      message.success("上游依赖已移除");
      onSaved(updated);
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "依赖移除失败")
  });
  const requestStatusChange = (next: Exclude<MockTaskStatus, "blocked">) => {
    if (next === "done" || next === "todo") {
      modal.confirm({
        title: next === "done" ? "确认标记完成？" : "确认重新打开？",
        content: "状态变化会同步影响需求的聚合进度。",
        okText: next === "done" ? "标记完成" : "重新打开",
        cancelText: "取消",
        onOk: () => statusMutation.mutateAsync(next)
      });
      return;
    }
    statusMutation.mutate(next);
  };
  const linkMutation = useMutation({
    mutationFn: (sourceIds: string[]) =>
      requirementsBoardApi.linkTaskTokenSources(task.id, sourceIds),
    onSuccess: (updated) => {
      message.success("已关联 Token 来源");
      onSaved(updated);
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      setPickerOpen(false);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "关联失败")
  });
  const unlinkMutation = useMutation({
    mutationFn: (sourceId: string) =>
      requirementsBoardApi.unlinkTaskTokenSource(task.id, sourceId),
    onSuccess: (updated) => {
      message.success("已移除 Token 来源");
      onSaved(updated);
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "移除失败")
  });

  const linkedSources = task.token_source_ids
    .map((id) => tokenSourceMap.get(id))
    .filter((source): source is MockTokenSource => Boolean(source));
  const linkedTotal = linkedSources.reduce((total, source) => total + source.token, 0);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <section className="requirements-drawer__section">
        <div className="requirements-drawer__section-head">
          <h3>执行状态</h3>
          <TaskStatusTag status={task.status} />
        </div>
        {dependencyBlocked ? (
          <Alert
            type="warning"
            showIcon
            message="存在未完成上游依赖"
            style={{ marginBottom: 12 }}
          />
        ) : null}
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
            loading={progressMutation.isPending}
            disabled={progress === task.progress}
            onClick={() => progressMutation.mutate()}
          >
            保存进度
          </Button>
        </div>
        <Space wrap size={8} style={{ marginTop: 12 }}>
          {task.status !== "done" && !dependencyBlocked ? (
            <Button
              type="primary"
              size="small"
              loading={statusMutation.isPending}
              onClick={() => requestStatusChange("done")}
            >
              标记完成
            </Button>
          ) : null}
          {task.status === "done" ? (
            <Button
              size="small"
              loading={statusMutation.isPending}
              onClick={() => requestStatusChange("todo")}
            >
              重新打开
            </Button>
          ) : null}
          {task.status === "todo" && !dependencyBlocked ? (
            <Button
              size="small"
              loading={statusMutation.isPending}
              onClick={() => requestStatusChange("in_progress")}
            >
              开始任务
            </Button>
          ) : null}
        </Space>
      </section>

      <section className="requirements-drawer__section">
        <h3>任务信息</h3>
        <Descriptions column={1} size="small" colon={false}>
          <Descriptions.Item label="所属需求">{task.requirement_title}</Descriptions.Item>
          <Descriptions.Item label="负责人">{task.assignee_name || "未分配"}</Descriptions.Item>
          <Descriptions.Item label="截止日期">{formatDate(task.due_date)}</Descriptions.Item>
          <Descriptions.Item label="最近更新">{formatDateTime(task.updated_at)}</Descriptions.Item>
        </Descriptions>
      </section>

      <section className="requirements-drawer__section">
        <h3>上游依赖</h3>
        {task.dependencies.length ? (
          <Space wrap size={6}>
            {task.dependencies.map((dependency) => (
              <Tag
                key={dependency.task_id}
                color={dependency.status === "done" ? "success" : "error"}
                closable
                onClose={(event) => {
                  event.preventDefault();
                  removeDependencyMutation.mutate(dependency.task_id);
                }}
              >
                {dependency.task_title}
              </Tag>
            ))}
          </Space>
        ) : (
          <span style={{ color: "#7a879a", fontSize: 12 }}>无上游依赖</span>
        )}
        <Space.Compact style={{ width: "100%", marginTop: 12 }}>
          <Select
            allowClear
            showSearch
            value={dependencyDraft}
            placeholder="选择同一需求内的上游任务"
            optionFilterProp="label"
            options={requirementTasks
              .filter(
                (candidate) =>
                  candidate.id !== task.id &&
                  !task.dependencies.some((dependency) => dependency.task_id === candidate.id)
              )
              .map((candidate) => ({ value: candidate.id, label: candidate.title }))}
            onChange={setDependencyDraft}
          />
          <Button
            loading={addDependencyMutation.isPending}
            disabled={!dependencyDraft}
            onClick={() => dependencyDraft && addDependencyMutation.mutate(dependencyDraft)}
          >
            添加依赖
          </Button>
        </Space.Compact>
      </section>

      <section className="requirements-drawer__section">
        <div className="requirements-drawer__section-head">
          <h3>Token 来源</h3>
          <Space size={8}>
            {linkedTotal > 0 ? (
              <span>已关联 {formatTokens(linkedTotal)} Token</span>
            ) : (
              <span>暂无关联 Token 来源</span>
            )}
            <Button size="small" icon={<LinkOutlined />} onClick={() => setPickerOpen(true)}>
              关联 Token 来源
            </Button>
          </Space>
        </div>
        {linkedSources.length ? (
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            {linkedSources.map((source) => (
              <div key={source.id} className="requirements-drawer__token-row">
                <div className="requirements-drawer__token-row-main">
                  <strong>{source.summary || "（无摘要）"}</strong>
                  <span>
                    {formatTokenSourceTime(source.recorded_at)} · {source.tool} · {source.uploader}
                  </span>
                </div>
                <div className="requirements-drawer__token-row-meta">
                  <span>{formatTokens(source.token)} Token</span>
                  <Button
                    size="small"
                    type="text"
                    icon={<CloseOutlined />}
                    loading={unlinkMutation.isPending && unlinkMutation.variables === source.id}
                    onClick={() => unlinkMutation.mutate(source.id)}
                    aria-label="移除"
                  />
                </div>
              </div>
            ))}
          </Space>
        ) : (
          <p style={{ margin: 0, color: "#7a879a" }}>暂无关联 Token 来源</p>
        )}
      </section>

      <TokenSourcePicker
        open={pickerOpen}
        sources={tokenSources}
        excludeIds={task.token_source_ids}
        confirmLoading={linkMutation.isPending}
        onCancel={() => setPickerOpen(false)}
        onConfirm={async (ids) => {
          await linkMutation.mutateAsync(ids);
        }}
      />
    </Space>
  );
}
