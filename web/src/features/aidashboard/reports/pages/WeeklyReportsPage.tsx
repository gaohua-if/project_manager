import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Alert, App, Button, DatePicker, Empty, Input, Segmented, Skeleton } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  RobotOutlined,
  TeamOutlined
} from "@ant-design/icons";
import { useState, type ReactNode } from "react";
import dayjs from "dayjs";

import {
  fetchDepartmentWeeklyReportCurrentOrNull,
  fetchDepartmentWeeklyReports,
  fetchDepartmentWeeklyReportSources,
  fetchTeamWeeklyReportCurrentOrNull,
  fetchTeamWeeklyReports,
  fetchTeamWeeklyReportSources,
  generateDepartmentWeeklyReport,
  generateTeamWeeklyReport,
  submitTeamWeeklyReport,
  updateDepartmentWeeklyReport,
  updateTeamWeeklyReport
} from "../../api/client";
import type {
  DepartmentWeeklyReport,
  DepartmentWeeklyReportSources,
  TeamWeeklyReport,
  TeamWeeklyReportSources
} from "../../api/types";
import {
  RequirementMetricCard,
  RequirementMetricGrid
} from "../../requirements/components/RequirementMetricCard";
import { useAuth } from "@/shared/auth/authContext";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

import "./ReportsPage.css";

const { TextArea } = Input;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请稍后重试";
}

function weekStartOf(value: dayjs.Dayjs) {
  const day = value.day();
  const diff = day === 0 ? -6 : 1 - day;
  return value.add(diff, "day").format("YYYY-MM-DD");
}

function weekEndOf(weekStart: string) {
  return dayjs(weekStart).add(6, "day").format("YYYY-MM-DD");
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

export function WeeklyReportsPage() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(dayjs()));

  if (!user) return null;

  const weekEnd = weekEndOf(weekStart);
  const picker = (
    <DatePicker
      value={dayjs(weekStart)}
      allowClear={false}
      onChange={(value) => value && setWeekStart(weekStartOf(value))}
    />
  );

  if (user.role === "director" || user.role === "admin") {
    return <DirectorWeeklyReportsView weekStart={weekStart} weekEnd={weekEnd} weekPicker={picker} />;
  }
  if (user.role === "team_leader") {
    return <TeamWeeklyReportsView weekStart={weekStart} weekEnd={weekEnd} weekPicker={picker} canEdit />;
  }
  if (user.role === "pm") {
    return <TeamWeeklyReportsView weekStart={weekStart} weekEnd={weekEnd} weekPicker={picker} />;
  }

  return (
    <PagePanel
      title="周报"
      description="当前产品口径暂未开放个人周报"
      breadcrumbs={[{ title: "报告" }, { title: "周报" }]}
      className="reports-page aidashboard-list"
      showNav={false}
      actions={picker}
    >
      <ReportsEmpty description="个人周报暂未开放。" />
    </PagePanel>
  );
}

function TeamWeeklyReportsView({
  weekStart,
  weekEnd,
  weekPicker,
  canEdit = false
}: {
  weekStart: string;
  weekEnd: string;
  weekPicker: ReactNode;
  canEdit?: boolean;
}) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState<"sources" | "draft" | "history">("sources");
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");

  const sourcesQuery = useQuery<TeamWeeklyReportSources>({
    queryKey: ["reports", "weekly", "team", "sources", weekStart],
    queryFn: () => fetchTeamWeeklyReportSources(weekStart),
    staleTime: 30_000
  });
  const reportQuery = useQuery<TeamWeeklyReport | null>({
    queryKey: ["reports", "weekly", "team", "current", weekStart],
    queryFn: () => fetchTeamWeeklyReportCurrentOrNull(weekStart),
    staleTime: 30_000
  });
  const historyQuery = useQuery<TeamWeeklyReport[]>({
    queryKey: ["reports", "weekly", "team", "history"],
    queryFn: () => fetchTeamWeeklyReports(),
    staleTime: 30_000
  });

  const sources = sourcesQuery.data;
  const report = reportQuery.data ?? null;
  const history = historyQuery.data ?? [];

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["reports", "weekly", "team"] });
    void queryClient.invalidateQueries({ queryKey: ["reports", "weekly", "department"] });
  };

  const generateMutation = useMutation({
    mutationFn: () => generateTeamWeeklyReport(weekStart),
    onSuccess: () => {
      message.success("小组周报草稿已生成");
      invalidate();
      setTab("draft");
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "生成失败")
  });

  const saveMutation = useMutation({
    mutationFn: (id: string) => updateTeamWeeklyReport(id, { content }),
    onSuccess: () => {
      message.success("已保存");
      setEditing(false);
      invalidate();
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "保存失败")
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => submitTeamWeeklyReport(id),
    onSuccess: () => {
      message.success("已提交给总监");
      invalidate();
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "提交失败")
  });

  return (
    <PagePanel
      title="小组周报"
      description="先确认本周来源，再生成并提交小组周报"
      breadcrumbs={[{ title: "报告" }, { title: "周报" }]}
      className="reports-page aidashboard-list"
      showNav={false}
    >
      <RequirementMetricGrid>
        <RequirementMetricCard
          tone="primary"
          icon={<CalendarOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{ key: "week", title: "周报周期", value: dayjs(weekStart).format("MM-DD"), description: `${weekStart} 至 ${weekEnd}` }}
        />
        <RequirementMetricCard
          tone="success"
          icon={<FileTextOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{ key: "daily", title: "个人日报来源", value: sources?.submitted_daily_count ?? 0, description: "本周成员日报" }}
        />
        <RequirementMetricCard
          tone="info"
          icon={<TeamOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{ key: "team", title: "小组日报来源", value: sources?.team_report_count ?? 0, description: "本周小组日报" }}
        />
        <RequirementMetricCard
          tone="warning"
          icon={<CheckCircleOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{ key: "tasks", title: "任务/风险", value: sources?.task_count ?? 0, description: report?.submitted_at ? "已提交" : "待提交" }}
        />
      </RequirementMetricGrid>

      <div className="reports-toolbar">
        <div className="reports-toolbar__meta">
          <strong>{tab === "sources" ? "本周来源确认" : tab === "draft" ? "小组周报草稿" : "小组周报历史"}</strong>
          <span>·</span>
          <span>{weekStart} 至 {weekEnd}</span>
        </div>
        <div className="reports-toolbar__right">
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as "sources" | "draft" | "history")}
            options={[{ label: "来源确认", value: "sources" }, { label: "周报草稿", value: "draft" }, { label: "历史", value: "history" }]}
          />
          {weekPicker}
          {canEdit && tab === "sources" ? (
            <Button type="primary" icon={<RobotOutlined />} loading={generateMutation.isPending} onClick={() => generateMutation.mutate()}>
              生成小组周报草稿
            </Button>
          ) : null}
        </div>
      </div>

      {tab === "sources" ? (
        <TeamWeeklySources query={sourcesQuery} />
      ) : tab === "history" ? (
        <TeamWeeklyHistory query={historyQuery} reports={history} />
      ) : reportQuery.isError ? (
        <Alert type="error" showIcon message="小组周报加载失败" description={errorMessage(reportQuery.error)} />
      ) : reportQuery.isLoading ? (
        <ReportsSkeleton />
      ) : !report ? (
        <ReportsEmpty description="尚未生成小组周报草稿，请先确认来源。" />
      ) : (
        <section className="reports-team-card">
          <header className="reports-team-card__head">
            <span className="reports-team-card__title">{report.team_name}</span>
            <span className="reports-team-card__meta">
              <span className={`reports-tag ${report.submitted_at ? "is-submitted" : "is-team"}`}>{report.submitted_at ? "已提交总监" : "草稿"}</span>
              <span>{report.week_start}</span>
              {canEdit && !editing ? (
                <Button size="small" onClick={() => { setEditing(true); setContent(report.content); }}>
                  编辑
                </Button>
              ) : null}
              {canEdit && !editing && !report.submitted_at ? (
                <Button size="small" type="primary" loading={submitMutation.isPending} onClick={() => submitMutation.mutate(report.id)}>
                  提交给总监
                </Button>
              ) : null}
            </span>
          </header>
          {editing ? (
            <div className="reports-edit-shell">
              <TextArea rows={12} value={content} onChange={(e) => setContent(e.target.value)} />
              <div className="reports-edit-shell__actions">
                <Button onClick={() => setEditing(false)}>取消</Button>
                <Button type="primary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate(report.id)}>保存</Button>
              </div>
            </div>
          ) : (
            <p className="reports-team-card__body">{report.content}</p>
          )}
        </section>
      )}
    </PagePanel>
  );
}

function TeamWeeklySources({ query }: { query: UseQueryResult<TeamWeeklyReportSources> }) {
  const sources = query.data;
  if (query.isError) return <Alert type="error" showIcon message="周报来源加载失败" description={errorMessage(query.error)} />;
  if (query.isLoading) return <ReportsSkeleton />;
  if (!sources) return <ReportsEmpty description="暂无来源" />;
  return (
    <div className="reports-member-grid">
      {[...sources.daily_reports.map((item) => ({ key: `daily-${item.report_id}`, title: `${item.user_name} · ${item.report_date}`, tag: "个人日报", content: item.content })),
        ...sources.team_reports.map((item) => ({ key: `team-${item.report_id}`, title: `${item.team_name} · ${item.report_date}`, tag: "小组日报", content: item.content })),
        ...sources.tasks.map((item) => ({ key: `task-${item.task_id}`, title: item.task_title, tag: `${item.status}/${item.priority}`, content: `需求：${item.requirement_title}\n负责人：${item.assignee_name || "未分配"}` }))].map((item) => (
        <article key={item.key} className="reports-report-card is-auto">
          <header className="reports-report-card__head">
            <span className="reports-report-card__head-left">
              <span className="reports-report-card__author">{item.title}</span>
              <span className="reports-tag is-team">{item.tag}</span>
            </span>
          </header>
          <p className="reports-report-card__content">{item.content}</p>
        </article>
      ))}
    </div>
  );
}

function TeamWeeklyHistory({ query, reports }: { query: UseQueryResult<TeamWeeklyReport[]>; reports: TeamWeeklyReport[] }) {
  if (query.isError) return <Alert type="error" showIcon message="小组周报历史加载失败" description={errorMessage(query.error)} />;
  if (query.isLoading) return <ReportsSkeleton />;
  if (reports.length === 0) return <ReportsEmpty description="暂无小组周报历史" />;
  return <WeeklyReportCards reports={reports.map((r) => ({ id: r.id, title: r.team_name, date: r.week_start, content: r.content, done: Boolean(r.submitted_at) }))} />;
}

function DirectorWeeklyReportsView({ weekStart, weekEnd, weekPicker }: { weekStart: string; weekEnd: string; weekPicker: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState<"sources" | "draft" | "history" | "teams">("sources");
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");

  const sourcesQuery = useQuery<DepartmentWeeklyReportSources>({
    queryKey: ["reports", "weekly", "department", "sources", weekStart],
    queryFn: () => fetchDepartmentWeeklyReportSources(weekStart),
    staleTime: 30_000
  });
  const reportQuery = useQuery<DepartmentWeeklyReport | null>({
    queryKey: ["reports", "weekly", "department", "current", weekStart],
    queryFn: () => fetchDepartmentWeeklyReportCurrentOrNull(weekStart),
    staleTime: 30_000
  });
  const historyQuery = useQuery<DepartmentWeeklyReport[]>({
    queryKey: ["reports", "weekly", "department", "history"],
    queryFn: () => fetchDepartmentWeeklyReports(),
    staleTime: 30_000
  });
  const teamHistoryQuery = useQuery<TeamWeeklyReport[]>({
    queryKey: ["reports", "weekly", "team", "history", "director"],
    queryFn: () => fetchTeamWeeklyReports(),
    staleTime: 30_000
  });

  const sources = sourcesQuery.data;
  const report = reportQuery.data ?? null;
  const history = historyQuery.data ?? [];
  const teamHistory = teamHistoryQuery.data ?? [];
  const submitted = sources?.submitted_team_count ?? 0;
  const total = sources?.total_team_count ?? 0;
  const missing = sources?.missing_teams.length ?? 0;

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["reports", "weekly"] });
  const generateMutation = useMutation({
    mutationFn: () => generateDepartmentWeeklyReport(weekStart),
    onSuccess: () => { message.success("部门周报草稿已生成"); invalidate(); setTab("draft"); },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "生成失败")
  });
  const saveMutation = useMutation({
    mutationFn: (id: string) => updateDepartmentWeeklyReport(id, { content }),
    onSuccess: () => { message.success("已保存"); setEditing(false); invalidate(); },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "保存失败")
  });
  const archiveMutation = useMutation({
    mutationFn: (id: string) => updateDepartmentWeeklyReport(id, { content: content || report?.content, archive: true }),
    onSuccess: () => { message.success("部门周报已归档"); setEditing(false); invalidate(); },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "归档失败")
  });

  return (
    <PagePanel title="部门周报" description="基于已提交小组周报生成部门周报" breadcrumbs={[{ title: "报告" }, { title: "周报" }]} className="reports-page aidashboard-list" showNav={false}>
      <RequirementMetricGrid>
        <RequirementMetricCard tone="primary" icon={<CalendarOutlined />} loading={sourcesQuery.isLoading} metric={{ key: "week", title: "周报周期", value: dayjs(weekStart).format("MM-DD"), description: `${weekStart} 至 ${weekEnd}` }} />
        <RequirementMetricCard tone="success" icon={<CheckCircleOutlined />} loading={sourcesQuery.isLoading} metric={{ key: "submitted", title: "已提交小组", value: submitted, description: total > 0 ? `提交率 ${Math.round((submitted * 100) / total)}%` : "暂无小组" }} />
        <RequirementMetricCard tone="warning" icon={<CloseCircleOutlined />} loading={sourcesQuery.isLoading} metric={{ key: "missing", title: "未提交小组", value: missing, description: missing > 0 ? "等待 TL 提交" : "小组周报到齐" }} />
        <RequirementMetricCard tone="info" icon={<RobotOutlined />} loading={reportQuery.isLoading} metric={{ key: "archive", title: "归档状态", value: report?.archived_at ? 1 : 0, description: report?.archived_at ? "已归档" : "待生成或待归档" }} />
      </RequirementMetricGrid>

      <div className="reports-toolbar">
        <div className="reports-toolbar__meta"><strong>{tab === "sources" ? "小组周报收集" : tab === "draft" ? "部门周报草稿" : tab === "teams" ? "小组周报记录" : "部门周报历史"}</strong><span>·</span><span>{weekStart} 至 {weekEnd}</span></div>
        <div className="reports-toolbar__right">
          <Segmented value={tab} onChange={(v) => setTab(v as "sources" | "draft" | "history" | "teams")} options={[{ label: "来源确认", value: "sources" }, { label: "周报草稿", value: "draft" }, { label: "小组记录", value: "teams" }, { label: "部门历史", value: "history" }]} />
          {weekPicker}
          {tab === "sources" ? <Button type="primary" icon={<RobotOutlined />} loading={generateMutation.isPending} onClick={() => generateMutation.mutate()}>生成部门周报草稿</Button> : null}
        </div>
      </div>

      {tab === "sources" ? <DepartmentWeeklySources query={sourcesQuery} /> : tab === "teams" ? <TeamWeeklyHistory query={teamHistoryQuery} reports={teamHistory} /> : tab === "history" ? (
        historyQuery.isError ? <Alert type="error" showIcon message="部门周报历史加载失败" description={errorMessage(historyQuery.error)} /> : historyQuery.isLoading ? <ReportsSkeleton /> : history.length === 0 ? <ReportsEmpty description="暂无部门周报历史" /> : <WeeklyReportCards reports={history.map((r) => ({ id: r.id, title: "部门周报", date: r.week_start, content: r.content, done: Boolean(r.archived_at) }))} />
      ) : reportQuery.isError ? <Alert type="error" showIcon message="部门周报加载失败" description={errorMessage(reportQuery.error)} /> : reportQuery.isLoading ? <ReportsSkeleton /> : !report ? <ReportsEmpty description="尚未生成部门周报草稿，请先确认小组周报来源。" /> : (
        <section className="reports-team-card">
          <header className="reports-team-card__head">
            <span className="reports-team-card__title">部门周报</span>
            <span className="reports-team-card__meta">
              <span className={`reports-tag ${report.archived_at ? "is-submitted" : "is-team"}`}>{report.archived_at ? "已归档" : "草稿"}</span>
              <span>{report.week_start}</span>
              {!editing ? <Button size="small" onClick={() => { setEditing(true); setContent(report.content); }}>编辑</Button> : null}
              {!editing && !report.archived_at ? <Button size="small" type="primary" loading={archiveMutation.isPending} onClick={() => archiveMutation.mutate(report.id)}>归档</Button> : null}
            </span>
          </header>
          {editing ? <div className="reports-edit-shell"><TextArea rows={12} value={content} onChange={(e) => setContent(e.target.value)} /><div className="reports-edit-shell__actions"><Button onClick={() => setEditing(false)}>取消</Button><Button type="primary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate(report.id)}>保存</Button></div></div> : <p className="reports-team-card__body">{report.content}</p>}
        </section>
      )}
    </PagePanel>
  );
}

function DepartmentWeeklySources({ query }: { query: UseQueryResult<DepartmentWeeklyReportSources> }) {
  const sources = query.data;
  if (query.isError) return <Alert type="error" showIcon message="部门周报来源加载失败" description={errorMessage(query.error)} />;
  if (query.isLoading) return <ReportsSkeleton />;
  if (!sources) return <ReportsEmpty description="暂无来源" />;
  return (
    <div className="reports-member-grid">
      {sources.submitted_team_reports.map((item) => (
        <article key={item.team_id} className="reports-report-card is-auto">
          <header className="reports-report-card__head"><span className="reports-report-card__head-left"><span className="reports-report-card__author">{item.team_name}</span><span className="reports-tag is-submitted">已提交</span></span></header>
          <p className="reports-report-card__content">{item.content}</p>
        </article>
      ))}
      {sources.missing_teams.map((item) => (
        <article key={item.team_id} className="reports-report-card is-missing">
          <header className="reports-report-card__head"><span className="reports-report-card__head-left"><span className="reports-report-card__author">{item.team_name}</span><span className="reports-tag is-missing">未提交</span></span></header>
          <span className="reports-report-card__empty">该小组尚未提交本周周报。</span>
        </article>
      ))}
    </div>
  );
}

function WeeklyReportCards({ reports }: { reports: Array<{ id: string; title: string; date: string; content: string; done: boolean }> }) {
  return (
    <div className="reports-day-grid">
      {reports.map((report) => (
        <article key={report.id} className="reports-report-card is-auto">
          <header className="reports-report-card__head">
            <span className="reports-report-card__head-left"><span className="reports-report-card__author">{report.title}</span><span className={`reports-tag ${report.done ? "is-submitted" : "is-team"}`}>{report.done ? "已提交/归档" : "草稿"}</span></span>
            <span className="reports-report-card__date">{report.date}</span>
          </header>
          <p className="reports-report-card__content">{report.content}</p>
        </article>
      ))}
    </div>
  );
}
