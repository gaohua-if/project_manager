import { useQuery } from "@tanstack/react-query";
import { Card, Col, Empty, Row, Select, Space, Table, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import { useState } from "react";

import { fetchRequirements, fetchTasks, fetchTokens, fetchTeamActivity } from "../api/client";
import type { Requirement, Task, TokenGroupBy, TokenPeriod } from "../api/types";
import { useAuth } from "@/shared/auth/authContext";

import {
  AlertBanner,
  TeamActivityBars,
  TokenDistributionPie,
  TokenTrendChart
} from "./charts";
import { DeadlineCell, PeriodTabs, ProgressBar, StatCard } from "./shared";

const { Title, Text } = Typography;

export function DirectorDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<TokenPeriod>("week");
  const [groupBy, setGroupBy] = useState<TokenGroupBy>("model");

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
  const { data: tokens } = useQuery({
    queryKey: ["tokens", period, groupBy],
    queryFn: () => fetchTokens({ period, group_by: groupBy }),
    staleTime: 30_000
  });
  const { data: teamActivity } = useQuery({
    queryKey: ["team-activity"],
    queryFn: () => fetchTeamActivity(),
    staleTime: 60_000
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTokens = tokens?.series?.find((p) => p.date === todayStr)?.value || 0;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks * 100) / tasks.length) : 0;
  const crossTeamBlocked = requirements.filter((r) => r.team_ids.length > 1 && r.progress < 100).length;

  const nowMs = new Date().getTime();
  const urgentReqs = requirements.filter((r) => {
    if (!r.deadline || r.status === "completed") return false;
    const days = Math.round((new Date(r.deadline).getTime() - nowMs) / (24 * 60 * 60 * 1000));
    return days <= 3;
  });

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>部门总监 · {user?.name}</Title>
        <Text type="secondary">
          全局视图 · {requirements.length} 个需求 · {tasks.length} 个任务
        </Text>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <StatCard label="今日部门 Token" value={formatTokens(todayTokens)} tone="info" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard label="任务完成率" value={`${completionRate}%`} tone="success" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard label="跨团队进行中" value={crossTeamBlocked} tone="danger" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="Token 消耗"
            value={formatTokens(tokens?.total || 0)}
            sub={`今日 ${formatTokens(todayTokens)}`}
            tone="warning"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="团队活跃度" size="small" extra={<Text type="secondary" style={{ fontSize: 11 }}>活跃 = 当日 ≥1 个已上报 Session</Text>}>
            <TeamActivityBars teams={teamActivity?.teams || []} />
            {teamActivity && teamActivity.idle_warnings.length > 0 && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 12 }}>
                沉寂预警:{" "}
                {teamActivity.idle_warnings.slice(0, 5).map((w, i) => (
                  <span key={w.user_id}>
                    {i > 0 && " · "}
                    {w.user_name}({w.team_name})
                    {w.idle_days === 999 ? " 从未" : ` ${w.idle_days}天`}
                  </span>
                ))}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Token 趋势"
            size="small"
            extra={<PeriodTabs value={period} onChange={(v) => setPeriod(v as TokenPeriod)} />}
          >
            <TokenTrendChart series={tokens?.series || []} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={`Token 分布 (${period})`}
            size="small"
            extra={
              <Select
                size="small"
                value={groupBy}
                onChange={(v) => setGroupBy(v as TokenGroupBy)}
                style={{ width: 110 }}
                options={[
                  { value: "model", label: "按模型" },
                  { value: "team", label: "按团队" },
                  { value: "requirement", label: "按需求" },
                  { value: "task", label: "按任务" },
                  { value: "user", label: "按成员" }
                ]}
              />
            }
          >
            <TokenDistributionPie groups={tokens?.groups || []} centerLabel={formatTokens(tokens?.total || 0)} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="需求总览" size="small">
            <Table<Requirement>
              size="small"
              rowKey="id"
              dataSource={requirements.slice(0, 6)}
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
                  render: (v: string) => <DeadlineCell deadline={v} />,
                  width: 120
                }
              ]}
              locale={{ emptyText: <Empty description="暂无需求" /> }}
            />
          </Card>
        </Col>
      </Row>

      {urgentReqs.length > 0 && (
        <AlertBanner level="danger">
          <span>🔴 紧急 deadline: </span>
          {urgentReqs.map((r, i) => (
            <span key={r.id}>
              {i > 0 && " · "}
              <Link to={`/requirements/${r.id}`}>{r.title}</Link>
              {" "}
              <Tag color="red" style={{ marginLeft: 4 }}>{r.deadline} · {r.progress}%</Tag>
            </span>
          ))}
        </AlertBanner>
      )}
    </Space>
  );
}

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}
