import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Empty, Row, Space, Table, Typography } from "antd";
import { Link } from "react-router-dom";
import { useState } from "react";

import { fetchTasks, fetchTokens } from "../api/client";
import type { Task, TokenPeriod } from "../api/types";
import { ROLE_LABELS } from "@/shared/auth/types";
import { useAuth } from "@/shared/auth/authContext";

import { AlertBanner, TokenDistributionPie } from "./charts";
import { DeadlineCell, PeriodTabs, StatCard, TaskStatusTag } from "./shared";

const { Title, Text } = Typography;

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function EmployeeDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<TokenPeriod>("week");

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
    staleTime: 60_000
  });
  const { data: tokens } = useQuery({
    queryKey: ["tokens", period, "task"],
    queryFn: () => fetchTokens({ period, group_by: "task" }),
    staleTime: 30_000
  });

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTokens = tokens?.series?.find((p) => p.date === todayStr)?.value || 0;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          {user?.name} · {user?.team_name || ROLE_LABELS.employee}
        </Title>
        <Text type="secondary">
          分配 {tasks.length} 个任务 · 完成 {doneCount} · Token {period}: {formatTokens(tokens?.total || 0)}
        </Text>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <StatCard label="今日 Token" value={formatTokens(todayTokens)} tone="warning" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard label={`${period} Token`} value={formatTokens(tokens?.total || 0)} tone="warning" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="进行中任务"
            value={tasks.filter((t) => t.status === "in_progress").length}
            tone="info"
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard label="已完成" value={doneCount} tone="success" />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="我的任务" size="small">
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
                  title: "需求",
                  dataIndex: "requirement_title",
                  render: (v?: string) => v || "-",
                  width: 160
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
                  render: (v?: string) => <DeadlineCell deadline={v} />,
                  width: 120
                }
              ]}
              locale={{ emptyText: <Empty description="暂无任务" /> }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="我的 Token 分布 (按任务)"
            size="small"
            extra={<PeriodTabs value={period} onChange={(v) => setPeriod(v as TokenPeriod)} />}
          >
            <TokenDistributionPie groups={tokens?.groups || []} centerLabel={formatTokens(tokens?.total || 0)} />
          </Card>
        </Col>
      </Row>

      {blockedTasks.length > 0 && (
        <AlertBanner level="warning">
          <span>⚠️ 阻塞任务: </span>
          {blockedTasks.map((t, i) => (
            <span key={t.id}>
              {i > 0 && " · "}
              <Link to={`/tasks/${t.id}`}>{t.title}</Link>
            </span>
          ))}
        </AlertBanner>
      )}

      <Card size="small">
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space direction="vertical" size={2}>
            <Text strong>Session 上报</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              上报 Claude Code session，AI 自动关联任务。撤回 = 物理删除。
            </Text>
          </Space>
          <Link to="/sessions">
            <Button type="primary">前往 Session 管理 →</Button>
          </Link>
        </Space>
      </Card>
    </Space>
  );
}
