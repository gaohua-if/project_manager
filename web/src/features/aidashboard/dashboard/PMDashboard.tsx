import { useQuery } from "@tanstack/react-query";
import { Card, Col, Empty, Row } from "antd";
import {
  AlertOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  WalletOutlined
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useState } from "react";

import { fetchRequirements, fetchTokens } from "../api/client";
import type { Requirement, TokenPeriod } from "../api/types";
import { useAuth } from "@/shared/auth/authContext";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";

import { AlertBanner, TokenDistributionPie } from "./charts";
import { DashboardErrorAlert } from "./DashboardState";
import { DeadlineCell, PeriodTabs, ProgressBar, StatCard } from "./shared";

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function PMDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<TokenPeriod>("week");

  const requirementsQuery = useQuery<Requirement[]>({
    queryKey: ["requirements"],
    queryFn: () => fetchRequirements(),
    staleTime: 60_000
  });
  const byReqQuery = useQuery({
    queryKey: ["tokens", period, "requirement"],
    queryFn: () => fetchTokens({ period, group_by: "requirement" }),
    staleTime: 30_000
  });
  const byModelQuery = useQuery({
    queryKey: ["tokens", period, "model"],
    queryFn: () => fetchTokens({ period, group_by: "model" }),
    staleTime: 30_000
  });

  const requirements = requirementsQuery.data ?? [];
  const byReq = byReqQuery.data;
  const byModel = byModelQuery.data;

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
    <PagePanel
      title={`产品经理 · ${user?.name ?? ""}`}
      description={`全部 ${requirements.length} 个需求 · 我创建 ${myReqs.length} 个`}
      breadcrumbs={[{ title: "Dashboard" }]}
    >
      <DashboardErrorAlert
        items={[
          { label: "需求", query: requirementsQuery },
          { label: "需求 Token", query: byReqQuery },
          { label: "模型 Token", query: byModelQuery }
        ]}
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <StatCard
            label="Token 今日"
            value={formatTokens(todayTokens)}
            tone="warning"
            icon={<ThunderboltOutlined />}
            loading={byReqQuery.isLoading}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label={`Token ${period}`}
            value={formatTokens(byReq?.total || 0)}
            tone="warning"
            icon={<WalletOutlined />}
            loading={byReqQuery.isLoading}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="紧急 deadline"
            value={urgentReqs.length}
            tone="danger"
            icon={<AlertOutlined />}
            loading={requirementsQuery.isLoading}
          />
        </Col>
        <Col xs={12} md={6}>
          <StatCard
            label="已交付需求"
            value={requirements.filter((r) => r.status === "completed").length}
            tone="success"
            icon={<CheckCircleOutlined />}
            loading={requirementsQuery.isLoading}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={`Token 按需求 (${period})`}
            size="small"
            loading={byReqQuery.isLoading}
            extra={<PeriodTabs value={period} onChange={(v) => setPeriod(v as TokenPeriod)} />}
          >
            <TokenDistributionPie
              groups={byReq?.groups || []}
              centerLabel={formatTokens(byReq?.total || 0)}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={`Token 按模型 (${period})`} size="small" loading={byModelQuery.isLoading}>
            <TokenDistributionPie
              groups={byModel?.groups || []}
              centerLabel={formatTokens(byModel?.total || 0)}
            />
          </Card>
        </Col>
      </Row>

      <Card title="重点关注需求" size="small">
        <ResourceTable<Requirement>
          size="small"
          rowKey="id"
          dataSource={myReqs.concat(others).slice(0, 8)}
          loading={requirementsQuery.isLoading}
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
          <span>紧急 deadline: </span>
          {urgentReqs.map((r, i) => (
            <span key={r.id}>
              {i > 0 && " · "}
              <Link to={`/requirements/${r.id}`}>{r.title}</Link> ({r.deadline}, {r.progress}%)
            </span>
          ))}
        </AlertBanner>
      )}
    </PagePanel>
  );
}
