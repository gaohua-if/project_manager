import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  DatePicker,
  Empty,
  Input,
  Segmented,
  Skeleton,
  Space
} from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  FileTextOutlined,
  LinkOutlined,
  RobotOutlined,
  TeamOutlined
} from "@ant-design/icons";
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
import {
  RequirementMetricCard,
  RequirementMetricGrid
} from "../../requirements/components/RequirementMetricCard";
import { useAuth } from "@/shared/auth/authContext";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

import "./ReportsPage.css";

const { TextArea } = Input;

const todayStr = () => new Date().toISOString().split("T")[0];
const weekAgoStr = () => new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请稍后重试";
}

function reportStateClass(edited: boolean) {
  return edited ? "is-edited" : "is-auto";
}

function FeishuLink({ url }: { url: string }) {
  return (
    <a className="reports-feishu-link" href={url} target="_blank" rel="noreferrer">
      <LinkOutlined />
      飞书文档
    </a>
  );
}

function ReportsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="reports-loading-frame">
      <Skeleton active paragraph={{ rows }} />
    </div>
  );
}

function ReportsEmpty({ description }: { description: string }) {
  return (
    <div className="reports-empty-frame">
      <Empty description={description} />
    </div>
  );
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

  const today = todayStr();
  const todayCount = reports.filter((r) => r.report_date === today).length;
  const weekCount = reports.length;
  const editedCount = reports.filter((r) => r.edited).length;
  const feishuCount = reports.filter((r) => r.feishu_doc_url).length;

  return (
    <PagePanel
      title="个人日报"
      description="查看和编辑你的日报"
      breadcrumbs={[{ title: "报告" }, { title: "个人日报" }]}
      className="reports-page aidashboard-list"
      showNav={false}
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
      <RequirementMetricGrid>
        <RequirementMetricCard
          tone="primary"
          icon={<CalendarOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "today",
            title: "今日日报",
            value: todayCount,
            description: todayCount > 0 ? "今日已生成" : "今日待生成"
          }}
        />
        <RequirementMetricCard
          tone="info"
          icon={<FileTextOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "week",
            title: "本周日报",
            value: weekCount,
            description: "近 7 天"
          }}
        />
        <RequirementMetricCard
          tone="warning"
          icon={<EditOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "edited",
            title: "已编辑",
            value: editedCount,
            description: "手动调整后的日报"
          }}
        />
        <RequirementMetricCard
          tone="success"
          icon={<LinkOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "feishu",
            title: "关联飞书",
            value: feishuCount,
            description: "已挂飞书文档"
          }}
        />
      </RequirementMetricGrid>

      {reportsQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="日报加载失败"
          description={errorMessage(reportsQuery.error)}
          action={<Button onClick={() => void reportsQuery.refetch()}>重试</Button>}
        />
      ) : reportsQuery.isLoading ? (
        <ReportsSkeleton />
      ) : reports.length === 0 ? (
        <ReportsEmpty description="暂无报告，点击「生成 AI 日报」开始" />
      ) : (
        <div className="reports-day-grid">
          {reports.map((r) => (
            <article
              key={r.id}
              className={`reports-report-card ${reportStateClass(r.edited)}`}
            >
              <header className="reports-report-card__head">
                <span className="reports-report-card__head-left">
                  <span className="reports-report-card__date">{r.report_date}</span>
                  <span className={`reports-tag ${reportStateClass(r.edited)}`}>
                    {r.edited ? "已编辑" : "自动生成"}
                  </span>
                </span>
                <span className="reports-report-card__head-right">
                  {r.feishu_doc_url ? <FeishuLink url={r.feishu_doc_url} /> : null}
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
                  {editingId === r.id ? (
                    <Button size="small" onClick={() => setEditingId(null)}>
                      取消
                    </Button>
                  ) : null}
                </span>
              </header>
              {editingId === r.id ? (
                <div className="reports-edit-shell">
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
                </div>
              ) : (
                <p className="reports-report-card__content">{r.content}</p>
              )}
            </article>
          ))}
        </div>
      )}
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

  const today = todayStr();
  const todayCount = reports.filter((r) => r.report_date === today).length;
  const editedCount = reports.filter((r) => r.edited).length;
  const autoCount = reports.length - editedCount;
  const feishuCount = reports.filter((r) => r.feishu_doc_url).length;

  return (
    <PagePanel
      title="日报"
      description="查看团队成员日报"
      breadcrumbs={[{ title: "报告" }, { title: "日报" }]}
      className="reports-page aidashboard-list"
      showNav={false}
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
      <RequirementMetricGrid>
        <RequirementMetricCard
          tone="primary"
          icon={<CalendarOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "today",
            title: "今日报告",
            value: todayCount,
            description: "今日已生成数"
          }}
        />
        <RequirementMetricCard
          tone="warning"
          icon={<EditOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "edited",
            title: "已编辑",
            value: editedCount,
            description: "手动调整后"
          }}
        />
        <RequirementMetricCard
          tone="info"
          icon={<RobotOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "auto",
            title: "自动生成",
            value: autoCount,
            description: "未经编辑的 AI 日报"
          }}
        />
        <RequirementMetricCard
          tone="success"
          icon={<LinkOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "feishu",
            title: "关联飞书",
            value: feishuCount,
            description: "已挂飞书文档"
          }}
        />
      </RequirementMetricGrid>

      {reportsQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="日报加载失败"
          description={errorMessage(reportsQuery.error)}
          action={<Button onClick={() => void reportsQuery.refetch()}>重试</Button>}
        />
      ) : reportsQuery.isLoading ? (
        <ReportsSkeleton />
      ) : reports.length === 0 ? (
        <ReportsEmpty description="暂无报告" />
      ) : (
        grouped.map(([date, dateReports]) => (
          <section className="reports-day-section" key={date}>
            <header className="reports-day-section__head">
              <span className="reports-day-section__date">{date}</span>
              <span className="reports-day-section__rule" aria-hidden="true" />
              <span className="reports-day-section__count">{dateReports.length} 份</span>
            </header>
            <div className="reports-day-grid">
              {dateReports.map((r) => (
                <article
                  key={r.id}
                  className={`reports-report-card ${reportStateClass(r.edited)}`}
                >
                  <header className="reports-report-card__head">
                    <span className="reports-report-card__head-left">
                      <span className="reports-report-card__author">{r.user_name}</span>
                      <span className={`reports-tag ${reportStateClass(r.edited)}`}>
                        {r.edited ? "已编辑" : "自动生成"}
                      </span>
                    </span>
                    {r.feishu_doc_url ? (
                      <span className="reports-report-card__head-right">
                        <FeishuLink url={r.feishu_doc_url} />
                      </span>
                    ) : null}
                  </header>
                  <p className="reports-report-card__content">{r.content}</p>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
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

  const memberTotal = memberReports.length;
  const submitted = memberReports.filter((m) => m.has_report).length;
  const missing = memberTotal - submitted;
  const edited = memberReports.filter((m) => m.has_report && m.content && m.content.length > 0).length;

  return (
    <PagePanel
      title="团队日报"
      description="生成团队日报并查看成员日报"
      breadcrumbs={[{ title: "报告" }, { title: "团队日报" }]}
      className="reports-page aidashboard-list"
      showNav={false}
    >
      <RequirementMetricGrid>
        <RequirementMetricCard
          tone="primary"
          icon={<TeamOutlined />}
          loading={memberReportsQuery.isLoading}
          metric={{
            key: "total",
            title: "成员总数",
            value: memberTotal,
            description: memberDate.format("YYYY-MM-DD")
          }}
        />
        <RequirementMetricCard
          tone="success"
          icon={<CheckCircleOutlined />}
          loading={memberReportsQuery.isLoading}
          metric={{
            key: "submitted",
            title: "今日已交",
            value: submitted,
            description:
              memberTotal > 0 ? `提交率 ${Math.round((submitted * 100) / memberTotal)}%` : "暂无成员"
          }}
        />
        <RequirementMetricCard
          tone="danger"
          icon={<CloseCircleOutlined />}
          loading={memberReportsQuery.isLoading}
          metric={{
            key: "missing",
            title: "今日未交",
            value: missing,
            description: missing > 0 ? "需要提醒" : "全员到齐"
          }}
        />
        <RequirementMetricCard
          tone="warning"
          icon={<EditOutlined />}
          loading={memberReportsQuery.isLoading}
          metric={{
            key: "edited",
            title: "已编辑",
            value: edited,
            description: "成员有内容的日报"
          }}
        />
      </RequirementMetricGrid>

      <div className="reports-toolbar">
        <div className="reports-toolbar__meta">
          <strong>{tab === "team" ? "团队日报" : "成员日报"}</strong>
          <span>·</span>
          <span>{tab === "team" ? "今日" : memberDate.format("YYYY-MM-DD")}</span>
        </div>
        <div className="reports-toolbar__right">
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as "team" | "members")}
            options={[
              { label: "团队日报", value: "team" },
              { label: "成员日报", value: "members" }
            ]}
          />
          {tab === "members" ? (
            <DatePicker
              value={memberDate}
              onChange={(v) => v && setMemberDate(v)}
              allowClear={false}
            />
          ) : (
            <Button
              type="primary"
              icon={<RobotOutlined />}
              loading={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              生成团队日报
            </Button>
          )}
        </div>
      </div>

      {tab === "team" ? (
        teamReportQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="团队日报加载失败"
            description={errorMessage(teamReportQuery.error)}
            action={<Button onClick={() => void teamReportQuery.refetch()}>重试</Button>}
          />
        ) : teamReportQuery.isLoading ? (
          <ReportsSkeleton />
        ) : !teamReport ? (
          <ReportsEmpty description="尚未生成团队日报，点击「生成团队日报」创建" />
        ) : (
          <section className="reports-team-card">
            <header className="reports-team-card__head">
              <span className="reports-team-card__title">{teamReport.team_name}</span>
              <span className="reports-team-card__meta">
                <span className="reports-tag is-team">团队</span>
                <span>{teamReport.report_date}</span>
                {teamReport.feishu_doc_url ? <FeishuLink url={teamReport.feishu_doc_url} /> : null}
                {!editingTeam ? (
                  <Button
                    size="small"
                    onClick={() => {
                      setEditingTeam(true);
                      setTeamContent(teamReport.content);
                      setTeamFeishuUrl(teamReport.feishu_doc_url || "");
                    }}
                  >
                    编辑
                  </Button>
                ) : null}
              </span>
            </header>
            {editingTeam ? (
              <div className="reports-edit-shell">
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
                <div className="reports-edit-shell__actions">
                  <Button onClick={() => setEditingTeam(false)}>取消</Button>
                  <Button
                    type="primary"
                    loading={saveMutation.isPending}
                    onClick={() => saveMutation.mutate(teamReport.id)}
                  >
                    保存
                  </Button>
                </div>
              </div>
            ) : (
              <p className="reports-team-card__body">{teamReport.content}</p>
            )}
          </section>
        )
      ) : memberReportsQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="成员日报加载失败"
          description={errorMessage(memberReportsQuery.error)}
          action={<Button onClick={() => void memberReportsQuery.refetch()}>重试</Button>}
        />
      ) : memberReportsQuery.isLoading ? (
        <ReportsSkeleton />
      ) : memberReports.length === 0 ? (
        <ReportsEmpty description="该日期未找到团队成员日报" />
      ) : (
        <div className="reports-member-grid">
          {memberReports.map((mr) => (
            <article
              key={mr.user_id}
              className={`reports-report-card ${mr.has_report ? "is-auto" : "is-missing"}`}
            >
              <header className="reports-report-card__head">
                <span className="reports-report-card__head-left">
                  <span className="reports-report-card__author">{mr.user_name}</span>
                  <span className={`reports-tag ${mr.has_report ? "is-submitted" : "is-missing"}`}>
                    {mr.has_report ? "已提交" : "未提交"}
                  </span>
                </span>
              </header>
              {mr.has_report ? (
                <p className="reports-report-card__content">{mr.content}</p>
              ) : (
                <span className="reports-report-card__empty">该日期暂无报告。</span>
              )}
            </article>
          ))}
        </div>
      )}
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

  const today = todayStr();
  const todayReports = reports.filter((r) => r.report_date === today).length;
  const teamsCovered = new Set(teamReports.map((r) => r.team_id)).size;
  const editedCount = reports.filter((r) => r.edited).length;
  const autoCount = reports.length - editedCount;

  const activeQuery = tab === "teams" ? teamReportsQuery : reportsQuery;
  const activeError = tab === "teams" ? teamReportsQuery.error : reportsQuery.error;

  return (
    <PagePanel
      title="部门报告"
      description="查看全部门的小组日报与员工日报"
      breadcrumbs={[{ title: "报告" }, { title: "部门报告" }]}
      className="reports-page aidashboard-list"
      showNav={false}
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
      <RequirementMetricGrid>
        <RequirementMetricCard
          tone="primary"
          icon={<CalendarOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "today",
            title: "今日报告",
            value: todayReports,
            description: "今日全部门已生成"
          }}
        />
        <RequirementMetricCard
          tone="info"
          icon={<TeamOutlined />}
          loading={teamReportsQuery.isLoading}
          metric={{
            key: "teams",
            title: "涉及团队",
            value: teamsCovered,
            description: "已生成团队日报数"
          }}
        />
        <RequirementMetricCard
          tone="warning"
          icon={<EditOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "edited",
            title: "已编辑",
            value: editedCount,
            description: "经成员调整的报告"
          }}
        />
        <RequirementMetricCard
          tone="success"
          icon={<RobotOutlined />}
          loading={reportsQuery.isLoading}
          metric={{
            key: "auto",
            title: "自动生成",
            value: autoCount,
            description: "未经编辑的 AI 日报"
          }}
        />
      </RequirementMetricGrid>

      <div className="reports-toolbar">
        <div className="reports-toolbar__meta">
          <strong>{tab === "teams" ? "小组日报" : "员工日报"}</strong>
          <span>·</span>
          <span>近 7 天</span>
        </div>
        <div className="reports-toolbar__right">
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as "teams" | "employees")}
            options={[
              { label: "小组日报", value: "teams" },
              { label: "员工日报", value: "employees" }
            ]}
          />
        </div>
      </div>

      {activeQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="报告加载失败"
          description={errorMessage(activeError)}
          action={<Button onClick={() => void activeQuery.refetch()}>重试</Button>}
        />
      ) : activeQuery.isLoading ? (
        <ReportsSkeleton />
      ) : tab === "teams" ? (
        groupedTeamReports.length === 0 ? (
          <ReportsEmpty description="暂无团队日报。各团队 TL 可在其 Reports 页面生成。" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {groupedTeamReports.map(([date, rs]) => (
              <section className="reports-day-section" key={date}>
                <header className="reports-day-section__head">
                  <span className="reports-day-section__date">{date}</span>
                  <span className="reports-day-section__rule" aria-hidden="true" />
                  <span className="reports-day-section__count">{rs.length} 个团队</span>
                </header>
                <div className="reports-day-grid">
                  {rs.map((r) => (
                    <article className="reports-report-card is-auto" key={r.id}>
                      <header className="reports-report-card__head">
                        <span className="reports-report-card__head-left">
                          <span className="reports-report-card__author">{r.team_name}</span>
                          <span className="reports-tag is-team">团队</span>
                        </span>
                        <span className="reports-report-card__head-right">
                          {r.feishu_doc_url ? <FeishuLink url={r.feishu_doc_url} /> : null}
                        </span>
                      </header>
                      <p className="reports-report-card__content">{r.content}</p>
                      <span className="reports-report-card__date">由 {r.leader_name} 生成</span>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </Space>
        )
      ) : groupedEmployeeReports.length === 0 ? (
        <ReportsEmpty description="暂无员工日报" />
      ) : (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {groupedEmployeeReports.map(([date, dateReports]) => (
            <section className="reports-day-section" key={date}>
              <header className="reports-day-section__head">
                <span className="reports-day-section__date">{date}</span>
                <span className="reports-day-section__rule" aria-hidden="true" />
                <span className="reports-day-section__count">{dateReports.length} 份</span>
              </header>
              <div className="reports-day-grid">
                {dateReports.map((r) => (
                  <article
                    key={r.id}
                    className={`reports-report-card ${reportStateClass(r.edited)}`}
                  >
                    <header className="reports-report-card__head">
                      <span className="reports-report-card__head-left">
                        <span className="reports-report-card__author">{r.user_name}</span>
                        <span className={`reports-tag ${reportStateClass(r.edited)}`}>
                          {r.edited ? "已编辑" : "自动生成"}
                        </span>
                      </span>
                      <span className="reports-report-card__head-right">
                        {r.feishu_doc_url ? <FeishuLink url={r.feishu_doc_url} /> : null}
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
                        {editingId === r.id ? (
                          <Button size="small" onClick={() => setEditingId(null)}>
                            取消
                          </Button>
                        ) : null}
                      </span>
                    </header>
                    {editingId === r.id ? (
                      <div className="reports-edit-shell">
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
                      </div>
                    ) : (
                      <p className="reports-report-card__content">{r.content}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </Space>
      )}
    </PagePanel>
  );
}
