import { RobotOutlined } from "@ant-design/icons";
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
  Table,
  Tabs,
  Tag,
  Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";

import { useAuth } from "@/shared/auth/authContext";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

import {
  fetchDepartmentReport,
  fetchDepartmentReports,
  fetchDepartmentReportSources,
  fetchMyReports,
  fetchReport,
  fetchTeamReport,
  fetchTeamReports,
  fetchTeamReportSources,
  submitTeamReport,
  updateDepartmentReport,
  updateReport,
  updateTeamReport
} from "../../api/client";
import { DailyReportGenerateModal, type DailyGenerateScope } from "../components/DailyReportGenerateModal";
import type {
  DailyReportListItem,
  DepartmentMissingTeam,
  DepartmentReportListItem,
  DepartmentReportSources,
  DepartmentTeamReportSource,
  TeamReportListItem,
  TeamMemberReport,
  TeamReportSources
} from "../../api/types";

import "./ReportsPage.css";

const { TextArea } = Input;
const { Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;
const pageSizeOptions = [10, 20, 50, 100];

type DailyTab = "personal" | "team" | "department";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请稍后重试";
}

function formatDateTime(value?: string) {
  return value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-";
}

function formatDate(value?: string) {
  return value ? dayjs(value).format("YYYY-MM-DD") : "-";
}

function personalStatus(record: DailyReportListItem, role?: string) {
  if (role === "director" || role === "admin") {
    return record.status === "saved" || record.status === "submitted" ? <Tag color="blue">已保存</Tag> : <Tag>待生成</Tag>;
  }
  if (record.status === "submitted") return <Tag color="green">已发送</Tag>;
  if (record.status === "saved" && record.submitted_at) return <Tag color="gold">已保存，未发送最新修改</Tag>;
  if (record.status === "saved") return <Tag color="blue">已保存</Tag>;
  return <Tag>待生成</Tag>;
}

function teamStatus(submittedAt?: string) {
  return submittedAt ? <Tag color="green">已提交总监</Tag> : <Tag color="orange">草稿</Tag>;
}

function departmentStatus(archivedAt?: string) {
  return archivedAt ? <Tag color="green">已归档</Tag> : <Tag color="orange">草稿</Tag>;
}

function useTablePagination() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  return {
    page,
    pageSize,
    tablePagination: (total: number) => ({
      current: page,
      pageSize,
      total,
      showSizeChanger: true,
      pageSizeOptions,
      onChange: (next: number, size: number) => {
        setPage(next);
        if (size && size !== pageSize) setPageSize(size);
      }
    })
  };
}

export function DailyReportsPage() {
  return <ReportsPage />;
}

export function ReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DailyTab>("personal");
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [generateTarget, setGenerateTarget] = useState<{ scope: DailyGenerateScope; reportId?: string; reportDate?: string } | null>(null);

  const options =
    user?.role === "director" || user?.role === "admin"
      ? [
          { label: "我的日报记录", value: "personal" },
          { label: "部门日报记录", value: "department" }
        ]
      : user?.role === "team_leader"
        ? [
            { label: "我的日报记录", value: "personal" },
            { label: "小组日报记录", value: "team" }
          ]
        : [{ label: "我的日报记录", value: "personal" }];

  const activeTab = options.some((item) => item.value === tab) ? tab : "personal";
  const from = dateRange?.[0].format("YYYY-MM-DD");
  const to = dateRange?.[1].format("YYYY-MM-DD");
  const generateLabel =
    activeTab === "team" ? "生成今日小组日报" : activeTab === "department" ? "生成今日部门日报" : "生成今日日报";

  if (!user) return null;

  return (
    <PagePanel
      title="日报"
      description="按记录列表查看日报，个人日报通过生成弹窗处理，汇总日报正文与来源进入详情页处理。"
      breadcrumbs={[{ title: "报告" }, { title: "日报" }]}
      className="reports-page aidashboard-list"
      showNav={false}
    >
      <Card>
        <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
          <Space wrap>
            {options.length > 1 ? (
              <Segmented value={activeTab} onChange={(value) => setTab(value as DailyTab)} options={options} />
            ) : null}
            <RangePicker value={dateRange} onChange={(value) => setDateRange(value as [Dayjs, Dayjs] | null)} />
          </Space>
          <Button type="primary" icon={<RobotOutlined />} onClick={() => setGenerateTarget({ scope: activeTab })}>
            {generateLabel}
          </Button>
        </Space>
      </Card>
      {activeTab === "personal" ? (
        <PersonalDailyTable
          from={from}
          to={to}
          onEdit={(record) => setGenerateTarget({ scope: "personal", reportId: record.id, reportDate: record.report_date })}
        />
      ) : null}
      {activeTab === "team" ? <TeamDailyTable from={from} to={to} onGenerate={(reportDate) => setGenerateTarget({ scope: "team", reportDate })} /> : null}
      {activeTab === "department" ? <DepartmentDailyTable from={from} to={to} onGenerate={(reportDate) => setGenerateTarget({ scope: "department", reportDate })} /> : null}
      {generateTarget ? (
        <DailyReportGenerateModal
          open
          scope={generateTarget.scope}
          reportId={generateTarget.reportId}
          reportDate={generateTarget.reportDate}
          onClose={() => setGenerateTarget(null)}
          onDone={() => {
            void queryClient.invalidateQueries({ queryKey: ["reports", "daily"] });
          }}
        />
      ) : null}
    </PagePanel>
  );
}

function PersonalDailyTable({
  from,
  to,
  onEdit
}: {
  from?: string;
  to?: string;
  onEdit: (record: DailyReportListItem) => void;
}) {
  const { user } = useAuth();
  const { page, pageSize, tablePagination } = useTablePagination();

  const reportsQuery = useQuery({
    queryKey: ["reports", "daily", "personal-list", { from, to, page, pageSize }],
    queryFn: () =>
      fetchMyReports({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        page: String(page),
        page_size: String(pageSize)
      }),
    staleTime: 30_000
  });

  const columns: ColumnsType<DailyReportListItem> = [
    { title: "日期", dataIndex: "report_date", width: 140, render: formatDate },
    { title: "状态", key: "status", width: 180, render: (_, record) => personalStatus(record, user?.role) },
    { title: "来源 session 数", dataIndex: "source_session_count", width: 150 },
    { title: "更新时间", dataIndex: "updated_at", render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 160,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => onEdit(record)}>
            查看
          </Button>
          <Button size="small" type="link" onClick={() => onEdit(record)}>
            编辑
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card
      title="我的日报记录"
    >
      {reportsQuery.isError ? (
        <Alert type="error" showIcon message="我的日报加载失败" description={errorMessage(reportsQuery.error)} />
      ) : (
        <Table<DailyReportListItem>
          rowKey="id"
          columns={columns}
          dataSource={reportsQuery.data?.items ?? []}
          loading={reportsQuery.isLoading}
          pagination={tablePagination(reportsQuery.data?.total ?? 0)}
        />
      )}
    </Card>
  );
}

function TeamDailyTable({
  from,
  to,
  readonly,
  onGenerate
}: {
  from?: string;
  to?: string;
  readonly?: boolean;
  onGenerate: (reportDate?: string) => void;
}) {
  const navigate = useNavigate();
  const { page, pageSize, tablePagination } = useTablePagination();

  const reportsQuery = useQuery({
    queryKey: ["reports", "daily", "team-list", { from, to, page, pageSize }],
    queryFn: () =>
      fetchTeamReports({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        page: String(page),
        page_size: String(pageSize)
      }),
    staleTime: 30_000
  });

  const columns: ColumnsType<TeamReportListItem> = [
    { title: "日期", dataIndex: "report_date", width: 130, render: formatDate },
    { title: "成员数", dataIndex: "member_count", width: 100 },
    { title: "已提交人数", dataIndex: "submitted_count", width: 120 },
    { title: "未提交人数", dataIndex: "missing_count", width: 120 },
    { title: "小组日报状态", dataIndex: "submitted_at", width: 140, render: teamStatus },
    { title: "提交给总监时间", dataIndex: "submitted_at", render: formatDateTime },
    { title: "更新时间", dataIndex: "updated_at", render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/reports/daily/team/${record.id}`)}>
            查看
          </Button>
          {!readonly ? (
            <Button size="small" type="link" onClick={() => onGenerate(formatDate(record.report_date))}>
              生成
            </Button>
          ) : null}
          {!readonly && !record.submitted_at ? (
            <Button size="small" type="link" onClick={() => navigate(`/reports/daily/team/${record.id}`)}>
              编辑
            </Button>
          ) : null}
        </Space>
      )
    }
  ];
  return (
    <Card
      title="小组日报记录"
    >
      {reportsQuery.isError ? (
        <Alert type="error" showIcon message="小组日报加载失败" description={errorMessage(reportsQuery.error)} />
      ) : (
        <Table<TeamReportListItem>
          rowKey="id"
          columns={columns}
          dataSource={reportsQuery.data?.items ?? []}
          loading={reportsQuery.isLoading}
          pagination={tablePagination(reportsQuery.data?.total ?? 0)}
        />
      )}
    </Card>
  );
}

function DepartmentDailyTable({
  from,
  to,
  onGenerate
}: {
  from?: string;
  to?: string;
  onGenerate: (reportDate?: string) => void;
}) {
  const navigate = useNavigate();
  const { page, pageSize, tablePagination } = useTablePagination();

  const reportsQuery = useQuery({
    queryKey: ["reports", "daily", "department-list", { from, to, page, pageSize }],
    queryFn: () =>
      fetchDepartmentReports({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        page: String(page),
        page_size: String(pageSize)
      }),
    staleTime: 30_000
  });

  const columns: ColumnsType<DepartmentReportListItem> = [
    { title: "日期", dataIndex: "report_date", width: 140, render: formatDate },
    { title: "小组总数", dataIndex: "team_count", width: 120 },
    { title: "已提交小组数", dataIndex: "submitted_team_count", width: 140 },
    { title: "未提交小组数", dataIndex: "missing_team_count", width: 140 },
    { title: "状态", dataIndex: "archived_at", width: 120, render: departmentStatus },
    { title: "归档时间", dataIndex: "archived_at", render: formatDateTime },
    { title: "更新时间", dataIndex: "updated_at", render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 160,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => navigate(`/reports/daily/department/${record.id}`)}>
            查看
          </Button>
          <Button size="small" type="link" onClick={() => onGenerate(formatDate(record.report_date))}>
            生成
          </Button>
          {!record.archived_at ? (
            <Button size="small" type="link" onClick={() => navigate(`/reports/daily/department/${record.id}`)}>
              编辑
            </Button>
          ) : null}
        </Space>
      )
    }
  ];

  return (
    <Card
      title="部门日报记录"
    >
      {reportsQuery.isError ? (
        <Alert type="error" showIcon message="部门日报加载失败" description={errorMessage(reportsQuery.error)} />
      ) : (
        <Table<DepartmentReportListItem>
          rowKey="id"
          columns={columns}
          dataSource={reportsQuery.data?.items ?? []}
          loading={reportsQuery.isLoading}
          pagination={tablePagination(reportsQuery.data?.total ?? 0)}
        />
      )}
    </Card>
  );
}

export function PersonalDailyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [draft, setDraft] = useState<{ reportId?: string; content: string }>({ content: "" });

  const reportQuery = useQuery({
    queryKey: ["reports", "daily", "personal-detail", id],
    queryFn: () => fetchReport(id ?? ""),
    enabled: Boolean(id),
    staleTime: 30_000
  });
  const report = reportQuery.data;
  const content = draft.reportId === report?.id ? draft.content : (report?.content ?? "");

  const saveMutation = useMutation({
    mutationFn: () => updateReport(id ?? "", { content }),
    onSuccess: () => {
      message.success("已保存");
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily"] });
    },
    onError: (error: unknown) => message.error(errorMessage(error))
  });

  return (
    <PagePanel title="个人日报详情" breadcrumbs={[{ title: "报告" }, { title: "日报" }, { title: "个人日报详情" }]} showNav={false}>
      {reportQuery.isError ? (
        <Alert type="error" showIcon message="个人日报加载失败" description={errorMessage(reportQuery.error)} />
      ) : !report ? (
        <Card loading={reportQuery.isLoading} />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Card>
            <Space size="large" wrap>
              <Text>日期：{report.report_date}</Text>
              <Text>状态：{report.edited ? "已编辑" : "自动生成"}</Text>
              <Text>更新时间：{formatDateTime(report.updated_at)}</Text>
              <Text>来源 session 数：{report.session_ids.length}</Text>
            </Space>
          </Card>
          <Card title="来源 session / 工作记录">
            {report.session_ids.length === 0 ? (
              <Empty description="暂无来源 session" />
            ) : (
              <Space wrap>
                {report.session_ids.map((sessionId) => (
                  <Tag key={sessionId}>{sessionId}</Tag>
                ))}
              </Space>
            )}
          </Card>
          <Card
            title="日报正文"
            extra={
              <Button type="primary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                保存
              </Button>
            }
          >
            <TextArea
              rows={14}
              value={content}
              onChange={(event) => setDraft({ reportId: report.id, content: event.target.value })}
            />
          </Card>
        </Space>
      )}
    </PagePanel>
  );
}

export function TeamDailyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [draft, setDraft] = useState<{ reportId?: string; content: string }>({ content: "" });
  const [generateOpen, setGenerateOpen] = useState(false);

  const reportQuery = useQuery({
    queryKey: ["reports", "daily", "team-detail", id],
    queryFn: () => fetchTeamReport(id ?? ""),
    enabled: Boolean(id),
    staleTime: 30_000
  });
  const report = reportQuery.data;
  const content = draft.reportId === report?.id ? draft.content : (report?.content ?? "");

  const sourcesQuery = useQuery<TeamReportSources>({
    queryKey: ["reports", "daily", "team-sources", report?.report_date, report?.team_id],
    queryFn: () => fetchTeamReportSources(report?.report_date ?? "", report?.team_id),
    enabled: Boolean(report?.report_date),
    staleTime: 30_000
  });

  const canEdit = user?.role === "team_leader" && !report?.submitted_at;
  const saveMutation = useMutation({
    mutationFn: () => updateTeamReport(id ?? "", { content }),
    onSuccess: () => {
      message.success("已保存");
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "team-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "team-list"] });
    },
    onError: (error: unknown) => message.error(errorMessage(error))
  });
  const submitMutation = useMutation({
    mutationFn: () => submitTeamReport(id ?? ""),
    onSuccess: () => {
      message.success("已提交给总监");
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "team-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "team-list"] });
    },
    onError: (error: unknown) => message.error(errorMessage(error))
  });

  return (
    <PagePanel title="小组日报详情" breadcrumbs={[{ title: "报告" }, { title: "日报" }, { title: "小组日报详情" }]} showNav={false}>
      {reportQuery.isError ? (
        <Alert type="error" showIcon message="小组日报加载失败" description={errorMessage(reportQuery.error)} />
      ) : !report ? (
        <Card loading={reportQuery.isLoading} />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Card>
            <Space size="large" wrap>
              <Text>日期：{report.report_date}</Text>
              <Text>小组：{report.team_name}</Text>
              <Text>成员提交：{sourcesQuery.data ? `${sourcesQuery.data.submitted}/${sourcesQuery.data.members.length}` : "-"}</Text>
              <Text>状态：{report.submitted_at ? "已提交总监" : "草稿"}</Text>
              <Text>提交时间：{formatDateTime(report.submitted_at)}</Text>
            </Space>
          </Card>
          <Tabs
            items={[
              {
                key: "sources",
                label: "原始成员日报",
                children: sourcesQuery.isError ? (
                  <Alert type="error" showIcon message="成员日报来源加载失败" description={errorMessage(sourcesQuery.error)} />
                ) : sourcesQuery.isLoading ? (
                  <Card loading />
                ) : (
                  <TeamSources sources={sourcesQuery.data} />
                )
              },
              {
                key: "report",
                label: "小组日报",
                children: (
                  <Card
                    extra={
                      <Space>
                        {canEdit ? (
                          <Button onClick={() => setGenerateOpen(true)}>
                            生成草稿
                          </Button>
                        ) : null}
                        {canEdit ? (
                          <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                            保存
                          </Button>
                        ) : null}
                        {canEdit ? (
                          <Button type="primary" loading={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                            提交给总监
                          </Button>
                        ) : null}
                      </Space>
                    }
                  >
                    {canEdit ? (
                      <TextArea
                        rows={14}
                        value={content}
                        onChange={(event) => setDraft({ reportId: report.id, content: event.target.value })}
                      />
                    ) : (
                      <Paragraph>{report.content}</Paragraph>
                    )}
                  </Card>
                )
              }
            ]}
          />
          {generateOpen ? (
            <DailyReportGenerateModal
              open
              scope="team"
              reportDate={report.report_date}
              onClose={() => setGenerateOpen(false)}
              onDone={() => {
                void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "team-detail", id] });
                void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "team-sources"] });
                void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "team-list"] });
              }}
            />
          ) : null}
        </Space>
      )}
    </PagePanel>
  );
}

function TeamSources({ sources }: { sources?: TeamReportSources }) {
  if (!sources) return <Empty description="暂无来源" />;
  const columns: ColumnsType<TeamMemberReport> = [
    { title: "成员", dataIndex: "user_name", width: 180 },
    {
      title: "提交状态",
      dataIndex: "has_report",
      width: 140,
      render: (hasReport: boolean) => (hasReport ? <Tag color="green">已提交</Tag> : <Tag>未提交</Tag>)
    },
    { title: "提交 / 更新时间", dataIndex: "submitted_at", render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, record) => (record.has_report ? <Text type="secondary">展开查看原文</Text> : "-")
    }
  ];
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card>
        <Space size="large" wrap>
          <Text>成员数：{sources.members.length}</Text>
          <Text>已提交：{sources.submitted}</Text>
          <Text>未提交：{sources.missing}</Text>
        </Space>
      </Card>
      <Table<TeamMemberReport>
        rowKey="user_id"
        columns={columns}
        dataSource={sources.members}
        pagination={false}
        expandable={{
          rowExpandable: (record) => record.has_report,
          expandedRowRender: (record) => <pre className="reports-source-content">{record.content || "暂无日报原文"}</pre>
        }}
      />
    </Space>
  );
}

export function DepartmentDailyReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [draft, setDraft] = useState<{ reportId?: string; content: string }>({ content: "" });
  const [generateOpen, setGenerateOpen] = useState(false);

  const reportQuery = useQuery({
    queryKey: ["reports", "daily", "department-detail", id],
    queryFn: () => fetchDepartmentReport(id ?? ""),
    enabled: Boolean(id),
    staleTime: 30_000
  });
  const report = reportQuery.data;
  const content = draft.reportId === report?.id ? draft.content : (report?.content ?? "");

  const sourcesQuery = useQuery<DepartmentReportSources>({
    queryKey: ["reports", "daily", "department-sources", report?.report_date],
    queryFn: () => fetchDepartmentReportSources(report?.report_date ?? ""),
    enabled: Boolean(report?.report_date),
    staleTime: 30_000
  });

  const saveMutation = useMutation({
    mutationFn: () => updateDepartmentReport(id ?? "", { content }),
    onSuccess: () => {
      message.success("已保存");
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "department-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "department-list"] });
    },
    onError: (error: unknown) => message.error(errorMessage(error))
  });
  const archiveMutation = useMutation({
    mutationFn: () => updateDepartmentReport(id ?? "", { content, archive: true }),
    onSuccess: () => {
      message.success("已归档");
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "department-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "department-list"] });
    },
    onError: (error: unknown) => message.error(errorMessage(error))
  });

  return (
    <PagePanel title="部门日报详情" breadcrumbs={[{ title: "报告" }, { title: "日报" }, { title: "部门日报详情" }]} showNav={false}>
      {reportQuery.isError ? (
        <Alert type="error" showIcon message="部门日报加载失败" description={errorMessage(reportQuery.error)} />
      ) : !report ? (
        <Card loading={reportQuery.isLoading} />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Card>
            <Space size="large" wrap>
              <Text>日期：{report.report_date}</Text>
              <Text>
                小组提交：
                {sourcesQuery.data
                  ? `${sourcesQuery.data.submitted_team_count}/${sourcesQuery.data.total_team_count}`
                  : "-"}
              </Text>
              <Text>状态：{report.archived_at ? "已归档" : "草稿"}</Text>
              <Text>归档时间：{formatDateTime(report.archived_at)}</Text>
              <Text>来源小组日报数：{report.source_team_report_ids.length}</Text>
            </Space>
          </Card>
          <Tabs
            items={[
              {
                key: "sources",
                label: "原始小组日报",
                children: sourcesQuery.isError ? (
                  <Alert type="error" showIcon message="小组日报来源加载失败" description={errorMessage(sourcesQuery.error)} />
                ) : sourcesQuery.isLoading ? (
                  <Card loading />
                ) : (
                  <DepartmentSources sources={sourcesQuery.data} />
                )
              },
              {
                key: "report",
                label: "部门日报",
                children: (
                  <Card
                    extra={
                      <Space>
                        {!report.archived_at ? (
                          <Button onClick={() => setGenerateOpen(true)}>
                            生成草稿
                          </Button>
                        ) : null}
                        <Button loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                          保存
                        </Button>
                        {!report.archived_at ? (
                          <Button type="primary" loading={archiveMutation.isPending} onClick={() => archiveMutation.mutate()}>
                            归档
                          </Button>
                        ) : null}
                      </Space>
                    }
                  >
                    <TextArea
                      rows={14}
                      value={content}
                      onChange={(event) => setDraft({ reportId: report.id, content: event.target.value })}
                    />
                  </Card>
                )
              }
            ]}
          />
          {generateOpen ? (
            <DailyReportGenerateModal
              open
              scope="department"
              reportDate={report.report_date}
              onClose={() => setGenerateOpen(false)}
              onDone={() => {
                void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "department-detail", id] });
                void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "department-sources"] });
                void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "department-list"] });
              }}
            />
          ) : null}
        </Space>
      )}
    </PagePanel>
  );
}

function DepartmentSources({ sources }: { sources?: DepartmentReportSources }) {
  if (!sources) return <Empty description="暂无来源" />;
  type DepartmentSourceRow = DepartmentTeamReportSource | (DepartmentMissingTeam & { has_report: false });
  const rows: DepartmentSourceRow[] = [
    ...sources.submitted_team_reports,
    ...sources.missing_teams.map((team) => ({ ...team, has_report: false as const }))
  ];
  const columns: ColumnsType<DepartmentSourceRow> = [
    { title: "小组", dataIndex: "team_name", width: 180 },
    {
      title: "TL",
      key: "leader",
      width: 160,
      render: (_, record) => ("team_leader_name" in record ? record.team_leader_name || record.leader_name : "-")
    },
    {
      title: "提交状态",
      dataIndex: "has_report",
      width: 140,
      render: (hasReport: boolean) => (hasReport ? <Tag color="green">已提交</Tag> : <Tag>未提交</Tag>)
    },
    { title: "提交时间", dataIndex: "submitted_at", render: formatDateTime },
    {
      title: "操作",
      key: "actions",
      width: 140,
      render: (_, record) => (record.has_report ? <Text type="secondary">展开查看原文</Text> : "-")
    }
  ];
  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Card>
        <Space size="large" wrap>
          <Text>小组总数：{sources.total_team_count}</Text>
          <Text>已提交：{sources.submitted_team_count}</Text>
          <Text>未提交：{sources.missing_teams.length}</Text>
        </Space>
      </Card>
      <Table<DepartmentSourceRow>
        rowKey="team_id"
        columns={columns}
        dataSource={rows}
        pagination={false}
        expandable={{
          rowExpandable: (record) => record.has_report,
          expandedRowRender: (record) => (
            <pre className="reports-source-content">{"content" in record ? record.content || "暂无小组日报原文" : ""}</pre>
          )
        }}
      />
    </Space>
  );
}
