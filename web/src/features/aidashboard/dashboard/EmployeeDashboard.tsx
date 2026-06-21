import { useQuery } from "@tanstack/react-query";
import { Button, Card, Col, Empty, Row, Space, Typography } from "antd";
import {
  CheckCircleOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  WalletOutlined
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useState } from "react";

import { fetchTasks, fetchTokens } from "../api/client";
import type { Task, TokenPeriod } from "../api/types";
import { ROLE_LABELS } from "@/shared/auth/types";
import { useAuth } from "@/shared/auth/authContext";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";

import { AlertBanner, TokenDistributionPie } from "./charts";
import { DashboardErrorAlert } from "./DashboardState";
import { DeadlineCell, PeriodTabs, StatCard, TaskStatusTag } from "./shared";

const { Text } = Typography;

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function EmployeeDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<TokenPeriod>("week");

  const tasksQuery = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
    staleTime: 60_000
  });
  const tokensQuery = useQuery({
    queryKey: ["tokens", period, "task"],
    queryFn: () => fetchTokens({ period, group_by: "task" }),
    staleTime: 30_000
  });

  const tasks = tasksQuery.data ?? [];
  const tokens = tokensQuery.data;

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTokens = tokens?.series?.find((p) => p.date === todayStr)?.value || 0;

  return (
    <PagePanel
      title={`${user?.name ?? ""} · ${user?.team_name || ROLE_LABELS.employee}`}
      description={`分配 ${tasks.length} 个任务 · 完成 ${doneCount} · Token ${period}: ${formatTokens(tokens?.total || 0)}`}
      breadcrumbs={[{ title: "Dashboard" }]}
    >
      <DashboardErrorAlert
        items={[
          { label: "任务", query: tasksQuery },
          { label: "Token", query: tokensQuery }
        ]}
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <StatCard
            label="今日 Token"
            value={formatTokens(todayTokens)}
            tone="warning"
            icon={<ThunderboltOutlined />}
            loading={tokensQuery.isLoading}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label={`${period} Token`}
            value={formatTokens(tokens?.total || 0)}
            tone="warning"
            icon={<WalletOutlined />}
            loading={tokensQuery.isLoading}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="进行中任务"
            value={tasks.filter((t) => t.status === "in_progress").length}
            tone="info"
            icon={<PlayCircleOutlined />}
            loading={tasksQuery.isLoading}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="已完成"
            value={doneCount}
            tone="success"
            icon={<CheckCircleOutlined />}
            loading={tasksQuery.isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="我的任务" size="small">
            <ResourceTable<Task>
              size="small"
              rowKey="id"
              dataSource={tasks}
              loading={tasksQuery.isLoading}
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
            loading={tokensQuery.isLoading}
            extra={<PeriodTabs value={period} onChange={(v) => setPeriod(v as TokenPeriod)} />}
          >
            <TokenDistributionPie
              groups={tokens?.groups || []}
              centerLabel={formatTokens(tokens?.total || 0)}
            />
          </Card>
        </Col>
      </Row>

      {blockedTasks.length > 0 && (
        <AlertBanner level="warning">
          <span>阻塞任务: </span>
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
            <Text strong>我的工作记录</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              文档和 AI 工作记录会沉淀到我的工作中，并自动关联任务。
            </Text>
          </Space>
          <Link to="/products">
            <Button type="primary">查看我的工作 →</Button>
          </Link>
        </Space>
      </Card>
    </PagePanel>
  );
}
