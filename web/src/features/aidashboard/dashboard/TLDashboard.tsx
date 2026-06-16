import { useQuery } from "@tanstack/react-query";
import { Card, Col, Empty, Row, Space, Table, Typography } from "antd";
import { Link } from "react-router-dom";
import { useState } from "react";

import { fetchRequirements, fetchTasks, fetchTokens, fetchTeamActivity } from "../api/client";
import type { Requirement, Task, TokenPeriod } from "../api/types";
import { useAuth } from "@/shared/auth/authContext";

import { AlertBanner, TokenDistributionPie } from "./charts";
import {
  DeadlineCell,
  PeriodTabs,
  ProgressBar,
  StatCard,
  TaskStatusTag
} from "./shared";

const { Title, Text } = Typography;

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function TLDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<TokenPeriod>("week");

  const { data: requirements = [] } = useQuery<Requirement[]>({
    queryKey: ["requirements"],
    queryFn: () => fetchRequirements(),
    staleTime: 60_000
  });
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
    staleTime: 60_000
  });
  const { data: activity } = useQuery({
    queryKey: ["team-activity"],
    queryFn: () => fetchTeamActivity(),
    staleTime: 60_000
  });
  const { data: tokens } = useQuery({
    queryKey: ["tokens", period, "user"],
    queryFn: () => fetchTokens({ period, group_by: "user" }),
    staleTime: 30_000
  });

  const myTeamMembers = activity?.teams?.find((t) => t.team_id === user?.team_id);
  const activeCount = myTeamMembers?.active || 0;
  const totalCount = myTeamMembers?.total || 0;
  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          {user?.team_name || "团队"} · TL {user?.name}
        </Title>
        <Text type="secondary">
          参与 {requirements.length} 个需求 · 拆解 {tasks.length} 个任务 · 活跃度 {activeCount}/{totalCount}
        </Text>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <StatCard label="今日活跃" value={`${activeCount}/${totalCount}`} tone="info" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard label="参与需求" value={requirements.length} tone="purple" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard label="阻碍预警" value={blockedTasks.length} tone="danger" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="本队 Token"
            value={formatTokens(tokens?.total || 0)}
            sub={`按 ${period}`}
            tone="warning"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={`成员 Token 排名 (${period})`} size="small">
            <Table
              size="small"
              rowKey="label"
              dataSource={tokens?.groups || []}
              pagination={false}
              columns={[
                { title: "成员", dataIndex: "label" },
                {
                  title: "占比",
                  dataIndex: "percent",
                  render: (v: number) => `${v.toFixed(0)}%`,
                  width: 80
                },
                {
                  title: "Token",
                  dataIndex: "value",
                  align: "right" as const,
                  render: (v: number) => formatTokens(v),
                  width: 110
                }
              ]}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Token 分布 (按成员)"
            size="small"
            extra={<PeriodTabs value={period} onChange={(v) => setPeriod(v as TokenPeriod)} />}
          >
            <TokenDistributionPie groups={tokens?.groups || []} centerLabel={formatTokens(tokens?.total || 0)} />
          </Card>
        </Col>
      </Row>

      <Card title="本队任务" size="small">
        <Table<Task>
          size="small"
          rowKey="id"
          dataSource={tasks.slice(0, 10)}
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
              title: "状态",
              dataIndex: "status",
              render: (s: Task["status"]) => <TaskStatusTag status={s} />,
              width: 100
            },
            {
              title: "进度",
              key: "progress",
              render: (_: unknown, t: Task) =>
                t.status === "done" ? "100%" : t.status === "in_progress" ? "进行中" : "-",
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

      <Card title="本队需求" size="small">
        <Table<Requirement>
          size="small"
          rowKey="id"
          dataSource={requirements}
          pagination={false}
          columns={[
            {
              title: "需求",
              dataIndex: "title",
              render: (title: string, r) => <Link to={`/requirements/${r.id}`}>{title}</Link>
            },
            {
              title: "团队",
              dataIndex: "team_names",
              render: (v: string[]) => v.join("+"),
              width: 120
            },
            {
              title: "进度",
              dataIndex: "progress",
              render: (v: number) => <ProgressBar value={v} />,
              width: 160
            },
            {
              title: "Deadline",
              dataIndex: "deadline",
              render: (v?: string) => <DeadlineCell deadline={v} />,
              width: 120
            }
          ]}
          locale={{ emptyText: <Empty description="暂无需求" /> }}
        />
      </Card>

      {blockedTasks.length > 0 && (
        <AlertBanner level="warning">
          <span>⚠️ 阻塞任务: </span>
          {blockedTasks.map((t, i) => (
            <span key={t.id}>
              {i > 0 && " · "}
              <Link to={`/tasks/${t.id}`}>{t.title}</Link>
              {t.assignee_name ? ` (${t.assignee_name})` : ""}
            </span>
          ))}
        </AlertBanner>
      )}
    </Space>
  );
}
