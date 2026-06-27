import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Drawer,
  Empty,
  Input,
  Modal,
  Segmented,
  Skeleton,
  Space,
  Steps,
  Table,
  Tag
} from "antd";
import type { ColumnsType } from "antd/es/table";
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
  saveDepartmentWeeklyReportCurrent,
  savePersonalWeeklyReport,
  saveTeamWeeklyReport,
  submitPersonalWeeklyReport,
  submitTeamWeeklyReportCurrent
} from "../../api/client";
import type {
  DepartmentTeamWeeklyReportSource,
  DepartmentWeeklyReport,
  DepartmentWeeklyReportSources,
  PaginatedPersonalWeeklyReports,
  PersonalWeeklyReport,
  PersonalWeeklyReportListItem,
  PersonalWeeklyReportPreview,
  PersonalWeeklyReportSources,
  TeamWeeklyReport,
  TeamWeeklyReportPreview,
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

function formatDailySourceTitle(reportDate: string) {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const value = dayjs(reportDate);
  return `${value.format("MM-DD")} ${weekdays[value.day()]}日报`;
}

function summarizeSourceContent(content: string) {
  const text = content
    .replace(/[#>*_`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text || "暂无摘要";
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

function formatDateTime(value?: string) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";
}

function formatWeekDate(value: string) {
  return dayjs(value).format("YYYY-MM-DD");
}

function weeklyRange(weekStart: string, weekEnd?: string) {
  const start = formatWeekDate(weekStart);
  return `${start} 至 ${weekEnd ? formatWeekDate(weekEnd) : weekEndOf(start)}`;
}

function personalWeeklyStatus(status: PersonalWeeklyReport["status"]) {
  return status === "submitted" ? <Tag color="green">已发送</Tag> : <Tag color="blue">已保存</Tag>;
}

function teamWeeklyStatus(report: TeamWeeklyReport) {
  return report.submitted_at ? <Tag color="green">已提交</Tag> : <Tag color="blue">已保存</Tag>;
}

function departmentWeeklyStatus(report: DepartmentWeeklyReport) {
  return report.archived_at ? <Tag color="green">已归档</Tag> : <Tag color="blue">已保存</Tag>;
}

export function PersonalWeeklyReportsView({
  weekStart,
  weekEnd,
  weekPicker,
  scopeTabs,
  modalMode = false,
  onDone
}: {
  weekStart: string;
  weekEnd: string;
  weekPicker: ReactNode;
  scopeTabs?: ReactNode;
  modalMode?: boolean;
  onDone?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState<"sources" | "draft" | "history">("sources");
  const [step, setStep] = useState<"sources" | "draft">("sources");
  const [tabTouched, setTabTouched] = useState(false);
  const [preview, setPreview] = useState<PersonalWeeklyReportPreview | null>(null);
  const [content, setContent] = useState("");
  const [contentTouched, setContentTouched] = useState(false);
  const [selectedDailyReportIds, setSelectedDailyReportIds] = useState<string[]>([]);
  const [dailySelectionTouched, setDailySelectionTouched] = useState(false);
  const showHistory = !modalMode;

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
    staleTime: 30_000,
    enabled: showHistory
  });

  const report = reportQuery.data ?? null;
  const defaultDailyReportIds =
    sourcesQuery.data?.daily_reports.map((item) => item.report_id) ?? [];
  const effectiveDailyReportIds = dailySelectionTouched
    ? selectedDailyReportIds
    : defaultDailyReportIds;

  const effectiveTab = modalMode
    ? step
    : !showHistory && tab === "history"
      ? "sources"
      : !tabTouched && report && !preview
        ? "draft"
        : tab;
  const editorContent = contentTouched
    ? content
    : (preview?.report_markdown ?? report?.content ?? "");
  const collectedDailyCount = sourcesQuery.data?.daily_count ?? 0;
  const displayWeekStart = formatWeekDate(weekStart);
  const displayWeekEnd = formatWeekDate(weekEnd);
  const sourceIDs = preview
    ? {
        source_daily_report_ids: preview.source_daily_report_ids
      }
    : dailySelectionTouched || !report
      ? {
          source_daily_report_ids: effectiveDailyReportIds
        }
      : {
          source_daily_report_ids: report.source_daily_report_ids
        };
  const selectedSourceCount = sourceIDs.source_daily_report_ids.length;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["reports", "weekly", "mine"] });
  };

  const generateMutation = useMutation({
    mutationFn: () =>
      generatePersonalWeeklyReport({
        week_start: weekStart,
        source_daily_report_ids: effectiveDailyReportIds
      }),
    onSuccess: (draft) => {
      setPreview(draft);
      setContent(draft.report_markdown);
      setContentTouched(true);
      setStep("draft");
      setTab("draft");
      setTabTouched(true);
      message.success("个人周报预览已生成");
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });
  const saveMutation = useMutation({
    mutationFn: () =>
      savePersonalWeeklyReport({ week_start: weekStart, content: editorContent, ...sourceIDs }),
    onSuccess: (saved) => {
      setPreview(null);
      setContent(saved.content);
      setContentTouched(true);
      invalidate();
      onDone?.();
      message.success("周报已保存");
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });
  const submitMutation = useMutation({
    mutationFn: () =>
      submitPersonalWeeklyReport({ week_start: weekStart, content: editorContent, ...sourceIDs }),
    onSuccess: (saved) => {
      setPreview(null);
      setContent(saved.content);
      setContentTouched(true);
      invalidate();
      onDone?.();
      message.success(user?.role === "employee" ? "已发送给 TL" : "已发送给总监");
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  const canSubmit =
    user?.role === "employee" || user?.role === "pm" || user?.role === "team_leader";
  const submitLabel = user?.role === "employee" ? "保存并发送给 TL" : "保存并发送给总监";

  return (
    <PagePanel
      title="我的周报"
      description="先确认本周来源，再生成预览并保存或发送"
      breadcrumbs={[{ title: "报告" }, { title: "周报" }]}
      className="reports-page aidashboard-list"
      showNav={false}
    >
      {!modalMode ? (
        <RequirementMetricGrid>
          <RequirementMetricCard
            tone="primary"
            icon={<CalendarOutlined />}
            loading={sourcesQuery.isLoading}
            metric={{
              key: "week",
              title: "周报周期",
              value: dayjs(weekStart).format("MM-DD"),
              description: `${displayWeekStart} 至 ${displayWeekEnd}`
            }}
          />
          <RequirementMetricCard
            tone="success"
            icon={<FileTextOutlined />}
            loading={sourcesQuery.isLoading}
            metric={{
              key: "daily",
              title: "个人日报",
              value: collectedDailyCount,
              description: "本周已保存/发送日报"
            }}
          />
          <RequirementMetricCard
            tone="info"
            icon={<CheckCircleOutlined />}
            loading={sourcesQuery.isLoading}
            metric={{
              key: "selected-daily",
              title: "已选日报",
              value: effectiveDailyReportIds.length,
              description: "用于生成周报的日报"
            }}
          />
        </RequirementMetricGrid>
      ) : null}

      <div className="reports-toolbar">
        <div className="reports-toolbar__meta">
          <strong>
            {effectiveTab === "sources"
              ? "本周来源确认"
              : effectiveTab === "draft"
                ? "确认我的周报"
                : "我的周报历史"}
          </strong>
          <span>·</span>
          <span>
            {displayWeekStart} 至 {displayWeekEnd}
          </span>
        </div>
        <div className="reports-toolbar__right">
          {scopeTabs}
          {modalMode ? (
            <Steps
              size="small"
              current={effectiveTab === "sources" ? 0 : 1}
              items={[{ title: "来源确认" }, { title: "编辑周报" }]}
            />
          ) : (
            <Segmented
              value={effectiveTab}
              onChange={(v) => {
                setTab(v as "sources" | "draft" | "history");
                setTabTouched(true);
              }}
              options={[
                { label: "来源确认", value: "sources" },
                { label: "确认周报", value: "draft" },
                ...(showHistory ? [{ label: "历史", value: "history" }] : [])
              ]}
            />
          )}
          {weekPicker}
          {effectiveTab === "sources" ? (
            <>
              {modalMode ? <Button onClick={() => setStep("draft")}>手写周报</Button> : null}
              <Button
                type="primary"
                icon={<RobotOutlined />}
                loading={generateMutation.isPending}
                disabled={effectiveDailyReportIds.length === 0}
                onClick={() => generateMutation.mutate()}
              >
                生成周报草稿
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {effectiveTab === "sources" ? (
        <PersonalWeeklySources
          query={sourcesQuery}
          selectedDailyReportIds={effectiveDailyReportIds}
          onSelectedDailyReportIdsChange={(ids) => {
            setSelectedDailyReportIds(ids);
            setDailySelectionTouched(true);
          }}
        />
      ) : effectiveTab === "history" && showHistory ? (
        <PersonalWeeklyHistory query={historyQuery} />
      ) : reportQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="我的周报加载失败"
          description={errorMessage(reportQuery.error)}
        />
      ) : reportQuery.isLoading && !preview ? (
        <ReportsSkeleton />
      ) : !modalMode && !editorContent.trim() && !report && !preview ? (
        <ReportsEmpty description="尚未生成或保存本周周报，请先确认来源。" />
      ) : (
        <section className="reports-team-card">
          <header className="reports-team-card__head">
            <span className="reports-team-card__title">
              确认周报 · {displayWeekStart} 至 {displayWeekEnd}
            </span>
            <span className="reports-team-card__meta">
              <span
                className={`reports-tag ${report?.status === "submitted" ? "is-submitted" : "is-team"}`}
              >
                {preview
                  ? "预览未保存"
                  : report?.status === "submitted"
                    ? "已发送"
                    : report?.status === "saved"
                      ? "已保存"
                      : "预览"}
              </span>
              <span>{displayWeekStart}</span>
            </span>
          </header>
          <p className="reports-team-card__body reports-team-card__body--compact">
            基于 {selectedSourceCount} 篇日报生成，可编辑后保存或发送。
          </p>
          <div className="reports-edit-shell">
            <TextArea
              rows={14}
              className="reports-weekly-editor"
              value={editorContent}
              onChange={(e) => {
                setContent(e.target.value);
                setContentTouched(true);
              }}
            />
            <div className="reports-edit-shell__actions">
              <Button
                onClick={() => {
                  if (modalMode) {
                    setStep("sources");
                  } else {
                    setTab("sources");
                    setTabTouched(true);
                  }
                }}
              >
                上一步
              </Button>
              <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                保存周报
              </Button>
              {canSubmit ? (
                <Button
                  type="primary"
                  loading={submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitLabel}
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </PagePanel>
  );
}

export function PersonalWeeklyReportModal({
  open,
  weekStart,
  weekEnd,
  onClose,
  onDone
}: {
  open: boolean;
  weekStart: string;
  weekEnd: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  return (
    <Modal
      className="console-report-workflow-modal"
      title="我的周报"
      open={open}
      width={980}
      footer={null}
      onCancel={onClose}
      destroyOnHidden
    >
      <PersonalWeeklyReportsView
        key={`personal-weekly-modal-${weekStart}`}
        weekStart={weekStart}
        weekEnd={weekEnd}
        weekPicker={<span />}
        modalMode
        onDone={onDone}
      />
    </Modal>
  );
}

function PersonalWeeklySources({
  query,
  selectedDailyReportIds,
  onSelectedDailyReportIdsChange
}: {
  query: UseQueryResult<PersonalWeeklyReportSources>;
  selectedDailyReportIds: string[];
  onSelectedDailyReportIdsChange: (ids: string[]) => void;
}) {
  const sources = query.data;
  const [activeSource, setActiveSource] = useState<PersonalWeeklyReportSources["daily_reports"][number] | null>(
    null
  );
  if (query.isError)
    return (
      <Alert
        type="error"
        showIcon
        message="周报来源加载失败"
        description={errorMessage(query.error)}
      />
    );
  if (query.isLoading) return <ReportsSkeleton />;
  if (!sources) return <ReportsEmpty description="暂无来源" />;
  if (sources.daily_reports.length === 0)
    return <ReportsEmpty description="本周暂无可用于生成周报的日报" />;
  return (
    <>
      <Checkbox.Group
        className="reports-source-list"
        value={selectedDailyReportIds}
        onChange={(values) => onSelectedDailyReportIdsChange(values.map(String))}
      >
        {sources.daily_reports.map((item) => (
          <div key={item.report_id} className="reports-source-list__item">
            <div className="reports-source-list__main">
              <Checkbox value={item.report_id} />
              <div className="reports-source-list__content">
                <div className="reports-source-list__head">
                  <strong>{formatDailySourceTitle(item.report_date)}</strong>
                  <span className="reports-tag is-submitted">已发送</span>
                  <span className="reports-tag is-team">个人日报</span>
                  <Button
                    type="link"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setActiveSource(item);
                    }}
                  >
                    查看全文
                  </Button>
                </div>
                <p>{summarizeSourceContent(item.content)}</p>
              </div>
            </div>
          </div>
        ))}
      </Checkbox.Group>
      <Drawer
        title={activeSource ? `${formatDailySourceTitle(activeSource.report_date)}原文` : "日报原文"}
        open={Boolean(activeSource)}
        size={560}
        onClose={() => setActiveSource(null)}
      >
        <pre className="reports-source-content">{activeSource?.content}</pre>
      </Drawer>
    </>
  );
}

function PersonalWeeklyHistory({
  query
}: {
  query: UseQueryResult<PaginatedPersonalWeeklyReports>;
}) {
  const reports = query.data?.items ?? [];
  if (query.isError)
    return (
      <Alert
        type="error"
        showIcon
        message="我的周报历史加载失败"
        description={errorMessage(query.error)}
      />
    );
  if (query.isLoading) return <ReportsSkeleton />;
  if (reports.length === 0) return <ReportsEmpty description="暂无我的周报历史" />;
  return (
    <WeeklyReportCards
      reports={reports.map((r) => ({
        id: r.id,
        title: "我的周报",
        date: formatWeekDate(r.week_start),
        content: weeklyRange(r.week_start, r.week_end),
        done: r.status === "submitted"
      }))}
    />
  );
}

export function WeeklyReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => weekStartOf(dayjs()));
  const [roleTab, setRoleTab] = useState<"mine" | "team" | "department">("mine");
  const [modalTarget, setModalTarget] = useState<{
    scope: "mine" | "team" | "department";
    weekStart: string;
  } | null>(null);

  if (!user) return null;

  const tabOptions =
    user.role === "director" || user.role === "admin"
      ? [
          { label: "我的周报记录", value: "mine" },
          { label: "部门周报记录", value: "department" }
        ]
      : user.role === "team_leader" || user.role === "pm"
        ? [
            { label: "我的周报记录", value: "mine" },
            { label: "小组周报记录", value: "team" }
          ]
        : [{ label: "我的周报记录", value: "mine" }];
  const activeTab = tabOptions.some((item) => item.value === roleTab) ? roleTab : "mine";
  const generateLabel =
    activeTab === "team"
      ? "生成本周小组周报"
      : activeTab === "department"
        ? "生成本周部门周报"
        : "生成本周周报";
  const invalidateWeekly = () => {
    void queryClient.invalidateQueries({ queryKey: ["reports", "weekly"] });
  };

  return (
    <PagePanel
      title="周报"
      description="按记录列表查看周报，当前周生成与编辑通过弹窗处理。"
      breadcrumbs={[{ title: "报告" }, { title: "周报" }]}
      className="reports-page aidashboard-list"
      showNav={false}
    >
      <Card className="reports-control-card">
        <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
          <Space wrap>
            {tabOptions.length > 1 ? (
              <Segmented
                value={activeTab}
                onChange={(value) => setRoleTab(value as "mine" | "team" | "department")}
                options={tabOptions}
              />
            ) : null}
            <DatePicker
              value={dayjs(weekStart)}
              allowClear={false}
              onChange={(value) => value && setWeekStart(weekStartOf(value))}
            />
          </Space>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={() => setModalTarget({ scope: activeTab, weekStart })}
          >
            {generateLabel}
          </Button>
        </Space>
      </Card>

      {activeTab === "mine" ? (
        <PersonalWeeklyRecordsTable
          onOpen={(recordWeekStart) => setModalTarget({ scope: "mine", weekStart: recordWeekStart })}
        />
      ) : null}
      {activeTab === "team" ? (
        <TeamWeeklyRecordsTable
          onOpen={(recordWeekStart) => setModalTarget({ scope: "team", weekStart: recordWeekStart })}
        />
      ) : null}
      {activeTab === "department" ? (
        <DepartmentWeeklyRecordsTable
          onOpen={(recordWeekStart) => setModalTarget({ scope: "department", weekStart: recordWeekStart })}
        />
      ) : null}

      {modalTarget?.scope === "mine" ? (
        <PersonalWeeklyReportModal
          open
          weekStart={modalTarget.weekStart}
          weekEnd={weekEndOf(modalTarget.weekStart)}
          onClose={() => setModalTarget(null)}
          onDone={invalidateWeekly}
        />
      ) : null}
      {modalTarget?.scope === "team" ? (
        <TeamWeeklyReportModal
          open
          weekStart={modalTarget.weekStart}
          weekEnd={weekEndOf(modalTarget.weekStart)}
          onClose={() => setModalTarget(null)}
          onDone={invalidateWeekly}
        />
      ) : null}
      {modalTarget?.scope === "department" ? (
        <DepartmentWeeklyReportModal
          open
          weekStart={modalTarget.weekStart}
          weekEnd={weekEndOf(modalTarget.weekStart)}
          onClose={() => setModalTarget(null)}
          onDone={invalidateWeekly}
        />
      ) : null}
    </PagePanel>
  );
}

function PersonalWeeklyRecordsTable({
  onOpen
}: {
  onOpen: (weekStart: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const reportsQuery = useQuery<PaginatedPersonalWeeklyReports>({
    queryKey: ["reports", "weekly", "mine", "history", { page, pageSize }],
    queryFn: () => fetchPersonalWeeklyReports({ page: String(page), page_size: String(pageSize) }),
    staleTime: 30_000
  });

  const columns: ColumnsType<PersonalWeeklyReportListItem> = [
    {
      title: "周期",
      dataIndex: "week_start",
      width: 220,
      render: (_, record) => weeklyRange(record.week_start, record.week_end)
    },
    { title: "状态", dataIndex: "status", width: 120, render: personalWeeklyStatus },
    { title: "来源日报", dataIndex: "source_daily_count", width: 120 },
    { title: "来源 session", dataIndex: "source_session_count", width: 130 },
    { title: "发送时间", dataIndex: "submitted_at", render: formatDateTime },
    { title: "更新时间", dataIndex: "updated_at", render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Button size="small" type="link" onClick={() => onOpen(formatWeekDate(record.week_start))}>
          打开
        </Button>
      )
    }
  ];

  return (
    <Card className="reports-list-card" title="我的周报记录">
      {reportsQuery.isError ? (
        <Alert type="error" showIcon message="我的周报记录加载失败" description={errorMessage(reportsQuery.error)} />
      ) : (
        <Table<PersonalWeeklyReportListItem>
          rowKey="id"
          columns={columns}
          dataSource={reportsQuery.data?.items ?? []}
          loading={reportsQuery.isLoading}
          pagination={{
            current: page,
            pageSize,
            total: reportsQuery.data?.total ?? 0,
            showSizeChanger: true,
            onChange: (next, size) => {
              setPage(size !== pageSize ? 1 : next);
              setPageSize(size);
            }
          }}
        />
      )}
    </Card>
  );
}

function TeamWeeklyRecordsTable({
  onOpen
}: {
  onOpen: (weekStart: string) => void;
}) {
  const reportsQuery = useQuery<TeamWeeklyReport[]>({
    queryKey: ["reports", "weekly", "team", "history"],
    queryFn: () => fetchTeamWeeklyReports(),
    staleTime: 30_000
  });
  const columns: ColumnsType<TeamWeeklyReport> = [
    { title: "小组", dataIndex: "team_name", width: 160 },
    {
      title: "周期",
      dataIndex: "week_start",
      width: 220,
      render: (_, record) => weeklyRange(record.week_start)
    },
    { title: "状态", key: "status", width: 120, render: (_, record) => teamWeeklyStatus(record) },
    {
      title: "来源个人周报",
      key: "source_personal_weekly_report_ids",
      width: 150,
      render: (_, record) => record.source_personal_weekly_report_ids.length
    },
    { title: "提交时间", dataIndex: "submitted_at", render: formatDateTime },
    { title: "更新时间", dataIndex: "updated_at", render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Button size="small" type="link" onClick={() => onOpen(formatWeekDate(record.week_start))}>
          打开
        </Button>
      )
    }
  ];

  return (
    <Card className="reports-list-card" title="小组周报记录">
      {reportsQuery.isError ? (
        <Alert type="error" showIcon message="小组周报记录加载失败" description={errorMessage(reportsQuery.error)} />
      ) : (
        <Table<TeamWeeklyReport>
          rowKey="id"
          columns={columns}
          dataSource={reportsQuery.data ?? []}
          loading={reportsQuery.isLoading}
        />
      )}
    </Card>
  );
}

function DepartmentWeeklyRecordsTable({
  onOpen
}: {
  onOpen: (weekStart: string) => void;
}) {
  const reportsQuery = useQuery<DepartmentWeeklyReport[]>({
    queryKey: ["reports", "weekly", "department", "history"],
    queryFn: () => fetchDepartmentWeeklyReports(),
    staleTime: 30_000
  });
  const columns: ColumnsType<DepartmentWeeklyReport> = [
    {
      title: "周期",
      dataIndex: "week_start",
      width: 220,
      render: (_, record) => weeklyRange(record.week_start)
    },
    { title: "状态", key: "status", width: 120, render: (_, record) => departmentWeeklyStatus(record) },
    {
      title: "来源小组周报",
      key: "source_team_weekly_report_ids",
      width: 150,
      render: (_, record) => record.source_team_weekly_report_ids.length
    },
    { title: "归档时间", dataIndex: "archived_at", render: formatDateTime },
    { title: "更新时间", dataIndex: "updated_at", render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Button size="small" type="link" onClick={() => onOpen(formatWeekDate(record.week_start))}>
          打开
        </Button>
      )
    }
  ];

  return (
    <Card className="reports-list-card" title="部门周报记录">
      {reportsQuery.isError ? (
        <Alert type="error" showIcon message="部门周报记录加载失败" description={errorMessage(reportsQuery.error)} />
      ) : (
        <Table<DepartmentWeeklyReport>
          rowKey="id"
          columns={columns}
          dataSource={reportsQuery.data ?? []}
          loading={reportsQuery.isLoading}
        />
      )}
    </Card>
  );
}

function TeamWeeklyReportsView({
  weekStart,
  weekEnd,
  weekPicker,
  canEdit = false,
  scopeTabs,
  modalMode = false,
  onDone
}: {
  weekStart: string;
  weekEnd: string;
  weekPicker: ReactNode;
  canEdit?: boolean;
  scopeTabs?: ReactNode;
  modalMode?: boolean;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState<"sources" | "draft" | "history">("sources");
  const [preview, setPreview] = useState<TeamWeeklyReportPreview | null>(null);
  const [content, setContent] = useState("");
  const [contentTouched, setContentTouched] = useState(false);
  const [selectedPersonalWeeklyReportIds, setSelectedPersonalWeeklyReportIds] = useState<string[]>(
    []
  );
  const [selectionTouched, setSelectionTouched] = useState(false);
  const showHistory = !modalMode;

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
    staleTime: 30_000,
    enabled: showHistory
  });

  const sources = sourcesQuery.data;
  const report = reportQuery.data ?? null;
  const history = historyQuery.data ?? [];
  const defaultPersonalWeeklyReportIds =
    sources?.submitted_personal_weekly_reports.map((item) => item.report_id) ?? [];
  const effectivePersonalWeeklyReportIds = selectionTouched
    ? selectedPersonalWeeklyReportIds
    : defaultPersonalWeeklyReportIds;
  const editorContent = contentTouched
    ? content
    : (preview?.report_markdown ?? report?.content ?? "");
  const sourceIDs = preview
    ? {
        source_personal_weekly_report_ids: preview.source_personal_weekly_report_ids
      }
    : selectionTouched || !report
      ? {
          source_personal_weekly_report_ids: effectivePersonalWeeklyReportIds
        }
      : {
          source_personal_weekly_report_ids: report.source_personal_weekly_report_ids
        };
  const submittedLocked = Boolean(report?.submitted_at && !preview);
  const effectiveTab = !showHistory && tab === "history" ? "sources" : tab;
  const displayWeekStart = formatWeekDate(weekStart);
  const displayWeekEnd = formatWeekDate(weekEnd);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["reports", "weekly", "team"] });
    void queryClient.invalidateQueries({ queryKey: ["reports", "weekly", "department"] });
  };

  const generateMutation = useMutation({
    mutationFn: () =>
      generateTeamWeeklyReport({
        week_start: weekStart,
        source_personal_weekly_report_ids: effectivePersonalWeeklyReportIds
      }),
    onSuccess: (draft) => {
      setPreview(draft);
      setContent(draft.report_markdown);
      setContentTouched(true);
      setTab("draft");
      message.success("小组周报预览已生成");
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "生成失败")
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveTeamWeeklyReport({ week_start: weekStart, content: editorContent, ...sourceIDs }),
    onSuccess: (saved) => {
      setPreview(null);
      setContent(saved.content);
      setContentTouched(true);
      message.success("已保存");
      invalidate();
      onDone?.();
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "保存失败")
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitTeamWeeklyReportCurrent({
        week_start: weekStart,
        content: editorContent,
        ...sourceIDs
      }),
    onSuccess: () => {
      message.success("已提交给总监");
      setPreview(null);
      invalidate();
      onDone?.();
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
      {!modalMode ? (
      <RequirementMetricGrid>
        <RequirementMetricCard
          tone="primary"
          icon={<CalendarOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{
            key: "week",
            title: "周报周期",
            value: dayjs(weekStart).format("MM-DD"),
            description: `${displayWeekStart} 至 ${displayWeekEnd}`
          }}
        />
        <RequirementMetricCard
          tone="success"
          icon={<FileTextOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{
            key: "personal-weekly",
            title: "已发送个人周报",
            value: sources?.submitted_personal_weekly_count ?? 0,
            description: "TL 本人和成员"
          }}
        />
        <RequirementMetricCard
          tone="info"
          icon={<TeamOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{
            key: "selected-personal-weekly",
            title: "已选个人周报",
            value: effectivePersonalWeeklyReportIds.length,
            description: "用于生成小组周报"
          }}
        />
        <RequirementMetricCard
          tone="warning"
          icon={<CloseCircleOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{
            key: "missing",
            title: "未发送人员",
            value: sources?.missing_people_count ?? 0,
            description: submittedLocked ? "已提交" : "待提交"
          }}
        />
      </RequirementMetricGrid>
      ) : null}

      <div className="reports-toolbar">
        <div className="reports-toolbar__meta">
          <strong>
            {effectiveTab === "sources" ? "本周来源确认" : effectiveTab === "draft" ? "小组周报草稿" : "小组周报历史"}
          </strong>
          <span>·</span>
          <span>
            {displayWeekStart} 至 {displayWeekEnd}
          </span>
        </div>
        <div className="reports-toolbar__right">
          {scopeTabs}
          <Segmented
            value={effectiveTab}
            onChange={(v) => setTab(v as "sources" | "draft" | "history")}
            options={[
              { label: "来源确认", value: "sources" },
              { label: "周报草稿", value: "draft" },
              ...(showHistory ? [{ label: "历史", value: "history" }] : [])
            ]}
          />
          {weekPicker}
          {canEdit && effectiveTab === "sources" ? (
            <Button
              type="primary"
              icon={<RobotOutlined />}
              loading={generateMutation.isPending}
              disabled={effectivePersonalWeeklyReportIds.length === 0}
              onClick={() => generateMutation.mutate()}
            >
              生成小组周报预览
            </Button>
          ) : null}
        </div>
      </div>

      {effectiveTab === "sources" ? (
        <TeamWeeklySources
          query={sourcesQuery}
          selectedPersonalWeeklyReportIds={effectivePersonalWeeklyReportIds}
          onSelectedPersonalWeeklyReportIdsChange={(ids) => {
            setSelectedPersonalWeeklyReportIds(ids);
            setSelectionTouched(true);
          }}
        />
      ) : effectiveTab === "history" && showHistory ? (
        <TeamWeeklyHistory query={historyQuery} reports={history} />
      ) : reportQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="小组周报加载失败"
          description={errorMessage(reportQuery.error)}
        />
      ) : reportQuery.isLoading && !preview ? (
        <ReportsSkeleton />
      ) : !editorContent.trim() && !report && !preview ? (
        <ReportsEmpty description="尚未生成小组周报草稿，请先确认来源。" />
      ) : (
        <section className="reports-team-card">
          <header className="reports-team-card__head">
            <span className="reports-team-card__title">
              {report?.team_name ?? sources?.team_name ?? "小组周报"}
            </span>
            <span className="reports-team-card__meta">
              <span className={`reports-tag ${submittedLocked ? "is-submitted" : "is-team"}`}>
                {submittedLocked ? "已提交总监" : preview ? "预览" : "草稿"}
              </span>
              <span>{formatWeekDate(preview?.week_start ?? report?.week_start ?? weekStart)}</span>
              {canEdit ? (
                <Button
                  size="small"
                  onClick={() => {
                    setTab("sources");
                  }}
                >
                  上一步
                </Button>
              ) : null}
              {canEdit && !submittedLocked ? (
                <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  保存
                </Button>
              ) : null}
              {canEdit && !submittedLocked ? (
                <Button
                  size="small"
                  type="primary"
                  loading={submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  提交给总监
                </Button>
              ) : null}
            </span>
          </header>
          {canEdit && !submittedLocked ? (
            <div className="reports-edit-shell">
              <TextArea
                rows={12}
                value={editorContent}
                onChange={(e) => {
                  setContent(e.target.value);
                  setContentTouched(true);
                }}
              />
            </div>
          ) : (
            <p className="reports-team-card__body">{editorContent}</p>
          )}
        </section>
      )}
    </PagePanel>
  );
}

function TeamWeeklySources({
  query,
  selectedPersonalWeeklyReportIds,
  onSelectedPersonalWeeklyReportIdsChange
}: {
  query: UseQueryResult<TeamWeeklyReportSources>;
  selectedPersonalWeeklyReportIds: string[];
  onSelectedPersonalWeeklyReportIdsChange: (ids: string[]) => void;
}) {
  const sources = query.data;
  if (query.isError)
    return (
      <Alert
        type="error"
        showIcon
        message="周报来源加载失败"
        description={errorMessage(query.error)}
      />
    );
  if (query.isLoading) return <ReportsSkeleton />;
  if (!sources) return <ReportsEmpty description="暂无来源" />;
  if (sources.submitted_personal_weekly_reports.length === 0 && sources.missing_people.length === 0)
    return <ReportsEmpty description="暂无小组人员" />;
  return (
    <>
      {sources.submitted_personal_weekly_reports.length === 0 ? (
        <ReportsEmpty description="暂无已发送个人周报，无法生成小组周报" />
      ) : (
        <Checkbox.Group
          className="reports-member-grid"
          value={selectedPersonalWeeklyReportIds}
          onChange={(values) => onSelectedPersonalWeeklyReportIdsChange(values.map(String))}
        >
          {sources.submitted_personal_weekly_reports.map((item) => (
            <label key={item.report_id} className="reports-report-card is-auto">
              <header className="reports-report-card__head">
                <span className="reports-report-card__head-left">
                  <Checkbox value={item.report_id} />
                  <span className="reports-report-card__author">{item.user_name}</span>
                  <span className="reports-tag is-team">
                    {item.source_role === "leader" ? "TL 本人" : "成员"}
                  </span>
                </span>
                <span className="reports-report-card__date">{formatWeekDate(item.week_start)}</span>
              </header>
              <p className="reports-report-card__content">{item.submitted_content}</p>
            </label>
          ))}
        </Checkbox.Group>
      )}
      {sources.missing_people.length > 0 ? (
        <section className="reports-team-card">
          <header className="reports-team-card__head">
            <span className="reports-team-card__title">未发送人员</span>
            <span className="reports-team-card__meta">不参与生成</span>
          </header>
          <div className="reports-member-grid">
            {sources.missing_people.map((item) => (
              <article key={item.user_id} className="reports-report-card is-missing">
                <header className="reports-report-card__head">
                  <span className="reports-report-card__head-left">
                    <span className="reports-report-card__author">{item.user_name}</span>
                    <span className="reports-tag is-missing">
                      {item.source_role === "leader" ? "TL 本人" : "成员"}
                    </span>
                  </span>
                </header>
                <span className="reports-report-card__empty">本周尚未发送个人周报。</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export function TeamWeeklyReportModal({
  open,
  weekStart,
  weekEnd,
  onClose,
  onDone
}: {
  open: boolean;
  weekStart: string;
  weekEnd: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  return (
    <Modal
      className="console-report-workflow-modal"
      title="小组周报"
      open={open}
      width={980}
      footer={null}
      onCancel={onClose}
      destroyOnHidden
    >
      <TeamWeeklyReportsView
        key={`team-weekly-modal-${weekStart}`}
        weekStart={weekStart}
        weekEnd={weekEnd}
        weekPicker={<span />}
        canEdit
        modalMode
        onDone={onDone}
      />
    </Modal>
  );
}

function TeamWeeklyHistory({
  query,
  reports
}: {
  query: UseQueryResult<TeamWeeklyReport[]>;
  reports: TeamWeeklyReport[];
}) {
  if (query.isError)
    return (
      <Alert
        type="error"
        showIcon
        message="小组周报历史加载失败"
        description={errorMessage(query.error)}
      />
    );
  if (query.isLoading) return <ReportsSkeleton />;
  if (reports.length === 0) return <ReportsEmpty description="暂无小组周报历史" />;
  return (
    <WeeklyReportCards
      reports={reports.map((r) => ({
        id: r.id,
        title: r.team_name,
        date: formatWeekDate(r.week_start),
        content: r.content,
        done: Boolean(r.submitted_at)
      }))}
    />
  );
}

function DirectorWeeklyReportsView({
  weekStart,
  weekEnd,
  weekPicker,
  scopeTabs,
  modalMode = false,
  onDone
}: {
  weekStart: string;
  weekEnd: string;
  weekPicker: React.ReactNode;
  scopeTabs?: ReactNode;
  modalMode?: boolean;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState<"sources" | "draft" | "history" | "teams">("sources");
  const [step, setStep] = useState<"sources" | "draft">("sources");
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");
  const [contentTouched, setContentTouched] = useState(false);

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
    staleTime: 30_000,
    enabled: !modalMode
  });
  const teamHistoryQuery = useQuery<TeamWeeklyReport[]>({
    queryKey: ["reports", "weekly", "team", "history", "director"],
    queryFn: () => fetchTeamWeeklyReports(),
    staleTime: 30_000,
    enabled: !modalMode
  });

  const sources = sourcesQuery.data;
  const report = reportQuery.data ?? null;
  const history = historyQuery.data ?? [];
  const teamHistory = teamHistoryQuery.data ?? [];
  const showHistory = !modalMode;
  const effectiveTab = modalMode
    ? step
    : !showHistory && (tab === "history" || tab === "teams") ? "sources" : tab;
  const editorContent = contentTouched ? content : (report?.content ?? "");
  const submitted = sources?.submitted_team_count ?? 0;
  const total = sources?.total_team_count ?? 0;
  const missing = sources?.missing_teams.length ?? 0;
  const displayWeekStart = formatWeekDate(weekStart);
  const displayWeekEnd = formatWeekDate(weekEnd);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["reports", "weekly"] });
  const generateMutation = useMutation({
    mutationFn: () => generateDepartmentWeeklyReport(weekStart),
    onSuccess: (draft) => {
      message.success("部门周报草稿已生成");
      setContent(draft.content);
      setContentTouched(true);
      invalidate();
      setStep("draft");
      setTab("draft");
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "生成失败")
  });
  const saveMutation = useMutation({
    mutationFn: () =>
      saveDepartmentWeeklyReportCurrent({ week_start: weekStart, content: editorContent }),
    onSuccess: () => {
      message.success("已保存");
      setEditing(false);
      setContentTouched(false);
      invalidate();
      onDone?.();
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "保存失败")
  });
  const archiveMutation = useMutation({
    mutationFn: () =>
      saveDepartmentWeeklyReportCurrent({
        week_start: weekStart,
        content: editorContent,
        archive: true
      }),
    onSuccess: () => {
      message.success("部门周报已归档");
      setEditing(false);
      setContentTouched(false);
      invalidate();
      onDone?.();
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "归档失败")
  });

  return (
    <PagePanel
      title="部门周报"
      description="基于已提交小组周报生成部门周报"
      breadcrumbs={[{ title: "报告" }, { title: "周报" }]}
      className="reports-page aidashboard-list"
      showNav={false}
    >
      {!modalMode ? (
      <RequirementMetricGrid>
        <RequirementMetricCard
          tone="primary"
          icon={<CalendarOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{
            key: "week",
            title: "周报周期",
            value: dayjs(weekStart).format("MM-DD"),
              description: `${displayWeekStart} 至 ${displayWeekEnd}`
          }}
        />
        <RequirementMetricCard
          tone="success"
          icon={<CheckCircleOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{
            key: "submitted",
            title: "已提交小组",
            value: submitted,
            description: total > 0 ? `提交率 ${Math.round((submitted * 100) / total)}%` : "暂无小组"
          }}
        />
        <RequirementMetricCard
          tone="warning"
          icon={<CloseCircleOutlined />}
          loading={sourcesQuery.isLoading}
          metric={{
            key: "missing",
            title: "未提交小组",
            value: missing,
            description: missing > 0 ? "等待 TL 提交" : "小组周报到齐"
          }}
        />
        <RequirementMetricCard
          tone="info"
          icon={<RobotOutlined />}
          loading={reportQuery.isLoading}
          metric={{
            key: "archive",
            title: "归档状态",
            value: report?.archived_at ? 1 : 0,
            description: report?.archived_at ? "已归档" : "待生成或待归档"
          }}
        />
      </RequirementMetricGrid>
      ) : null}

      <div className="reports-toolbar">
        <div className="reports-toolbar__meta">
          <strong>
            {effectiveTab === "sources"
              ? "小组周报收集"
              : effectiveTab === "draft"
                ? "部门周报草稿"
                : effectiveTab === "teams"
                  ? "小组周报记录"
                  : "部门周报历史"}
          </strong>
          <span>·</span>
          <span>
            {displayWeekStart} 至 {displayWeekEnd}
          </span>
        </div>
        <div className="reports-toolbar__right">
          {scopeTabs}
          {modalMode ? (
            <Steps
              size="small"
              current={effectiveTab === "sources" ? 0 : 1}
              items={[{ title: "来源确认" }, { title: "编辑周报" }]}
            />
          ) : (
            <Segmented
              value={effectiveTab}
              onChange={(v) => setTab(v as "sources" | "draft" | "history" | "teams")}
              options={[
                { label: "来源确认", value: "sources" },
                { label: "周报草稿", value: "draft" },
                ...(showHistory
                  ? [
                      { label: "小组记录", value: "teams" },
                      { label: "部门历史", value: "history" }
                    ]
                  : [])
              ]}
            />
          )}
          {weekPicker}
          {effectiveTab === "sources" ? (
            <>
              {modalMode ? <Button onClick={() => setStep("draft")}>手写周报</Button> : null}
              <Button
                type="primary"
                icon={<RobotOutlined />}
                loading={generateMutation.isPending}
                onClick={() => generateMutation.mutate()}
              >
                生成部门周报草稿
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {effectiveTab === "sources" ? (
        <DepartmentWeeklySources query={sourcesQuery} />
      ) : effectiveTab === "teams" && showHistory ? (
        <TeamWeeklyHistory query={teamHistoryQuery} reports={teamHistory} />
      ) : effectiveTab === "history" && showHistory ? (
        historyQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="部门周报历史加载失败"
            description={errorMessage(historyQuery.error)}
          />
        ) : historyQuery.isLoading ? (
          <ReportsSkeleton />
        ) : history.length === 0 ? (
          <ReportsEmpty description="暂无部门周报历史" />
        ) : (
          <WeeklyReportCards
            reports={history.map((r) => ({
              id: r.id,
              title: "部门周报",
              date: formatWeekDate(r.week_start),
              content: r.content,
              done: Boolean(r.archived_at)
            }))}
          />
        )
      ) : reportQuery.isError ? (
        <Alert
          type="error"
          showIcon
          message="部门周报加载失败"
          description={errorMessage(reportQuery.error)}
        />
      ) : reportQuery.isLoading ? (
        <ReportsSkeleton />
      ) : !modalMode && !report ? (
        <ReportsEmpty description="尚未生成部门周报草稿，请先确认小组周报来源。" />
      ) : (
        <section className="reports-team-card">
          <header className="reports-team-card__head">
            <span className="reports-team-card__title">部门周报</span>
            <span className="reports-team-card__meta">
              <span className={`reports-tag ${report?.archived_at ? "is-submitted" : "is-team"}`}>
                {report?.archived_at ? "已归档" : report ? "草稿" : "未保存"}
              </span>
              <span>{formatWeekDate(report?.week_start ?? weekStart)}</span>
              {!modalMode && !editing ? (
                <Button
                  size="small"
                  onClick={() => {
                    setEditing(true);
                    setContent(editorContent);
                    setContentTouched(true);
                  }}
                >
                  编辑
                </Button>
              ) : null}
              {!modalMode && !editing && !report?.archived_at ? (
                <Button
                  size="small"
                  type="primary"
                  loading={archiveMutation.isPending}
                  onClick={() => archiveMutation.mutate()}
                >
                  归档
                </Button>
              ) : null}
            </span>
          </header>
          {modalMode || editing || !report ? (
            <div className="reports-edit-shell">
              <TextArea
                rows={12}
                className="reports-weekly-editor"
                value={editorContent}
                onChange={(e) => {
                  setContent(e.target.value);
                  setContentTouched(true);
                }}
              />
              <div className="reports-edit-shell__actions">
                <Button
                  onClick={() => {
                    if (modalMode) {
                      setStep("sources");
                    } else {
                      setEditing(false);
                    }
                  }}
                >
                  {modalMode ? "上一步" : "取消"}
                </Button>
                <Button
                  loading={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  保存周报
                </Button>
                <Button
                  type="primary"
                  loading={archiveMutation.isPending}
                  onClick={() => archiveMutation.mutate()}
                >
                  归档部门周报
                </Button>
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

function DepartmentWeeklySources({
  query
}: {
  query: UseQueryResult<DepartmentWeeklyReportSources>;
}) {
  const sources = query.data;
  const [activeSource, setActiveSource] = useState<DepartmentTeamWeeklyReportSource | null>(null);
  if (query.isError)
    return (
      <Alert
        type="error"
        showIcon
        message="部门周报来源加载失败"
        description={errorMessage(query.error)}
      />
    );
  if (query.isLoading) return <ReportsSkeleton />;
  if (!sources) return <ReportsEmpty description="暂无来源" />;
  return (
    <>
      <div className="reports-source-list">
        {sources.submitted_team_reports.map((item) => (
          <div key={item.team_id} className="reports-source-list__item">
            <div className="reports-source-list__main reports-source-list__main--readonly">
              <div className="reports-source-list__content">
                <div className="reports-source-list__head">
                  <strong>{item.team_name}</strong>
                  <span className="reports-tag is-submitted">已提交</span>
                  <span className="reports-tag is-team">小组周报</span>
                  <span className="reports-source-list__meta">
                    {item.leader_name ? `负责人 ${item.leader_name}` : "小组来源"}
                  </span>
                  <Button
                    type="link"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setActiveSource(item);
                    }}
                  >
                    查看全文
                  </Button>
                </div>
                <p>{summarizeSourceContent(item.content)}</p>
              </div>
            </div>
          </div>
        ))}
        {sources.missing_teams.map((item) => (
          <div key={item.team_id} className="reports-source-list__item is-muted">
            <div className="reports-source-list__main reports-source-list__main--readonly">
              <div className="reports-source-list__content">
                <div className="reports-source-list__head">
                  <strong>{item.team_name}</strong>
                  <span className="reports-tag is-missing">未提交</span>
                  <span className="reports-tag is-team">小组周报</span>
                </div>
                <p>该小组尚未提交本周周报，不参与本次部门周报生成。</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Drawer
        title={activeSource ? `${activeSource.team_name} 小组周报原文` : "小组周报原文"}
        open={Boolean(activeSource)}
        size={560}
        onClose={() => setActiveSource(null)}
      >
        <pre className="reports-source-content">{activeSource?.content}</pre>
      </Drawer>
    </>
  );
}

export function DepartmentWeeklyReportModal({
  open,
  weekStart,
  weekEnd,
  onClose,
  onDone
}: {
  open: boolean;
  weekStart: string;
  weekEnd: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  return (
    <Modal
      className="console-report-workflow-modal"
      title="部门周报"
      open={open}
      width={980}
      footer={null}
      onCancel={onClose}
      destroyOnHidden
    >
      <DirectorWeeklyReportsView
        key={`department-weekly-modal-${weekStart}`}
        weekStart={weekStart}
        weekEnd={weekEnd}
        weekPicker={<span />}
        modalMode
        onDone={onDone}
      />
    </Modal>
  );
}

function WeeklyReportCards({
  reports
}: {
  reports: Array<{ id: string; title: string; date: string; content: string; done: boolean }>;
}) {
  return (
    <div className="reports-day-grid">
      {reports.map((report) => (
        <article key={report.id} className="reports-report-card is-auto">
          <header className="reports-report-card__head">
            <span className="reports-report-card__head-left">
              <span className="reports-report-card__author">{report.title}</span>
              <span className={`reports-tag ${report.done ? "is-submitted" : "is-team"}`}>
                {report.done ? "已提交/归档" : "草稿"}
              </span>
            </span>
            <span className="reports-report-card__date">{report.date}</span>
          </header>
          <p className="reports-report-card__content">{report.content}</p>
        </article>
      ))}
    </div>
  );
}
