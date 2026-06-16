import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from "antd";
import { RobotOutlined } from "@ant-design/icons";
import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import dayjs from "dayjs";

import {
  createTask,
  fetchACStatus,
  fetchRequirement,
  fetchTasks,
  fetchUsers,
  regenerateAC
} from "../../api/client";
import type { ACStatus, Requirement, Task, TaskPriority } from "../../api/types";
import { ROLE_LABELS, type User, type UserRole } from "@/shared/auth/types";
import { useAuth } from "@/shared/auth/authContext";

import {
  ProgressBar,
  RequirementPriorityTag,
  RequirementStatusTag,
  TaskStatusTag
} from "../../dashboard/shared";

const { Title, Text, Paragraph } = Typography;

interface TaskFormValues {
  title: string;
  acceptance_criteria_ids: number[];
  assignee_id?: string;
  priority: TaskPriority;
  due_date?: dayjs.Dayjs;
}

export function RequirementDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<TaskFormValues>();

  const { data: req } = useQuery<Requirement>({
    queryKey: ["requirement", id],
    queryFn: () => fetchRequirement(id),
    enabled: Boolean(id),
    staleTime: 30_000
  });
  const { data: acStatuses = [] } = useQuery<ACStatus[]>({
    queryKey: ["requirement", id, "ac"],
    queryFn: () => fetchACStatus(id),
    enabled: Boolean(id),
    staleTime: 30_000
  });
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks", { requirement_id: id }],
    queryFn: () => fetchTasks({ requirement_id: id }),
    enabled: Boolean(id),
    staleTime: 30_000
  });
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
    staleTime: 5 * 60_000
  });

  const canRegenerate =
    user && (user.role === "director" || user.role === "pm" || user.role === "team_leader" || user.role === "admin");

  const regenMutation = useMutation({
    mutationFn: () => regenerateAC(id),
    onSuccess: () => {
      message.success("AC 已重新生成");
      void queryClient.invalidateQueries({ queryKey: ["requirement", id] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "重新生成失败")
  });

  const teamEmployees = users.filter(
    (u) => u.role === "employee" && u.team_id === user?.team_id
  );

  const createTaskMutation = useMutation({
    mutationFn: (values: TaskFormValues) =>
      createTask({
        requirement_id: id,
        title: values.title.trim(),
        acceptance_criteria_ids: values.acceptance_criteria_ids ?? [],
        assignee_id: values.assignee_id,
        priority: values.priority,
        due_date: values.due_date ? values.due_date.format("YYYY-MM-DD") : undefined
      }),
    onSuccess: () => {
      message.success("任务已创建");
      setCreateOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["tasks", { requirement_id: id }] });
      void queryClient.invalidateQueries({ queryKey: ["requirement", id] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "创建失败")
  });

  if (!req) {
    return <Text type="secondary">加载中...</Text>;
  }

  const completedACs = acStatuses.filter((a) => a.completed).length;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Link to="/requirements">
          <Text type="secondary">← 需求</Text>
        </Link>
        <Title level={4} style={{ marginTop: 8, marginBottom: 4 }}>{req.title}</Title>
        <Text type="secondary">
          创建者 {req.creator_name} ({ROLE_LABELS[req.creator_role as UserRole] ?? req.creator_role}) ·{" "}
          {req.team_names.join(", ")} · <RequirementStatusTag status={req.status} />
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={18}>
          <Card size="small" title="描述">
            <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 12 }}>{req.description}</Paragraph>
            <Space size={16}>
              <Text type="secondary">优先级: <RequirementPriorityTag priority={req.priority} /></Text>
              <Text type="secondary">截止日期: {req.deadline || "未设定"}</Text>
              {req.feishu_doc_url ? (
                <a href={req.feishu_doc_url} target="_blank" rel="noreferrer">飞书文档 ↗</a>
              ) : null}
            </Space>
          </Card>

          <Card
            size="small"
            title={`验收标准 (${completedACs}/${acStatuses.length})`}
            style={{ marginTop: 16 }}
            extra={
              canRegenerate ? (
                <Popconfirm
                  title="重新生成验收标准？"
                  description="这会覆盖当前的 AC，可能影响已关联的任务。"
                  okText="确认生成"
                  cancelText="取消"
                  onConfirm={() => regenMutation.mutate()}
                >
                  <Button icon={<RobotOutlined />} loading={regenMutation.isPending}>
                    重新生成 AC
                  </Button>
                </Popconfirm>
              ) : null
            }
          >
            {acStatuses.length === 0 ? (
              <Empty description="暂无验收标准" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {acStatuses.map((ac) => {
                  const linked = ac.linked_tasks ?? [];
                  return (
                    <Space key={ac.index} align="start">
                      <Tag color={ac.completed ? "success" : "default"} style={{ marginTop: 2 }}>
                        {ac.completed ? "✓" : "○"}
                      </Tag>
                      <Space direction="vertical" size={0}>
                        <Text delete={ac.completed}>{ac.text}</Text>
                        {linked.length > 0 ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            任务: {linked.join(", ")}
                          </Text>
                        ) : null}
                      </Space>
                    </Space>
                  );
                })}
              </Space>
            )}
          </Card>

          <Card
            size="small"
            title={`任务 (${tasks.length})`}
            style={{ marginTop: 16 }}
            extra={
              <Button type="primary" onClick={() => setCreateOpen(true)}>
                + 添加任务
              </Button>
            }
          >
            <Table<Task>
              size="small"
              rowKey="id"
              dataSource={tasks}
              pagination={false}
              columns={[
                {
                  title: "任务",
                  dataIndex: "title",
                  render: (title: string, t) => <Link to={`/tasks/${t.id}`}>{title}</Link>
                },
                {
                  title: "负责人",
                  dataIndex: "assignee_name",
                  render: (v?: string) => v || "-",
                  width: 120
                },
                {
                  title: "AC",
                  dataIndex: "acceptance_criteria_ids",
                  render: (ids: number[]) => ids?.map((i) => `AC${i + 1}`).join(", ") || "-",
                  width: 120
                },
                {
                  title: "状态",
                  dataIndex: "status",
                  render: (s: Task["status"]) => <TaskStatusTag status={s} />,
                  width: 100
                },
                {
                  title: "截止",
                  dataIndex: "due_date",
                  render: (v?: string) => v || "-",
                  width: 120
                }
              ]}
              locale={{ emptyText: <Empty description="暂无任务。TL 可将需求拆解为任务。" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card size="small">
            <div style={{ textAlign: "center" }}>
              <Title level={3} style={{ color: "#52c41a", marginBottom: 0 }}>
                {req.progress}%
              </Title>
              <Text type="secondary">进度</Text>
            </div>
            <ProgressBar value={req.progress} showLabel={false} />
          </Card>
        </Col>
      </Row>

      <Modal
        title="添加任务"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        okText="创建任务"
        cancelText="取消"
        confirmLoading={createTaskMutation.isPending}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ priority: "medium", acceptance_criteria_ids: [] }}
          onFinish={(values) => createTaskMutation.mutate(values)}
        >
          <Form.Item label="任务标题" name="title" rules={[{ required: true, message: "请输入任务标题" }]}>
            <Input placeholder="例如:实现 API 分页" />
          </Form.Item>
          <Form.Item label="负责人" name="assignee_id" rules={[{ required: true, message: "请选择负责人" }]}>
            <Select
              placeholder="选择工程师"
              options={teamEmployees.map((u) => ({ value: u.id, label: `${u.name} (${u.employee_id})` }))}
            />
          </Form.Item>
          {req.acceptance_criteria.length > 0 ? (
            <Form.Item label="关联 AC" name="acceptance_criteria_ids">
              <Checkbox.Group>
                <Space direction="vertical">
                  {req.acceptance_criteria.map((ac, i) => (
                    <Checkbox key={i} value={i}>
                      <Text type="secondary" style={{ fontSize: 12 }}>AC{i + 1}</Text>{" "}
                      <Text style={{ fontSize: 12 }}>{ac}</Text>
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </Form.Item>
          ) : null}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="优先级" name="priority">
                <Select
                  options={[
                    { value: "low", label: "低" },
                    { value: "medium", label: "中" },
                    { value: "high", label: "高" }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="截止日期" name="due_date">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </Space>
  );
}
