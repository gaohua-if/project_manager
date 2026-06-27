import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  InputNumber,
  Result,
  Row,
  Slider,
  Space,
  Tag,
  Typography
} from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { isEditConflict } from "@/shared/request/apiError";
import { buildListReturnUrl } from "@/shared/utils/urlQuery";

import "../../aidashboard-pattern.css";
import { TaskPriorityTag, TaskStatusTag } from "../../dashboard/shared";
import { requirementsBoardApi } from "../../requirements/api/requirementsBoardApi";
import type { MockTaskDependency, MockTaskStatus, MockTokenSource } from "../../requirements/types";

const { Text } = Typography;

function DependencyList({ deps, empty }: { deps: MockTaskDependency[]; empty: string }) {
  if (!deps.length) return <Text type="secondary">{empty}</Text>;
  return (
    <Space orientation="vertical" size={6} style={{ width: "100%" }}>
      {deps.map((dependency) => (
        <Space key={dependency.task_id} size={8}>
          <TaskStatusTag status={dependency.status} />
          <Link to={`/tasks/${dependency.task_id}`}>{dependency.task_title}</Link>
        </Space>
      ))}
    </Space>
  );
}

function formatTokens(value: number) {
  if (!value) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

function formatTokenSourceTime(value: string) {
  return dayjs(value).format("MM-DD HH:mm");
}

export function TaskDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [progressOverride, setProgressOverride] = useState<number | null>(null);
  const backTo = buildListReturnUrl("/requirements", location.search);

  const taskQuery = useQuery({
    queryKey: ["requirements-board", "task", id],
    queryFn: () => requirementsBoardApi.getTask(id),
    enabled: Boolean(id)
  });
  const task = taskQuery.data;

  const tokenSourcesQuery = useQuery({
    queryKey: ["requirements-board", "token-sources"],
    queryFn: () => requirementsBoardApi.listTokenSources(),
    staleTime: 60_000
  });
  const tokenSourceMap = useMemo(
    () =>
      new Map(
        (tokenSourcesQuery.data ?? []).map((source: MockTokenSource) => [source.id, source])
      ),
    [tokenSourcesQuery.data]
  );

  const statusMutation = useMutation({
    mutationFn: (status: Exclude<MockTaskStatus, "blocked">) =>
      requirementsBoardApi.updateTaskStatus(id, status, task?.version ?? 0),
    onSuccess: () => {
      message.success("任务状态已更新");
      void queryClient.invalidateQueries({ queryKey: ["requirements-board", "task", id] });
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
    },
    onError: (error) => {
      if (isEditConflict(error)) {
        message.warning("内容已被其他人更新，请刷新后再操作");
        void queryClient.invalidateQueries({ queryKey: ["requirements-board", "task", id] });
        void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
        return;
      }
      message.error(error instanceof Error ? error.message : "状态更新失败");
    }
  });

  const progressMutation = useMutation({
    mutationFn: (nextProgress: number) =>
      requirementsBoardApi.updateTaskProgress(id, nextProgress, task?.version ?? 0),
    onSuccess: () => {
      setProgressOverride(null);
      message.success("任务进度已保存");
      void queryClient.invalidateQueries({ queryKey: ["requirements-board", "task", id] });
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
    },
    onError: (error) => {
      if (isEditConflict(error)) {
        message.warning("内容已被其他人更新，请刷新后再操作");
        void queryClient.invalidateQueries({ queryKey: ["requirements-board", "task", id] });
        void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "follows"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard", "risks"] });
        return;
      }
      message.error(error instanceof Error ? error.message : "进度保存失败");
    }
  });

  const requestStatusChange = (status: Exclude<MockTaskStatus, "blocked">) => {
    if (status === "done" || status === "todo") {
      modal.confirm({
        title: status === "done" ? "确认标记完成？" : "确认重新打开？",
        content: "状态变化会同步影响需求的聚合进度。",
        okText: status === "done" ? "标记完成" : "重新打开",
        cancelText: "取消",
        onOk: () => statusMutation.mutateAsync(status)
      });
      return;
    }
    statusMutation.mutate(status);
  };

  if (!id) {
    return (
      <Result
        status="404"
        title="任务不存在"
        subTitle="缺少有效的任务 ID。"
        extra={<Link to={backTo}>返回需求看板</Link>}
      />
    );
  }
  if (taskQuery.isLoading) return <Card loading />;
  if (taskQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="任务加载失败"
        description={taskQuery.error instanceof Error ? taskQuery.error.message : "请稍后重试"}
        action={<Button onClick={() => void taskQuery.refetch()}>重试</Button>}
      />
    );
  }
  if (!task) {
    return (
      <Result
        status="404"
        title="任务不存在"
        subTitle="未找到该任务或当前用户无权查看。"
        extra={<Link to={backTo}>返回需求看板</Link>}
      />
    );
  }

  const dependencyBlocked = task.status === "blocked";
  const progress = progressOverride ?? task.progress;
  const canUpdateStatus = Boolean(task.can_update_status);
  const canUpdateProgress = Boolean(task.can_update_progress);

  const linkedSources = task.token_source_ids
    .map((id) => tokenSourceMap.get(id))
    .filter((source): source is MockTokenSource => Boolean(source));
  const linkedTotal = linkedSources.reduce((total, source) => total + source.token, 0);

  return (
    <PagePanel
      title={task.title}
      description={`所属需求：${task.requirement_title} · 负责人：${task.assignee_name || "未分配"}`}
      backTo={backTo}
      breadcrumbs={[
        { title: "业务" },
        { title: "需求看板", path: "/requirements" },
        { title: task.title }
      ]}
    >
      <div className="aidashboard-task-detail">
        <section className="aidashboard-task-detail__actions">
          {canUpdateStatus ? (
            <Space wrap>
              {task.status !== "done" && !dependencyBlocked ? (
                <Button
                  type="primary"
                  loading={statusMutation.isPending}
                  onClick={() => requestStatusChange("done")}
                >
                  标记完成
                </Button>
              ) : null}
              {task.status === "done" ? (
                <Button
                  loading={statusMutation.isPending}
                  onClick={() => requestStatusChange("todo")}
                >
                  重新打开
                </Button>
              ) : null}
              {task.status === "todo" && !dependencyBlocked ? (
                <Button
                  loading={statusMutation.isPending}
                  onClick={() => requestStatusChange("in_progress")}
                >
                  开始任务
                </Button>
              ) : null}
            </Space>
          ) : null}
          {dependencyBlocked ? <Tag color="error">依赖未完成，当前任务处于阻塞展示状态</Tag> : null}
        </section>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card size="small" title="任务信息">
              <Descriptions column={1} size="small" labelStyle={{ width: 110 }}>
                <Descriptions.Item label="状态">
                  <TaskStatusTag status={task.status} />
                </Descriptions.Item>
                <Descriptions.Item label="优先级">
                  <TaskPriorityTag priority={task.priority} />
                </Descriptions.Item>
                <Descriptions.Item label="截止日期">{task.due_date || "-"}</Descriptions.Item>
                <Descriptions.Item label="任务验收标准">
                  {task.acceptance_criteria.length ? (
                    <Space orientation="vertical" size={4}>
                      {task.acceptance_criteria.map((criterion, index) => (
                        <Space key={`${index}-${criterion}`} align="start">
                          <Tag>标准 {index + 1}</Tag>
                          <Text>{criterion}</Text>
                        </Space>
                      ))}
                    </Space>
                  ) : (
                    <Text type="secondary">暂无任务验收标准</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Token 来源">
                  {linkedTotal > 0
                    ? `已关联 ${formatTokens(linkedTotal)} Token`
                    : "暂无关联 Token 来源"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title="依赖阻塞">
              <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                <div>
                  <Text type="secondary" className="aidashboard-task-detail__label">
                    依赖于
                  </Text>
                  <DependencyList deps={task.dependencies} empty="无上游依赖" />
                </div>
                {task.blocking.length ? (
                  <div>
                    <Text type="secondary" className="aidashboard-task-detail__label">
                      阻塞了
                    </Text>
                    <DependencyList deps={task.blocking} empty="" />
                  </div>
                ) : null}
              </Space>
            </Card>
          </Col>
        </Row>

        <Card size="small" title="Token 来源">
          {linkedSources.length ? (
            <Space orientation="vertical" size={8} style={{ width: "100%" }}>
              {linkedSources.map((source) => (
                <div key={source.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: "#f8fafc", border: "1px solid #e5eaf3", borderRadius: 10 }}>
                  <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                    <strong style={{ color: "#253047", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {source.summary || "（无摘要）"}
                    </strong>
                    <span style={{ color: "#8a95a6", fontSize: 11 }}>
                      {formatTokenSourceTime(source.recorded_at)} · {source.tool} · {source.uploader}
                    </span>
                  </div>
                  <span style={{ color: "#526173", fontSize: 12 }}>{formatTokens(source.token)} Token</span>
                </div>
              ))}
            </Space>
          ) : (
            <Text type="secondary">暂无关联 Token 来源。</Text>
          )}
        </Card>

        <Card title="任务进度" className="aidashboard-task-detail__progress-card">
          <p>{canUpdateProgress ? "拖动滑块或输入百分比后保存。" : "当前任务为只读。"} </p>
          <div className="aidashboard-task-detail__progress-editor">
            <Slider
              min={0}
              max={100}
              value={progress}
              disabled={!canUpdateProgress}
              onChange={setProgressOverride}
            />
            <Space.Compact>
              <InputNumber
                min={0}
                max={100}
                value={progress}
                disabled={!canUpdateProgress}
                onChange={(value) => setProgressOverride(value ?? 0)}
              />
              <Button disabled>%</Button>
            </Space.Compact>
            <Button
              type="primary"
              loading={progressMutation.isPending}
              disabled={!canUpdateProgress || progress === task.progress}
              onClick={() => progressMutation.mutate(progress)}
            >
              保存进度
            </Button>
          </div>
        </Card>
      </div>
    </PagePanel>
  );
}
