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
  fetchPersonalWeeklyReportCurrentOrNull,
  fetchPersonalWeeklyReports,
  fetchPersonalWeeklyReportSources,
  fetchTeamWeeklyReportCurrentOrNull,
  fetchTeamWeeklyReports,
  fetchTeamWeeklyReportSources,
  generateDepartmentWeeklyReport,
  generatePersonalWeeklyReport,
  generateTeamWeeklyReport,
  savePersonalWeeklyReport,
  submitPersonalWeeklyReport,
  submitTeamWeeklyReport,
  updateDepartmentWeeklyReport,
  updateTeamWeeklyReport
} from "../../api/client";
import type {
  DepartmentWeeklyReport,
  DepartmentWeeklyReportSources,
  PaginatedPersonalWeeklyReports,
  PersonalWeeklyReport,
  PersonalWeeklyReportPreview,
  PersonalWeeklyReportSources,
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

function sourceIdsFromSources(sources?: PersonalWeeklyReportSources | null) {
  return {
    source_session_ids: sources?.sessions.map((item) => item.session_id) ?? [],
    source_daily_report_ids: sources?.daily_reports.map((item) => item.report_id) ?? [],
    source_task_ids: sources?.tasks.map((item) => item.task_id) ?? []
  };
}

export function PersonalWeeklyReportsView({
  weekStart,
  weekEnd,
  weekPicker,
  scopeTabs
}: {
  weekStart: string;
  weekEnd: string;
  weekPicker: ReactNode;
  scopeTabs?: ReactNode;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState<"sources" | "draft" | "history">("sources");
  const [tabTouched, setTabTouched] = useState(false);
  const [preview, setPreview] = useState<PersonalWeeklyReportPreview | null>(null);
  const [content, setContent] = useState("");
  const [contentTouched, setContentTouched] = useState(false);

  const sourcesQuery = useQuery<PersonalWeeklyReportSources>({
    queryKey: ["reports", "weekly", "mine", "sources", weekStart],
    queryFn: () => fetchPersonalWeeklyReportSources(weekStart),
    staleTime: 30_000
  });
  const reportQuery = useQuery<PersonalWeeklyReport | null>({
    queryKey: ["reports", "weekly", "mine", "current", weekStart],
    queryFn: () => fetchPersonalWeeklyReportCurrentOrNull(weekStart),
    staleTime: 30_000
  });
  const historyQuery = useQuery<PaginatedPersonalWeeklyReports>({
    queryKey: ["reports", "weekly", "mine", "history"],
    queryFn: () => fetchPersonalWeeklyReports({ page: "1", page_size: "20" }),
    staleTime: 30_000
  });

  const report = reportQuery.data ?? null;
  const effectiveTab = !tabTouched && report && !preview ? "draft" : tab;
  const editorContent = contentTouched ? content : preview?.report_markdown ?? report?.content ?? "";
  const sourceIDs = preview
    ? {
        source_session_ids: preview.source_session_ids,
        source_daily_report_ids: preview.source_daily_report_ids,
        source_task_ids: preview.source_task_ids
      }
    : report
      ? {
          source_session_ids: report.source_session_ids,
          source_daily_report_ids: report.source_daily_report_ids,
          source_task_ids: report.source_task_ids
        }
      : sourceIdsFromSources(sourcesQuery.data);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["reports", "weekly", "mine"] });
  };

  const generateMutation = useMutation({
    mutationFn: () => generatePersonalWeeklyReport({ week_start: weekStart, ...sourceIdsFromSources(sourcesQuery.data) }),
    onSuccess: (draft) => {
      setPreview(draft);
      setContent(draft.report_markdown);
      setContentTouched(true);
      setTab("draft");
      setTabTouched(true);
      message.success("个人周报预览已生成");
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });
  const saveMutation = useMutation({
    mutationFn: () => savePersonalWeeklyReport({ week_start: weekStart, content: editorContent, ...sourceIDs }),
    onSuccess: (saved) => {
      setPreview(null);
      setContent(saved.content);
      setContentTouched(true);
      invalidate();
      message.success("周报已保存");
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });
  const submitMutation = useMutation({
    mutationFn: () => submitPersonalWeeklyReport({ week_start: weekStart, content: editorContent, ...sourceIDs }),
    onSuccess: (saved) => {
      setPreview(null);
      setContent(saved.content);
      setContentTouched(true);
      invalidate();
      message.success(user?.role === "employee" ? "已发送给 TL" : "已发送给总监");
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  const canSubmit = user?.role === "employee" || user?.role === "pm" || user?.role === "team_leader";
  const submitLabel = user?.role === "employee" ? "保存并发送给 TL" : "保存并发送给总监";

  return (
    <PagePanel
      title="我的周报"
      description="先确认本周来源，再生成预览并保存或发送"
      breadcrumbs={[{ title: "报告" }, { title: "周报" }]}
      className="reports-page aidashboard-list"
      showNav={false}
    >
      <RequirementMetricGrid>
        <RequirementMetricCard tone="primary" icon={<CalendarOutlined />} loading={sourcesQuery.isLoading} metric={{ key: "week", title: "周报周期", value: dayjs(weekStart).format("MM-DD"), description: `${weekStart} 至 ${weekEnd}` }} />
        <RequirementMetricCard tone="success" icon={<FileTextOutlined />} loading={sourcesQuery.isLoading} metric={{ key: "daily", title: "个人日报", value: sourcesQuery.data?.daily_count ?? 0, description: "本周已保存/发送日报" }} />
        <RequirementMetricCard tone="info" icon={<RobotOutlined />} loading={sourcesQuery.isLoading} metric={{ key: "sessions", title: "Session", value: sourcesQuery.data?.session_count ?? 0, description: "本周 AI 工作记录" }} />
        <RequirementMetricCard tone="warning" icon={<CheckCircleOutlined />} loading={sourcesQuery.isLoading} metric={{ key: "tasks", title: "任务/风险", value: sourcesQuery.data?.task_count ?? 0, description: report?.status === "submitted" ? "已发送" : report?.status === "saved" ? "已保存" : "待生成" }} />
      </RequirementMetricGrid>

      <div className="reports-toolbar">
        <div className="reports-toolbar__meta">
          <strong>{effectiveTab === "sources" ? "本周来源确认" : effectiveTab === "draft" ? "确认我的周报" : "我的周报历史"}</strong>
          <span>·</span>
          <span>{weekStart} 至 {weekEnd}</span>
        </div>
        <div className="reports-toolbar__right">
          {scopeTabs}
          <Segmented
            value={effectiveTab}
            onChange={(v) => {
              setTab(v as "sources" | "draft" | "history");
              setTabTouched(true);
            }}
            options={[{ label: "来源确认", value: "sources" }, { label: "确认周报", value: "draft" }, { label: "历史", value: "history" }]}
          />
          {weekPicker}
          {effectiveTab === "sources" ? <Button type="primary" icon={<RobotOutlined />} loading={generateMutation.isPending} onClick={() => generateMutation.mutate()}>生成周报预览</Button> : null}
        </div>
      </div>

      {effectiveTab === "sources" ? (
        <PersonalWeeklySources query={sourcesQuery} />
      ) : effectiveTab === "history" ? (
        <PersonalWeeklyHistory query={historyQuery} />
      ) : reportQuery.isError ? (
        <Alert type="error" showIcon message="我的周报加载失败" description={errorMessage(reportQuery.error)} />
      ) : reportQuery.isLoading && !preview ? (
        <ReportsSkeleton />
      ) : !editorContent.trim() && !report && !preview ? (
        <ReportsEmpty description="尚未生成或保存本周周报，请先确认来源。" />
      ) : (
        <section className="reports-team-card">
          <header className="reports-team-card__head">
            <span className="reports-team-card__title">我的周报</span>
            <span className="reports-team-card__meta">
              <span className={`reports-tag ${report?.status === "submitted" ? "is-submitted" : "is-team"}`}>{preview ? "预览未保存" : report?.status === "submitted" ? "已发送" : report?.status === "saved" ? "已保存" : "预览"}</span>
              <span>{weekStart}</span>
            </span>
          </header>
          <div className="reports-edit-shell">
            <TextArea rows={14} value={editorContent} onChange={(e) => { setContent(e.target.value); setContentTouched(true); }} />
            <div className="reports-edit-shell__actions">
              <Button onClick={() => { setTab("sources"); setTabTouched(true); }}>上一步</Button>
              <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>保存周报</Button>
              {canSubmit ? <Button type="primary" loading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>{submitLabel}</Button> : null}
            </div>
          </div>
        </section>
      )}
    </PagePanel>
  );
}

function PersonalWeeklySources({ query }: { query: UseQueryResult<PersonalWeeklyReportSources> }) {
  const sources = query.data;
  if (query.isError) return <Alert type="error" showIcon message="周报来源加载失败" description={errorMessage(query.error)} />;
  if (query.isLoading) return <ReportsSkeleton />;
  if (!sources) return <ReportsEmpty description="暂无来源" />;
  const items = [
    ...sources.sessions.map((item) => ({
      key: `session-${item.session_id}`,
      title: `${item.session_ref} · ${dayjs(item.started_at).format("MM-DD HH:mm")}`,
      tag: "Session",
      content: item.summary || item.task_title || "暂无摘要"
    })),
    ...sources.daily_reports.map((item) => ({
      key: `daily-${item.report_id}`,
      title: `${item.user_name} · ${item.report_date}`,
      tag: "个人日报",
      content: item.content
    })),
    ...sources.tasks.map((item) => ({
      key: `task-${item.task_id}`,
      title: item.task_title,
      tag: `${item.status}/${item.priority}`,
      content: `需求：${item.requirement_title}\n负责人：${item.assignee_name || "未分配"}`
    }))
  ];
  if (items.length === 0) return <ReportsEmpty description="本周暂无可用于生成周报的来源" />;
  return (
    <div className="reports-member-grid">
      {items.map((item) => (
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

function PersonalWeeklyHistory({ query }: { query: UseQueryResult<PaginatedPersonalWeeklyReports> }) {
  const reports = query.data?.items ?? [];
  if (query.isError) return <Alert type="error" showIcon message="我的周报历史加载失败" description={errorMessage(query.error)} />;
  if (query.isLoading) return <ReportsSkeleton />;
  if (reports.length === 0) return <ReportsEmpty description="暂无我的周报历史" />;
  return <WeeklyReportCards reports={reports.map((r) => ({ id: r.id, title: "我的周报", date: r.week_start, content: `${r.week_start} 至 ${r.week_end}`, done: r.status === "submitted" }))} />;
}

export function WeeklyReportsPage() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(dayjs()));
  const [roleTab, setRoleTab] = useState<"mine" | "team" | "department">("mine");

  if (!user) return null;

  const weekEnd = weekEndOf(weekStart);
  const picker = (
    <DatePicker
      value={dayjs(weekStart)}
      allowClear={false}
      onChange={(value) => value && setWeekStart(weekStartOf(value))}
    />
  );

  if (user.role === "team_leader") {
    return roleTab === "team" ? (
      <TeamWeeklyReportsView
        key={`team-${weekStart}`}
        weekStart={weekStart}
        weekEnd={weekEnd}
        weekPicker={picker}
        canEdit
        scopeTabs={<Segmented value={roleTab} onChange={(v) => setRoleTab(v as "mine" | "team")} options={[{ label: "我的周报", value: "mine" }, { label: "小组周报", value: "team" }]} />}
      />
    ) : (
      <PersonalWeeklyReportsView
        key={`mine-${weekStart}`}
        weekStart={weekStart}
        weekEnd={weekEnd}
        weekPicker={picker}
        scopeTabs={<Segmented value={roleTab} onChange={(v) => setRoleTab(v as "mine" | "team")} options={[{ label: "我的周报", value: "mine" }, { label: "小组周报", value: "team" }]} />}
      />
    );
  }
  if (user.role === "director" || user.role === "admin") {
    return roleTab === "department" ? (
      <DirectorWeeklyReportsView
        key={`department-${weekStart}`}
        weekStart={weekStart}
        weekEnd={weekEnd}
        weekPicker={picker}
        scopeTabs={<Segmented value={roleTab} onChange={(v) => setRoleTab(v as "mine" | "department")} options={[{ label: "我的周报", value: "mine" }, { label: "部门周报", value: "department" }]} />}
      />
    ) : (
      <PersonalWeeklyReportsView
        key={`mine-${weekStart}`}
        weekStart={weekStart}
        weekEnd={weekEnd}
        weekPicker={picker}
        scopeTabs={<Segmented value={roleTab} onChange={(v) => setRoleTab(v as "mine" | "department")} options={[{ label: "我的周报", value: "mine" }, { label: "部门周报", value: "department" }]} />}
      />
    );
  }

  return <PersonalWeeklyReportsView key={`mine-${weekStart}`} weekStart={weekStart} weekEnd={weekEnd} weekPicker={picker} />;
}

function TeamWeeklyReportsView({
  weekStart,
  weekEnd,
  weekPicker,
  canEdit = false,
  scopeTabs
}: {
  weekStart: string;
  weekEnd: string;
  weekPicker: ReactNode;
  canEdit?: boolean;
  scopeTabs?: ReactNode;
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
          {scopeTabs}
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

function DirectorWeeklyReportsView({
  weekStart,
  weekEnd,
  weekPicker,
  scopeTabs
}: {
  weekStart: string;
  weekEnd: string;
  weekPicker: React.ReactNode;
  scopeTabs?: ReactNode;
}) {
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
          {scopeTabs}
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
