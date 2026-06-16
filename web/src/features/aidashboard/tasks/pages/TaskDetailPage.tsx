import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Col, Descriptions, Row, Space, Tag, Typography } from "antd";
import { Link, useParams } from "react-router-dom";

import { fetchTask, updateTaskStatus } from "../../api/client";
import type { Task, TaskDep, TaskStatus } from "../../api/types";

import { TaskPriorityTag, TaskStatusTag } from "../../dashboard/shared";

const { Title, Text } = Typography;

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

export function TaskDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const { data: task } = useQuery<Task>({
    queryKey: ["task", id],
    queryFn: () => fetchTask(id),
    enabled: Boolean(id)
  });

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => updateTaskStatus(id, status),
    onSuccess: () => {
      message.success("状态已更新");
      void queryClient.invalidateQueries({ queryKey: ["task", id] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "更新失败")
  });

  if (!task) {
    return <Text type="secondary">加载中...</Text>;
  }

  const acTags = task.acceptance_criteria_ids?.length
    ? task.acceptance_criteria_ids.map((i) => <Tag key={i}>AC{i + 1}</Tag>)
    : [<Text key="none" type="secondary">-</Text>];

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Link to="/tasks">
          <Text type="secondary">← 任务</Text>
        </Link>
        <Title level={4} style={{ marginTop: 8, marginBottom: 4 }}>{task.title}</Title>
        <Text type="secondary">
          所属需求:{" "}
          <Link to={`/requirements/${task.requirement_id}`}>
            {task.requirement_title || task.requirement_id}
          </Link>{" "}
          · 负责人: {task.assignee_name || "未分配"}
        </Text>
      </div>

      <Space>
        {task.status !== "done" ? (
          <Button
            type="primary"
            loading={statusMutation.isPending}
            onClick={() => statusMutation.mutate("done")}
          >
            标记完成
          </Button>
        ) : null}
        {task.status === "done" ? (
          <Button
            loading={statusMutation.isPending}
            onClick={() => statusMutation.mutate("todo")}
          >
            重新打开
          </Button>
        ) : null}
        {task.status !== "in_progress" ? (
          <Button
            loading={statusMutation.isPending}
            onClick={() => statusMutation.mutate("in_progress")}
          >
            标记进行中
          </Button>
        ) : null}
        {task.status !== "blocked" ? (
          <Button
            danger
            loading={statusMutation.isPending}
            onClick={() => statusMutation.mutate("blocked")}
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
              <Descriptions.Item label="截止日期">
                {task.due_date || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="关联 AC">
                <Space size={4} wrap>{acTags}</Space>
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
                  <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
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
  );
}
