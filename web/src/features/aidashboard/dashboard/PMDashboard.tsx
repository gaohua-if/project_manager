import { useQuery } from "@tanstack/react-query";
import { Card, Col, Empty, Row, Space, Table, Typography } from "antd";
import { Link } from "react-router-dom";
import { useState } from "react";

import { fetchRequirements, fetchTokens } from "../api/client";
import type { Requirement, TokenPeriod } from "../api/types";
import { useAuth } from "@/shared/auth/authContext";

import { AlertBanner, TokenDistributionPie } from "./charts";
import { DeadlineCell, PeriodTabs, ProgressBar, StatCard } from "./shared";

const { Title, Text } = Typography;

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function PMDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<TokenPeriod>("week");

  const { data: requirements = [] } = useQuery<Requirement[]>({
    queryKey: ["requirements"],
    queryFn: () => fetchRequirements(),
    staleTime: 60_000
  });
  const { data: byReq } = useQuery({
    queryKey: ["tokens", period, "requirement"],
    queryFn: () => fetchTokens({ period, group_by: "requirement" }),
    staleTime: 30_000
  });
  const { data: byModel } = useQuery({
    queryKey: ["tokens", period, "model"],
    queryFn: () => fetchTokens({ period, group_by: "model" }),
    staleTime: 30_000
  });

  const myReqs = requirements.filter((r) => r.creator_id === user?.id);
  const others = requirements.filter((r) => r.creator_id !== user?.id);

  const tokenByReq = new Map<string, number>();
  (byReq?.groups || []).forEach((g) => tokenByReq.set(g.label, g.value));

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTokens = byReq?.series?.find((p) => p.date === todayStr)?.value || 0;

  const nowMs = new Date().getTime();
  const urgentReqs = requirements.filter((r) => {
    if (!r.deadline || r.status === "completed") return false;
    const days = Math.round((new Date(r.deadline).getTime() - nowMs) / (24 * 60 * 60 * 1000));
    return days <= 3;
  });

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>产品经理 · {user?.name}</Title>
        <Text type="secondary">
          全部 {requirements.length} 个需求 · 我创建 {myReqs.length} 个
        </Text>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}><StatCard label="Token 今日" value={formatTokens(todayTokens)} tone="warning" /></Col>
        <Col xs={12} md={6}><StatCard label={`Token ${period}`} value={formatTokens(byReq?.total || 0)} tone="warning" /></Col>
        <Col xs={12} md={6}><StatCard label="紧急 deadline" value={urgentReqs.length} tone="danger" /></Col>
        <Col xs={12} md={6}>
          <StatCard
            label="已交付需求"
            value={requirements.filter((r) => r.status === "completed").length}
            tone="success"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={`Token 按需求 (${period})`}
            size="small"
            extra={<PeriodTabs value={period} onChange={(v) => setPeriod(v as TokenPeriod)} />}
          >
            <TokenDistributionPie groups={byReq?.groups || []} centerLabel={formatTokens(byReq?.total || 0)} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={`Token 按模型 (${period})`} size="small">
            <TokenDistributionPie groups={byModel?.groups || []} centerLabel={formatTokens(byModel?.total || 0)} />
          </Card>
        </Col>
      </Row>

      <Card title="重点关注需求" size="small">
        <Table<Requirement>
          size="small"
          rowKey="id"
          dataSource={myReqs.concat(others).slice(0, 8)}
          pagination={false}
          columns={[
            {
              title: "需求",
              dataIndex: "title",
              render: (title: string, r) => (
                <Link to={`/requirements/${r.id}`}>
                  {r.creator_id === user?.id ? "⭐ " : ""}
                  {title}
                </Link>
              )
            },
            {
              title: "AC",
              dataIndex: "acceptance_criteria",
              render: (v: string[]) => `${v?.length || 0} 条`,
              width: 80
            },
            {
              title: "进度",
              dataIndex: "progress",
              render: (v: number) => <ProgressBar value={v} />,
              width: 160
            },
            {
              title: `${period} Token`,
              key: "token",
              render: (_: unknown, r) => formatTokens(tokenByReq.get(r.title) || 0),
              width: 110
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

      {urgentReqs.length > 0 && (
        <AlertBanner level="danger">
          <span>🔴 紧急 deadline: </span>
          {urgentReqs.map((r, i) => (
            <span key={r.id}>
              {i > 0 && " · "}
              <Link to={`/requirements/${r.id}`}>{r.title}</Link>{" "}
              ({r.deadline}, {r.progress}%)
            </span>
          ))}
        </AlertBanner>
      )}
    </Space>
  );
}
