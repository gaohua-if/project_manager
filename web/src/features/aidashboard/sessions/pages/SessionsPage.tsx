import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, DatePicker, Empty, Popconfirm, Select, Space, Table, Tag, Tooltip, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useState } from "react";
import dayjs from "dayjs";

import {
  downloadSessionLog,
  fetchSessions,
  fetchTasks,
  updateSessionTask,
  withdrawSession
} from "../../api/client";
import type { Session, Task } from "../../api/types";
import { useAuth } from "@/shared/auth/authContext";

const { Title, Text } = Typography;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })} ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDuration(secs?: number): string {
  if (!secs) return "-";
  return `${Math.floor(secs / 60)}分 ${secs % 60}秒`;
}

function ConfidenceTag({ value }: { value?: number }) {
  if (value == null) return <Text type="secondary">-</Text>;
  const color = value > 0.8 ? "success" : value > 0.5 ? "warning" : "error";
  return <Tag color={color}>{Math.round(value * 100)}%</Tag>;
}

export function SessionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [date, setDate] = useState<dayjs.Dayjs | null>(null);

  const dateStr = date?.format("YYYY-MM-DD") || "";

  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ["sessions", { date: dateStr }],
    queryFn: () => fetchSessions(dateStr ? { date: dateStr } : undefined),
    staleTime: 30_000
  });
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
    staleTime: 60_000
  });

  const overrideMutation = useMutation({
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
          <Title level={4} style={{ marginBottom: 4 }}>Session 管理</Title>
          <Text type="secondary">查看和上报的 Claude Code session</Text>
        </div>
        <Space>
          <DatePicker
            value={date}
            onChange={(v) => setDate(v)}
            allowClear
            placeholder="按日期筛选"
          />
          {user?.role !== "employee" ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              共 {sessions.length} 条（含团队成员）
            </Text>
          ) : null}
        </Space>
      </Space>

      <Card size="small">
        <Table<Session>
          rowKey="id"
          dataSource={sessions}
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          columns={[
            {
              title: "Session",
              key: "session",
              render: (_: unknown, s) => (
                <Space direction="vertical" size={0}>
                  <Text code style={{ fontSize: 11 }}>{s.session_ref.slice(0, 12)}</Text>
                  {s.summary ? (
                    <Tooltip title={s.summary}>
                      <Text type="secondary" style={{ fontSize: 11, maxWidth: 280, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        {s.summary}
                      </Text>
                    </Tooltip>
                  ) : null}
                </Space>
              )
            },
            {
              title: "开始时间",
              dataIndex: "started_at",
              render: (v: string) => formatDateTime(v),
              width: 130
            },
            {
              title: "上报时间",
              dataIndex: "uploaded_at",
              render: (v: string) => formatDateTime(v),
              width: 130
            },
            {
              title: "模型",
              dataIndex: "model",
              width: 130,
              render: (v: string) => <Tag>{v}</Tag>
            },
            {
              title: "时长",
              dataIndex: "duration_secs",
              render: (v?: number) => formatDuration(v),
              width: 90
            },
            {
              title: "匹配任务",
              key: "task",
              width: 220,
              render: (_: unknown, s) => (
                <Select
                  size="small"
                  style={{ width: "100%" }}
                  value={s.task_id || ""}
                  placeholder="未匹配"
                  onChange={(v) => overrideMutation.mutate({ sessionId: s.id, taskId: v || null })}
                  options={[
                    { value: "", label: "未匹配" },
                    ...tasks.map((t) => ({ value: t.id, label: t.title }))
                  ]}
                />
              )
            },
            {
              title: "置信度",
              dataIndex: "match_confidence",
              width: 90,
              render: (v?: number) => <ConfidenceTag value={v} />
            },
            {
              title: "操作",
              key: "actions",
              width: 140,
              render: (_: unknown, s) => (
                <Space>
                  {s.raw_log_url ? (
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(s.id)}
                    >
                      日志
                    </Button>
                  ) : null}
                  <Popconfirm
                    title="撤回此 session？"
                    description="此操作将永久删除，包括 Token 统计。"
                    okText="确认撤回"
                    okButtonProps={{ danger: true }}
                    cancelText="取消"
                    onConfirm={() => withdrawMutation.mutate(s.id)}
                  >
                    <Button size="small" danger loading={withdrawMutation.isPending}>撤回</Button>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
          locale={{ emptyText: <Empty description={dateStr ? `${dateStr} 当日无上报 session` : "暂无 session，使用 CLI 上传：aida upload"} /> }}
        />
      </Card>
    </Space>
  );
}
