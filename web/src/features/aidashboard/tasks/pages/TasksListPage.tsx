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
  Row,
  Select,
  Space,
  Table,
  Typography
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useState } from "react";
import dayjs from "dayjs";

import {
  createTask,
  fetchRequirements,
  fetchTasks,
  fetchUsers
} from "../../api/client";
import type { Requirement, Task, TaskPriority, TaskStatus } from "../../api/types";
import type { User } from "@/shared/auth/types";
import { useAuth } from "@/shared/auth/authContext";

import { TaskPriorityTag, TaskStatusTag } from "../../dashboard/shared";

const { Title, Text } = Typography;

interface CreateTaskFormValues {
  title: string;
  requirement_id: string;
  assignee_id: string;
  priority: TaskPriority;
  due_date?: dayjs.Dayjs;
  acceptance_criteria_ids: number[];
}

const STATUS_FILTER_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: "todo", label: "待办" },
  { value: "in_progress", label: "进行中" },
  { value: "done", label: "已完成" },
  { value: "blocked", label: "已阻塞" }
];

export function TasksListPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<CreateTaskFormValues>();

  const canCreate = Boolean(
    user && (user.role === "team_leader" || user.role === "director" || user.role === "admin")
  );

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks", { status: statusFilter }],
    queryFn: () => fetchTasks(statusFilter ? { status: statusFilter } : undefined),
    staleTime: 30_000
  });
  const { data: requirements = [] } = useQuery<Requirement[]>({
    queryKey: ["requirements"],
    queryFn: () => fetchRequirements(),
    enabled: canCreate,
    staleTime: 60_000
  });
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
    enabled: canCreate,
    staleTime: 5 * 60_000
  });

  const teamEmployees = users.filter(
    (u) => u.role === "employee" && u.team_id === user?.team_id
  );

  const createMutation = useMutation({
    mutationFn: (values: CreateTaskFormValues) =>
      createTask({
        requirement_id: values.requirement_id,
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
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "创建任务失败")
  });

  const selectedRequirementId = Form.useWatch("requirement_id", form);
  const selectedRequirement = requirements.find((r) => r.id === selectedRequirementId);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>任务</Title>
          <Text type="secondary">查看和管理任务</Text>
        </div>
        <Space>
          {canCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              创建任务
            </Button>
          ) : null}
          <Select
            style={{ width: 140 }}
            value={statusFilter || undefined}
            placeholder="全部状态"
            allowClear
            onChange={(v) => setStatusFilter((v ?? "") as TaskStatus | "")}
            options={STATUS_FILTER_OPTIONS}
          />
        </Space>
      </Space>

      <Card size="small">
        <Table<Task>
          rowKey="id"
          dataSource={tasks}
          loading={isLoading}
          pagination={false}
          columns={[
            {
              title: "任务",
              dataIndex: "title",
              render: (title: string, t) => <Link to={`/tasks/${t.id}`}>{title}</Link>
            },
            {
              title: "所属需求",
              dataIndex: "requirement_title",
              render: (v?: string) => v || "-",
              width: 200
            },
            {
              title: "负责人",
              dataIndex: "assignee_name",
              render: (v?: string) => v || "-",
              width: 120
            },
            {
              title: "状态",
              dataIndex: "status",
              render: (s: Task["status"]) => <TaskStatusTag status={s} />,
              width: 100
            },
            {
              title: "优先级",
              dataIndex: "priority",
              render: (p: TaskPriority) => <TaskPriorityTag priority={p} />,
              width: 90
            },
            {
              title: "截止",
              dataIndex: "due_date",
              render: (v?: string) => v || "-",
              width: 120
            }
          ]}
          locale={{ emptyText: <Empty description="暂无任务" /> }}
        />
      </Card>

      <Modal
        title="创建任务"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        okText="创建并分配"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        width={720}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ priority: "medium", acceptance_criteria_ids: [] }}
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item label="任务标题" name="title" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="例如:实现 API 分页" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="所属需求" name="requirement_id" rules={[{ required: true, message: "请选择需求" }]}>
                <Select
                  placeholder="选择需求"
                  showSearch
                  optionFilterProp="label"
                  options={requirements.map((r) => ({ value: r.id, label: r.title }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="负责人" name="assignee_id" rules={[{ required: true, message: "请选择负责人" }]}>
                <Select
                  placeholder="选择工程师"
                  options={teamEmployees.map((u) => ({ value: u.id, label: `${u.name} (${u.employee_id})` }))}
                />
              </Form.Item>
            </Col>
          </Row>
          {selectedRequirement && selectedRequirement.acceptance_criteria.length > 0 ? (
            <Form.Item label="关联 AC" name="acceptance_criteria_ids">
              <Checkbox.Group style={{ width: "100%" }}>
                <Space direction="vertical" wrap>
                  {selectedRequirement.acceptance_criteria.map((ac, i) => (
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
