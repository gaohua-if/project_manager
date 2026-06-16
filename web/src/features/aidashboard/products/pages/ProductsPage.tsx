import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from "antd";
import { FileTextOutlined, PlusOutlined, RobotOutlined } from "@ant-design/icons";
import { useState } from "react";
import dayjs from "dayjs";

import {
  createDocument,
  deleteDocument,
  downloadSessionLog,
  fetchDocuments,
  fetchSessions,
  fetchTasks,
  updateSessionTask,
  withdrawSession
} from "../../api/client";
import type { Document, Session, Task } from "../../api/types";
import { useAuth } from "@/shared/auth/authContext";

const { Title, Text } = Typography;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })} ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDuration(secs?: number): string {
  if (!secs) return "时长未知";
  return `${Math.floor(secs / 60)}分${secs % 60}秒`;
}

interface DocFormValues {
  title: string;
  url: string;
  description?: string;
  task_id?: string;
}

export function ProductsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [date, setDate] = useState<dayjs.Dayjs | null>(null);
  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [docOpen, setDocOpen] = useState(false);
  const [docForm] = Form.useForm<DocFormValues>();

  const isManager = Boolean(
    user && (user.role === "team_leader" || user.role === "pm" || user.role === "director" || user.role === "admin")
  );

  const dateStr = date?.format("YYYY-MM-DD") || "";

  const { data: sessions = [] } = useQuery<Session[]>({
    queryKey: ["sessions", { date: dateStr }],
    queryFn: () => fetchSessions(dateStr ? { date: dateStr } : undefined),
    staleTime: 30_000
  });
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["documents", { date: dateStr }],
    queryFn: () => fetchDocuments(dateStr ? { date: dateStr } : undefined),
    staleTime: 30_000
  });
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
    staleTime: 60_000
  });

  const visibleDocuments = isManager
    ? documents.filter((d) => (tab === "mine" ? d.user_id === user?.id : d.user_id !== user?.id))
    : documents;
  const visibleSessions = isManager
    ? sessions.filter((s) => (tab === "mine" ? s.user_id === user?.id : s.user_id !== user?.id))
    : sessions;

  const sortedDocuments = [...visibleDocuments].sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );
  const sortedSessions = [...visibleSessions].sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );

  const addDocMutation = useMutation({
    mutationFn: (values: DocFormValues) =>
      createDocument({
        title: values.title.trim(),
        url: values.url.trim(),
        description: values.description || undefined,
        task_id: values.task_id || undefined
      }),
    onSuccess: () => {
      message.success("文档已添加");
      setDocOpen(false);
      docForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "添加失败")
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      message.success("已删除");
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "删除失败")
  });

  const overrideTaskMutation = useMutation({
    mutationFn: ({ sessionId, taskId }: { sessionId: string; taskId: string | null }) =>
      updateSessionTask(sessionId, taskId),
    onSuccess: () => {
      message.success("任务关联已更新");
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "更新失败")
  });

  const withdrawMutation = useMutation({
    mutationFn: (sessionId: string) => withdrawSession(sessionId),
    onSuccess: () => {
      message.success("Session 已撤回");
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "撤回失败")
  });

  const handleDownload = async (sessionId: string) => {
    try {
      await downloadSessionLog(sessionId);
    } catch {
      message.error("原始日志不可用");
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>我的工作</Title>
          <Text type="secondary">文档和 Claude Code session 分别独立追踪</Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => setDocOpen(true)}>添加文档</Button>
          <DatePicker
            value={date}
            onChange={(v) => setDate(v)}
            allowClear
            placeholder="按日期筛选"
          />
        </Space>
      </Space>

      {isManager ? (
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as "mine" | "team")}
          options={[
            { label: "我的工作", value: "mine" },
            { label: "团队工作", value: "team" }
          ]}
        />
      ) : null}

      <Card
        title={
          <Space>
            <FileTextOutlined />
            <span>文档</span>
            <Tag color="blue">{sortedDocuments.length}</Tag>
          </Space>
        }
        size="small"
      >
        {sortedDocuments.length === 0 ? (
          <Empty description={dateStr ? `${dateStr} 无上传文档` : "暂无文档"} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table<Document>
            rowKey="id"
            dataSource={sortedDocuments.slice(0, 8)}
            pagination={false}
            size="small"
            columns={[
              {
                title: "标题",
                dataIndex: "title",
                render: (title: string, d) => (
                  <Space direction="vertical" size={0}>
                    <a href={d.url} target="_blank" rel="noreferrer">{title}</a>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {formatDateTime(d.uploaded_at)}{d.description ? ` · ${d.description}` : ""}
                    </Text>
                  </Space>
                )
              },
              {
                title: "任务",
                dataIndex: "task_title",
                width: 180,
                render: (v?: string) => v || <Text type="secondary">-</Text>
              },
              {
                title: "操作",
                key: "actions",
                width: 80,
                render: (_: unknown, d) => (
                  <Popconfirm
                    title="删除此文档？"
                    okText="删除"
                    okButtonProps={{ danger: true }}
                    cancelText="取消"
                    onConfirm={() => deleteDocMutation.mutate(d.id)}
                  >
                    <Button size="small" type="link" danger>删除</Button>
                  </Popconfirm>
                )
              }
            ]}
          />
        )}
        {sortedDocuments.length > 8 ? (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>还有 {sortedDocuments.length - 8} 条文档...</Text>
          </div>
        ) : null}
      </Card>

      <Card
        title={
          <Space>
            <RobotOutlined />
            <span>Claude Code Session</span>
            <Tag color="purple">{sortedSessions.length}</Tag>
          </Space>
        }
        size="small"
      >
        {sortedSessions.length === 0 ? (
          <Empty description={dateStr ? `${dateStr} 无上传 session` : "暂无 session，使用 CLI daemon 上传"} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table<Session>
            rowKey="id"
            dataSource={sortedSessions.slice(0, 8)}
            pagination={false}
            size="small"
            columns={[
              {
                title: "Session",
                key: "session",
                render: (_: unknown, s) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{s.summary || s.session_ref.slice(0, 12)}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {s.model || "Claude Code"} · {formatDuration(s.duration_secs)}
                      {user?.role !== "employee" ? ` · ${s.user_name}` : ""}
                    </Text>
                  </Space>
                )
              },
              {
                title: "上报时间",
                dataIndex: "uploaded_at",
                width: 130,
                render: (v: string) => formatDateTime(v)
              },
              {
                title: "任务",
                key: "task",
                width: 200,
                render: (_: unknown, s) => (
                  <Select
                    size="small"
                    style={{ width: "100%" }}
                    value={s.task_id || ""}
                    placeholder="无关联任务"
                    onChange={(v) => overrideTaskMutation.mutate({ sessionId: s.id, taskId: v || null })}
                    options={[
                      { value: "", label: "无关联任务" },
                      ...tasks.map((t) => ({ value: t.id, label: t.title }))
                    ]}
                  />
                )
              },
              {
                title: "操作",
                key: "actions",
                width: 140,
                render: (_: unknown, s) => (
                  <Space>
                    {s.raw_log_url ? (
                      <Button size="small" onClick={() => handleDownload(s.id)}>日志</Button>
                    ) : null}
                    <Popconfirm
                      title="撤回此 session？"
                      okText="撤回"
                      okButtonProps={{ danger: true }}
                      cancelText="取消"
                      onConfirm={() => withdrawMutation.mutate(s.id)}
                    >
                      <Button size="small" danger>撤回</Button>
                    </Popconfirm>
                  </Space>
                )
              }
            ]}
          />
        )}
        {sortedSessions.length > 8 ? (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>还有 {sortedSessions.length - 8} 条 session...</Text>
          </div>
        ) : null}
      </Card>

      <Modal
        title="添加文档"
        open={docOpen}
        onCancel={() => setDocOpen(false)}
        onOk={() => docForm.submit()}
        okText="添加"
        cancelText="取消"
        confirmLoading={addDocMutation.isPending}
        destroyOnHidden
      >
        <Form
          form={docForm}
          layout="vertical"
          onFinish={(values) => addDocMutation.mutate(values)}
        >
          <Form.Item label="标题" name="title" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="文档标题" />
          </Form.Item>
          <Form.Item label="URL" name="url" rules={[{ required: true, message: "请输入 URL" }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item label="描述（可选）" name="description">
            <Input placeholder="文档说明" />
          </Form.Item>
          <Form.Item label="关联任务（可选）" name="task_id">
            <Select
              allowClear
              placeholder="无关联任务"
              options={tasks.map((t) => ({ value: t.id, label: t.title }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
