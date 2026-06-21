import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography
} from "antd";
import { RobotOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import dayjs from "dayjs";

import {
  fetchReports,
  fetchTeamMemberReports,
  fetchTeamReportTodayOrNull,
  fetchTeamReports,
  generateTeamReport,
  generateTodayReport,
  updateReport,
  updateTeamReport
} from "../../api/client";
import type { DailyReport, TeamMemberReport, TeamReport } from "../../api/types";
import { useAuth } from "@/shared/auth/authContext";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const todayStr = () => new Date().toISOString().split("T")[0];
const weekAgoStr = () => new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请稍后重试";
}

export function ReportsPage() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "team_leader") return <TLReportsView />;
  if (user.role === "director" || user.role === "admin") return <DirectorReportsView />;
  if (user.role === "pm") return <PMReportsView />;
  return <EmployeeReportsView />;
}

// ───────────────────────── Employee ─────────────────────────

function EmployeeReportsView() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editFeishuUrl, setEditFeishuUrl] = useState("");

  const reportsQuery = useQuery<DailyReport[]>({
    queryKey: ["reports", { from: weekAgoStr(), to: todayStr() }],
    queryFn: () => fetchReports({ from: weekAgoStr(), to: todayStr() }),
    staleTime: 30_000
  });
  const reports = reportsQuery.data ?? [];

  const generateMutation = useMutation({
    mutationFn: () => generateTodayReport(),
    onSuccess: () => {
      message.success("日报已生成");
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "生成失败")
  });

  const saveMutation = useMutation({
    mutationFn: (id: string) =>
      updateReport(id, { content: editContent, feishu_doc_url: editFeishuUrl || undefined }),
    onSuccess: () => {
      message.success("已保存");
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "保存失败")
  });

  return (
    <PagePanel
      title="个人日报"
      description="查看和编辑你的日报"
      breadcrumbs={[{ title: "报告" }, { title: "个人日报" }]}
      actions={
        <Button
          type="primary"
          icon={<RobotOutlined />}
          loading={generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
        >
          生成 AI 日报
        </Button>
      }
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {reportsQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="日报加载失败"
            description={errorMessage(reportsQuery.error)}
            action={<Button onClick={() => void reportsQuery.refetch()}>重试</Button>}
          />
        ) : reportsQuery.isLoading ? (
          <Card>
            <div style={{ textAlign: "center", padding: 32 }}>
              <Spin />
            </div>
          </Card>
        ) : reports.length === 0 ? (
          <Card>
            <Empty description="暂无报告，点击「生成 AI 日报」开始" />
          </Card>
        ) : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {reports.map((r) => (
              <Card
                key={r.id}
                size="small"
                title={
                  <Space>
                    <Text strong>{r.report_date}</Text>
                    <Tag color={r.edited ? "gold" : "blue"}>{r.edited ? "已编辑" : "自动生成"}</Tag>
                  </Space>
                }
                extra={
                  <Space>
                    {r.feishu_doc_url ? (
                      <a href={r.feishu_doc_url} target="_blank" rel="noreferrer">
                        <Button size="small">飞书文档</Button>
                      </a>
                    ) : null}
                    <Button
                      size="small"
                      onClick={() => {
                        if (editingId === r.id) {
                          saveMutation.mutate(r.id);
                        } else {
                          setEditingId(r.id);
                          setEditContent(r.content);
                          setEditFeishuUrl(r.feishu_doc_url || "");
                        }
                      }}
                      loading={editingId === r.id && saveMutation.isPending}
                    >
                      {editingId === r.id ? "保存" : "编辑"}
                    </Button>
                  </Space>
                }
              >
                {editingId === r.id ? (
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <TextArea
                      rows={8}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <Input
                      placeholder="飞书文档 URL"
                      value={editFeishuUrl}
                      onChange={(e) => setEditFeishuUrl(e.target.value)}
                    />
                  </Space>
                ) : (
                  <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                    {r.content}
                  </Paragraph>
                )}
              </Card>
            ))}
          </Space>
        )}
      </Space>
    </PagePanel>
  );
}

// ───────────────────────── PM ─────────────────────────

function PMReportsView() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const reportsQuery = useQuery<DailyReport[]>({
    queryKey: ["reports", { from: weekAgoStr(), to: todayStr() }],
    queryFn: () => fetchReports({ from: weekAgoStr(), to: todayStr() }),
    staleTime: 30_000
  });
  const reports = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data]);

  const generateMutation = useMutation({
    mutationFn: () => generateTodayReport(),
    onSuccess: () => {
      message.success("日报已生成");
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "生成失败")
  });

  const grouped = useMemo(() => {
    const byDate: Record<string, DailyReport[]> = {};
    for (const r of reports) {
      if (!byDate[r.report_date]) byDate[r.report_date] = [];
      byDate[r.report_date].push(r);
    }
    return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));
  }, [reports]);

  return (
    <PagePanel
      title="日报"
      description="查看团队成员日报"
      breadcrumbs={[{ title: "报告" }, { title: "日报" }]}
      actions={
        <Button
          type="primary"
          icon={<RobotOutlined />}
          loading={generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
        >
          生成我的日报
        </Button>
      }
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        {reportsQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="日报加载失败"
            description={errorMessage(reportsQuery.error)}
            action={<Button onClick={() => void reportsQuery.refetch()}>重试</Button>}
          />
        ) : reportsQuery.isLoading ? (
          <Card>
            <div style={{ textAlign: "center", padding: 32 }}>
              <Spin />
            </div>
          </Card>
        ) : reports.length === 0 ? (
          <Card>
            <Empty description="暂无报告" />
          </Card>
        ) : (
          grouped.map(([date, dateReports]) => (
            <Card key={date} size="small" title={date}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {dateReports.map((r) => (
                  <Card key={r.id} type="inner" size="small">
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      <Space>
                        <Text strong>{r.user_name}</Text>
                        <Tag color={r.edited ? "gold" : "blue"}>
                          {r.edited ? "已编辑" : "自动生成"}
                        </Tag>
                        {r.feishu_doc_url ? (
                          <a href={r.feishu_doc_url} target="_blank" rel="noreferrer">
                            飞书 ↗
                          </a>
                        ) : null}
                      </Space>
                      <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                        {r.content}
                      </Paragraph>
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>
          ))
        )}
      </Space>
    </PagePanel>
  );
}

// ───────────────────────── Team Leader ─────────────────────────

function TLReportsView() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState<"team" | "members">("team");
  const [memberDate, setMemberDate] = useState<dayjs.Dayjs>(dayjs());
  const [editingTeam, setEditingTeam] = useState(false);
  const [teamContent, setTeamContent] = useState("");
  const [teamFeishuUrl, setTeamFeishuUrl] = useState("");

  const teamReportQuery = useQuery<TeamReport | null>({
    queryKey: ["team-report-today"],
    queryFn: () => fetchTeamReportTodayOrNull(),
    staleTime: 30_000
  });
  const teamReport = teamReportQuery.data ?? null;

  const memberReportsQuery = useQuery<TeamMemberReport[]>({
    queryKey: ["team-member-reports", memberDate.format("YYYY-MM-DD")],
    queryFn: () => fetchTeamMemberReports(memberDate.format("YYYY-MM-DD")),
    enabled: tab === "members",
    staleTime: 30_000
  });
  const memberReports = memberReportsQuery.data ?? [];

  const generateMutation = useMutation({
    mutationFn: () => generateTeamReport(),
    onSuccess: () => {
      message.success("团队日报已生成");
      void queryClient.invalidateQueries({ queryKey: ["team-report-today"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "生成失败")
  });

  const saveMutation = useMutation({
    mutationFn: (id: string) =>
      updateTeamReport(id, { content: teamContent, feishu_doc_url: teamFeishuUrl || undefined }),
    onSuccess: () => {
      message.success("已保存");
      setEditingTeam(false);
      void queryClient.invalidateQueries({ queryKey: ["team-report-today"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "保存失败")
  });

  return (
    <PagePanel
      title="团队日报"
      description="生成团队日报并查看成员日报"
      breadcrumbs={[{ title: "报告" }, { title: "团队日报" }]}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as "team" | "members")}
          options={[
            { label: "团队日报", value: "team" },
            { label: "成员日报", value: "members" }
          ]}
        />

        {tab === "team" ? (
          <Card
            title="今日团队日报"
            extra={
              <Space>
                {teamReport && !editingTeam ? (
                  <Button
                    onClick={() => {
                      setEditingTeam(true);
                      setTeamContent(teamReport.content);
                      setTeamFeishuUrl(teamReport.feishu_doc_url || "");
                    }}
                  >
                    编辑
                  </Button>
                ) : null}
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  loading={generateMutation.isPending}
                  onClick={() => generateMutation.mutate()}
                >
                  生成团队日报
                </Button>
              </Space>
            }
          >
            {teamReportQuery.isError ? (
              <Alert
                type="error"
                showIcon
                message="团队日报加载失败"
                description={errorMessage(teamReportQuery.error)}
                action={<Button onClick={() => void teamReportQuery.refetch()}>重试</Button>}
              />
            ) : teamReportQuery.isLoading ? (
              <div style={{ textAlign: "center", padding: 32 }}>
                <Spin />
              </div>
            ) : !teamReport ? (
              <Empty description="尚未生成团队日报，点击「生成团队日报」创建" />
            ) : editingTeam ? (
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <TextArea
                  rows={10}
                  value={teamContent}
                  onChange={(e) => setTeamContent(e.target.value)}
                />
                <Input
                  placeholder="飞书文档 URL"
                  value={teamFeishuUrl}
                  onChange={(e) => setTeamFeishuUrl(e.target.value)}
                />
                <Space>
                  <Button
                    type="primary"
                    loading={saveMutation.isPending}
                    onClick={() => saveMutation.mutate(teamReport.id)}
                  >
                    保存
                  </Button>
                  <Button onClick={() => setEditingTeam(false)}>取消</Button>
                </Space>
              </Space>
            ) : (
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Space>
                  <Tag color="blue">{teamReport.team_name}</Tag>
                  <Text type="secondary">{teamReport.report_date}</Text>
                  {teamReport.feishu_doc_url ? (
                    <a href={teamReport.feishu_doc_url} target="_blank" rel="noreferrer">
                      飞书 ↗
                    </a>
                  ) : null}
                </Space>
                <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                  {teamReport.content}
                </Paragraph>
              </Space>
            )}
          </Card>
        ) : (
          <Card
            title="成员日报"
            extra={
              <DatePicker
                value={memberDate}
                onChange={(v) => v && setMemberDate(v)}
                allowClear={false}
              />
            }
          >
            {memberReportsQuery.isError ? (
              <Alert
                type="error"
                showIcon
                message="成员日报加载失败"
                description={errorMessage(memberReportsQuery.error)}
                action={<Button onClick={() => void memberReportsQuery.refetch()}>重试</Button>}
              />
            ) : memberReportsQuery.isLoading ? (
              <div style={{ textAlign: "center", padding: 32 }}>
                <Spin />
              </div>
            ) : memberReports.length === 0 ? (
              <Empty description="该日期未找到团队成员日报" />
            ) : (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {memberReports.map((mr) => (
                  <Card key={mr.user_id} type="inner" size="small">
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      <Space>
                        <Text strong>{mr.user_name}</Text>
                        <Tag color={mr.has_report ? "success" : "default"}>
                          {mr.has_report ? "已提交" : "未提交"}
                        </Tag>
                      </Space>
                      {mr.has_report ? (
                        <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                          {mr.content}
                        </Paragraph>
                      ) : (
                        <Text type="secondary" italic>
                          该日期暂无报告。
                        </Text>
                      )}
                    </Space>
                  </Card>
                ))}
              </Space>
            )}
          </Card>
        )}
      </Space>
    </PagePanel>
  );
}

// ───────────────────────── Director ─────────────────────────

function DirectorReportsView() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState<"teams" | "employees">("teams");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editFeishuUrl, setEditFeishuUrl] = useState("");

  const reportsQuery = useQuery<DailyReport[]>({
    queryKey: ["reports", { from: weekAgoStr(), to: todayStr() }],
    queryFn: () => fetchReports({ from: weekAgoStr(), to: todayStr() }),
    staleTime: 30_000
  });
  const reports = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data]);

  const teamReportsQuery = useQuery<TeamReport[]>({
    queryKey: ["team-reports", { from: weekAgoStr(), to: todayStr() }],
    queryFn: () => fetchTeamReports({ from: weekAgoStr(), to: todayStr() }),
    staleTime: 30_000
  });
  const teamReports = useMemo(() => teamReportsQuery.data ?? [], [teamReportsQuery.data]);

  const generateMutation = useMutation({
    mutationFn: () => generateTodayReport(),
    onSuccess: () => {
      message.success("日报已生成");
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "生成失败")
  });

  const saveMutation = useMutation({
    mutationFn: (id: string) =>
      updateReport(id, { content: editContent, feishu_doc_url: editFeishuUrl || undefined }),
    onSuccess: () => {
      message.success("已保存");
      setEditingId(null);
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "保存失败")
  });

  const groupedEmployeeReports = useMemo(() => {
    const byDate: Record<string, DailyReport[]> = {};
    for (const r of reports) {
      if (!byDate[r.report_date]) byDate[r.report_date] = [];
      byDate[r.report_date].push(r);
    }
    return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));
  }, [reports]);

  const groupedTeamReports = useMemo(() => {
    const byDate: Record<string, TeamReport[]> = {};
    for (const r of teamReports) {
      if (!byDate[r.report_date]) byDate[r.report_date] = [];
      byDate[r.report_date].push(r);
    }
    return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));
  }, [teamReports]);

  const activeQuery = tab === "teams" ? teamReportsQuery : reportsQuery;
  const activeError = tab === "teams" ? teamReportsQuery.error : reportsQuery.error;

  return (
    <PagePanel
      title="部门报告"
      description="查看全部门的小组日报与员工日报"
      breadcrumbs={[{ title: "报告" }, { title: "部门报告" }]}
      actions={
        <Button
          type="primary"
          icon={<RobotOutlined />}
          loading={generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
        >
          生成我的日报
        </Button>
      }
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as "teams" | "employees")}
          options={[
            { label: "小组日报", value: "teams" },
            { label: "员工日报", value: "employees" }
          ]}
        />

        {activeQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="报告加载失败"
            description={errorMessage(activeError)}
            action={<Button onClick={() => void activeQuery.refetch()}>重试</Button>}
          />
        ) : activeQuery.isLoading ? (
          <Card>
            <div style={{ textAlign: "center", padding: 32 }}>
              <Spin />
            </div>
          </Card>
        ) : tab === "teams" ? (
          groupedTeamReports.length === 0 ? (
            <Card>
              <Empty description="暂无团队日报。各团队 TL 可在其 Reports 页面生成。" />
            </Card>
          ) : (
            groupedTeamReports.map(([date, rs]) => (
              <Card key={date} size="small" title={date}>
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  {rs.map((r) => (
                    <Card key={r.id} type="inner" size="small">
                      <Space direction="vertical" size={4} style={{ width: "100%" }}>
                        <Space>
                          <Tag color="blue">{r.team_name}</Tag>
                          <Text type="secondary">由 {r.leader_name} 生成</Text>
                          {r.feishu_doc_url ? (
                            <a href={r.feishu_doc_url} target="_blank" rel="noreferrer">
                              飞书 ↗
                            </a>
                          ) : null}
                        </Space>
                        <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                          {r.content}
                        </Paragraph>
                      </Space>
                    </Card>
                  ))}
                </Space>
              </Card>
            ))
          )
        ) : groupedEmployeeReports.length === 0 ? (
          <Card>
            <Empty description="暂无员工日报" />
          </Card>
        ) : (
          groupedEmployeeReports.map(([date, dateReports]) => (
            <Card key={date} size="small" title={date}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {dateReports.map((r) => (
                  <Card
                    key={r.id}
                    type="inner"
                    size="small"
                    extra={
                      <Space>
                        {r.feishu_doc_url ? (
                          <a href={r.feishu_doc_url} target="_blank" rel="noreferrer">
                            <Button size="small">飞书文档</Button>
                          </a>
                        ) : null}
                        <Button
                          size="small"
                          onClick={() => {
                            if (editingId === r.id) {
                              saveMutation.mutate(r.id);
                            } else {
                              setEditingId(r.id);
                              setEditContent(r.content);
                              setEditFeishuUrl(r.feishu_doc_url || "");
                            }
                          }}
                          loading={editingId === r.id && saveMutation.isPending}
                        >
                          {editingId === r.id ? "保存" : "编辑"}
                        </Button>
                      </Space>
                    }
                  >
                    <Space direction="vertical" size={4} style={{ width: "100%" }}>
                      <Space>
                        <Text strong>{r.user_name}</Text>
                        <Tag color={r.edited ? "gold" : "blue"}>
                          {r.edited ? "已编辑" : "自动生成"}
                        </Tag>
                      </Space>
                      {editingId === r.id ? (
                        <Space direction="vertical" size={8} style={{ width: "100%" }}>
                          <TextArea
                            rows={6}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                          />
                          <Input
                            placeholder="飞书文档 URL"
                            value={editFeishuUrl}
                            onChange={(e) => setEditFeishuUrl(e.target.value)}
                          />
                        </Space>
                      ) : (
                        <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                          {r.content}
                        </Paragraph>
                      )}
                    </Space>
                  </Card>
                ))}
              </Space>
            </Card>
          ))
        )}
      </Space>
    </PagePanel>
  );
}
