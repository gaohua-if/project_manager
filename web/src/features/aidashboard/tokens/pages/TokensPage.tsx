import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography
} from "antd";
import { useMemo, useState } from "react";
import dayjs from "dayjs";

import { fetchSessionTokens } from "../../api/client";
import type { SessionTokens } from "../../api/types";
import { useAuth } from "@/shared/auth/authContext";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

const { Text } = Typography;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请稍后重试";
}

export function TokensPage() {
  const { user } = useAuth();
  const today = dayjs();
  const firstOfMonth = today.startOf("month");
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([firstOfMonth, today]);
  const canViewTeam = Boolean(user && user.role !== "employee");
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const effectiveScope = canViewTeam ? scope : "mine";

  const from = range[0].format("YYYY-MM-DD");
  const to = range[1].format("YYYY-MM-DD");

  const tokensQuery = useQuery<SessionTokens[]>({
    queryKey: ["session-tokens", from, to, effectiveScope],
    queryFn: () => fetchSessionTokens({ from, to, scope: effectiveScope }),
    staleTime: 60_000
  });
  const sessions = useMemo(() => tokensQuery.data ?? [], [tokensQuery.data]);

  const totals = useMemo(() => {
    return sessions.reduce(
      (acc, s) => {
        acc.input += s.input_tokens;
        acc.output += s.output_tokens;
        acc.cacheCreate += s.cache_creation_tokens || 0;
        acc.cacheRead += s.cache_read_tokens || 0;
        acc.total += s.total_tokens;
        return acc;
      },
      { input: 0, output: 0, cacheCreate: 0, cacheRead: 0, total: 0 }
    );
  }, [sessions]);

  const cacheHitRate =
    totals.input + totals.cacheCreate + totals.cacheRead > 0
      ? (totals.cacheRead * 100) / (totals.input + totals.cacheCreate + totals.cacheRead)
      : 0;

  return (
    <PagePanel
      title="Token 明细"
      description={`${effectiveScope === "mine" ? "我的 Token 明细" : "团队 Token 明细"} · 按 AI 工作记录查看 Input / Output / Cache / Total`}
      breadcrumbs={[{ title: "Token 明细" }]}
      actions={
        <Space>
          {canViewTeam ? (
            <Segmented
              value={scope}
              onChange={(v) => setScope(v as "mine" | "team")}
              options={[
                { label: "我的", value: "mine" },
                {
                  label: user?.role === "director" || user?.role === "admin" ? "全团队" : "团队",
                  value: "team"
                }
              ]}
            />
          ) : null}
          <DatePicker.RangePicker
            value={range}
            onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
          />
        </Space>
      }
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {tokensQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="Token 明细加载失败"
            description={errorMessage(tokensQuery.error)}
            action={<Button onClick={() => void tokensQuery.refetch()}>重试</Button>}
          />
        ) : null}

        <Row gutter={[12, 12]}>
          <Col xs={12} md={6} lg={4}>
            <Card size="small">
              <Statistic title="Total" value={formatTokens(totals.total)} />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {sessions.length} 条记录
              </Text>
            </Card>
          </Col>
          <Col xs={12} md={6} lg={5}>
            <Card size="small">
              <Statistic title="Input" value={formatTokens(totals.input)} />
            </Card>
          </Col>
          <Col xs={12} md={6} lg={5}>
            <Card size="small">
              <Statistic title="Output" value={formatTokens(totals.output)} />
            </Card>
          </Col>
          <Col xs={12} md={6} lg={5}>
            <Card size="small">
              <Statistic title="Cache Create" value={formatTokens(totals.cacheCreate)} />
            </Card>
          </Col>
          <Col xs={12} md={6} lg={5}>
            <Card size="small">
              <Statistic
                title="Cache Read"
                value={formatTokens(totals.cacheRead)}
                valueStyle={{ color: "#52c41a" }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                hit {cacheHitRate.toFixed(1)}%
              </Text>
            </Card>
          </Col>
        </Row>

        <Card size="small">
          <Table<SessionTokens>
            rowKey="session_id"
            dataSource={sessions}
            loading={tokensQuery.isLoading}
            pagination={false}
            scroll={{ x: "max-content" }}
            columns={[
              {
                title: "记录",
                dataIndex: "session_ref",
                render: (v: string) => (
                  <Text code style={{ fontSize: 11 }}>
                    {v.slice(0, 12)}
                  </Text>
                ),
                width: 110
              },
              ...(effectiveScope === "team"
                ? [
                    {
                      title: "成员",
                      dataIndex: "user_name",
                      width: 120,
                      render: (v: string) => v || "-"
                    }
                  ]
                : []),
              {
                title: "Agent",
                dataIndex: "agent_type",
                width: 110,
                render: (v: string) => <Tag>{v}</Tag>
              },
              {
                title: "Models",
                dataIndex: "models",
                render: (v: string[]) => (v?.length ? v.join(", ") : "-"),
                width: 180
              },
              {
                title: "Input",
                dataIndex: "input_tokens",
                align: "right" as const,
                width: 100,
                render: (v: number) => formatTokens(v)
              },
              {
                title: "Output",
                dataIndex: "output_tokens",
                align: "right" as const,
                width: 100,
                render: (v: number) => formatTokens(v)
              },
              {
                title: "Cache Create",
                dataIndex: "cache_creation_tokens",
                align: "right" as const,
                width: 110,
                render: (v: number) => formatTokens(v || 0)
              },
              {
                title: "Cache Read",
                dataIndex: "cache_read_tokens",
                align: "right" as const,
                width: 110,
                render: (v: number) => (
                  <Text style={{ color: "#52c41a" }}>{formatTokens(v || 0)}</Text>
                )
              },
              {
                title: "Total",
                dataIndex: "total_tokens",
                align: "right" as const,
                width: 110,
                render: (v: number) => <Text strong>{formatTokens(v)}</Text>
              },
              {
                title: "Started",
                dataIndex: "started_at",
                render: (v: string) => formatDateTime(v),
                width: 140
              }
            ]}
            locale={{
              emptyText: (
                <Empty
                  description={
                    effectiveScope === "mine"
                      ? "所选范围暂无我的 Token 记录"
                      : "所选范围暂无团队 Token 记录"
                  }
                />
              )
            }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={effectiveScope === "team" ? 4 : 3}>
                    <Text strong>Total ({sessions.length})</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong>{formatTokens(totals.input)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong>{formatTokens(totals.output)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong>{formatTokens(totals.cacheCreate)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong style={{ color: "#52c41a" }}>
                      {formatTokens(totals.cacheRead)}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    <Text strong>{formatTokens(totals.total)}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} />
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>
      </Space>
    </PagePanel>
  );
}
