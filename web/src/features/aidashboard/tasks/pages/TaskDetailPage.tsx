import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Result,
  Row,
  Space,
  Tag,
  Typography
} from "antd";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { fetchTask, updateTaskStatus } from "../../api/client";
import type { Task, TaskDep, TaskStatus } from "../../api/types";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { HttpError } from "@/shared/request/types";
import { buildListReturnUrl } from "@/shared/utils/urlQuery";

import { TaskPriorityTag, TaskStatusTag } from "../../dashboard/shared";

const { Text } = Typography;

function DependencyList({ deps, empty }: { deps: TaskDep[] | undefined; empty: string }) {
  if (!deps || deps.length === 0) {
    return <Text type="secondary">{empty}</Text>;
  }
  return (
    <Space direction="vertical" size={6} style={{ width: "100%" }}>
      {deps.map((d) => (
        <Space key={d.task_id} size={8}>
          <TaskStatusTag status={d.status} />
          <Link to={`/tasks/${d.task_id}`}>{d.task_title}</Link>
        </Space>
      ))}
    </Space>
  );
}

const STATUS_CONFIRM_META: Partial<
  Record<TaskStatus, { title: string; content: string; okText: string }>
> = {
  done: {
    title: "确认标记完成？",
    content: "任务完成会影响关联需求的进度统计。",
    okText: "标记完成"
  },
  todo: {
    title: "确认重新打开？",
    content: "重新打开任务会重新计算关联需求进度。",
    okText: "重新打开"
  },
  blocked: {
    title: "确认标记阻塞？",
    content: "阻塞状态会影响团队预警和日报判断。",
    okText: "标记阻塞"
  }
};

export function TaskDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const backTo = buildListReturnUrl("/tasks", location.search);

  const taskQuery = useQuery<Task>({
    queryKey: ["task", id],
    queryFn: () => fetchTask(id),
    enabled: Boolean(id)
  });
  const task = taskQuery.data;

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => updateTaskStatus(id, status),
    onSuccess: () => {
      message.success("状态已更新");
      void queryClient.invalidateQueries({ queryKey: ["task", id] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "更新失败")
  });

  const changeStatus = async (status: TaskStatus) => {
    setPendingStatus(status);
    try {
      await statusMutation.mutateAsync(status);
    } finally {
      setPendingStatus(null);
    }
  };

  const requestStatusChange = (status: TaskStatus) => {
    const confirm = STATUS_CONFIRM_META[status];
    if (!confirm) {
      void changeStatus(status);
      return;
    }
    modal.confirm({
      title: confirm.title,
      content: confirm.content,
      okText: confirm.okText,
      cancelText: "取消",
      okButtonProps: status === "blocked" ? { danger: true } : undefined,
      onOk: () => changeStatus(status)
    });
  };

  if (!id) {
    return (
      <Result
        status="404"
        title="任务不存在"
        subTitle="缺少有效的任务 ID。"
        extra={<Link to={backTo}>返回任务列表</Link>}
      />
    );
  }

  if (taskQuery.isLoading) {
    return <Card loading />;
  }

  if (taskQuery.isError) {
    const error = taskQuery.error;
    if (error instanceof HttpError && error.status === 404) {
      return (
        <Result
          status="404"
          title="任务不存在"
          subTitle="该任务可能已被删除，或你没有访问权限。"
          extra={<Link to={backTo}>返回任务列表</Link>}
        />
      );
    }
    return (
      <Alert
        type="error"
        showIcon
        message="任务加载失败"
        description={error instanceof Error ? error.message : "请稍后重试"}
        action={<Button onClick={() => void taskQuery.refetch()}>重试</Button>}
      />
    );
  }

  if (!task?.id) {
    return (
      <Result
        status="404"
        title="任务不存在"
        subTitle="服务返回了空的任务数据。"
        extra={<Link to={backTo}>返回任务列表</Link>}
      />
    );
  }

  const mutationPending = statusMutation.isPending;
  const acTags = task.acceptance_criteria_ids?.length
    ? task.acceptance_criteria_ids.map((i) => <Tag key={i}>AC{i + 1}</Tag>)
    : [
        <Text key="none" type="secondary">
          -
        </Text>
      ];

  return (
    <PagePanel
      title={task.title}
      description={`所属需求: ${task.requirement_title || task.requirement_id} · 负责人: ${task.assignee_name || "未分配"}`}
      backTo={backTo}
      breadcrumbs={[{ title: "任务", path: "/tasks" }, { title: task.title }]}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Space wrap>
        {task.status !== "done" ? (
          <Button
            type="primary"
            disabled={mutationPending}
            loading={pendingStatus === "done"}
            onClick={() => requestStatusChange("done")}
          >
            标记完成
          </Button>
        ) : null}
        {task.status === "done" ? (
          <Button
            disabled={mutationPending}
            loading={pendingStatus === "todo"}
            onClick={() => requestStatusChange("todo")}
          >
            重新打开
          </Button>
        ) : null}
        {task.status !== "in_progress" ? (
          <Button
            disabled={mutationPending}
            loading={pendingStatus === "in_progress"}
            onClick={() => requestStatusChange("in_progress")}
          >
            标记进行中
          </Button>
        ) : null}
        {task.status !== "blocked" ? (
          <Button
            danger
            disabled={mutationPending}
            loading={pendingStatus === "blocked"}
            onClick={() => requestStatusChange("blocked")}
          >
            标记阻塞
          </Button>
        ) : null}
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="详情">
            <Descriptions column={1} size="small" labelStyle={{ width: 100 }}>
              <Descriptions.Item label="状态">
                <TaskStatusTag status={task.status} />
              </Descriptions.Item>
              <Descriptions.Item label="优先级">
                <TaskPriorityTag priority={task.priority} />
              </Descriptions.Item>
              <Descriptions.Item label="截止日期">{task.due_date || "-"}</Descriptions.Item>
              <Descriptions.Item label="关联 AC">
                <Space size={4} wrap>
                  {acTags}
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="依赖关系">
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
                  依赖于:
                </Text>
                <DependencyList deps={task.dependencies} empty="无依赖" />
              </div>
              {task.blocking && task.blocking.length > 0 ? (
                <div>
                  <Text
                    type="secondary"
                    style={{ fontSize: 12, display: "block", marginBottom: 6 }}
                  >
                    阻塞了:
                  </Text>
                  <DependencyList deps={task.blocking} empty="" />
                </div>
              ) : null}
            </Space>
          </Card>
        </Col>
      </Row>
      </Space>
    </PagePanel>
  );
}
