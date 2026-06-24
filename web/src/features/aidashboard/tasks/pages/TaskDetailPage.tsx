import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  InputNumber,
  Result,
  Row,
  Slider,
  Space,
  Tag,
  Typography
} from "antd";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { buildListReturnUrl } from "@/shared/utils/urlQuery";

import "../../aidashboard-pattern.css";
import { TaskPriorityTag, TaskStatusTag } from "../../dashboard/shared";
import { requirementsBoardMockApi } from "../../requirements/mock/requirementsBoardMockApi";
import type { MockTaskDependency, MockTaskStatus } from "../../requirements/mock/types";

const { Text } = Typography;

function DependencyList({ deps, empty }: { deps: MockTaskDependency[]; empty: string }) {
  if (!deps.length) return <Text type="secondary">{empty}</Text>;
  return (
    <Space direction="vertical" size={6} style={{ width: "100%" }}>
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

export function TaskDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [progressOverride, setProgressOverride] = useState<number | null>(null);
  const backTo = buildListReturnUrl("/requirements", location.search);

  const taskQuery = useQuery({
    queryKey: ["requirements-board", "task", id],
    queryFn: () => requirementsBoardMockApi.getTask(id),
    enabled: Boolean(id)
  });
  const task = taskQuery.data;

  const statusMutation = useMutation({
    mutationFn: (status: Exclude<MockTaskStatus, "blocked">) =>
      requirementsBoardMockApi.updateTaskStatus(id, status),
    onSuccess: () => {
      message.success("任务状态已更新（Mock）");
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "状态更新失败")
  });

  const progressMutation = useMutation({
    mutationFn: (nextProgress: number) =>
      requirementsBoardMockApi.updateTaskProgress(id, nextProgress),
    onSuccess: () => {
      setProgressOverride(null);
      message.success("任务进度已保存（Mock）");
      void queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "进度保存失败")
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
        subTitle="Mock 数据中没有该任务。"
        extra={<Link to={backTo}>返回需求看板</Link>}
      />
    );
  }

  const dependencyBlocked = task.dependencies.some((dependency) => dependency.status !== "done");
  const progress = progressOverride ?? task.progress;

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
                <Descriptions.Item label="关联验收标准">
                  <Space size={4} wrap>
                    {task.acceptance_criteria_ids.length ? (
                      task.acceptance_criteria_ids.map((index) => (
                        <Tag key={index}>标准 {index + 1}</Tag>
                      ))
                    ) : (
                      <Text type="secondary">-</Text>
                    )}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Token 来源">
                  {task.token_total > 0 ? `已关联 ${formatTokens(task.token_total)} Token` : "人工更新"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title="依赖阻塞">
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
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
            <Text type="secondary">当前任务未关联 Token 来源，仍可人工更新进度。</Text>
          )}
        </Card>

        <Card title="任务进度" className="aidashboard-task-detail__progress-card">
          <p>任务进度只在此处维护。拖动滑块或输入精确百分比后保存。</p>
          <div className="aidashboard-task-detail__progress-editor">
            <Slider min={0} max={100} value={progress} onChange={setProgressOverride} />
            <InputNumber
              min={0}
              max={100}
              value={progress}
              addonAfter="%"
              onChange={(value) => setProgressOverride(value ?? 0)}
            />
            <Button
              type="primary"
              loading={progressMutation.isPending}
              disabled={progress === task.progress}
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
