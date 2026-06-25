import { FileDoneOutlined, UploadOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Checkbox, Empty, Input, Modal, Select, Space, Steps, Tag, Upload } from "antd";
import { useState } from "react";
import dayjs from "dayjs";

import { useAuth } from "@/shared/auth/authContext";
import { formatDateTime } from "@/shared/utils/dateTime";

import {
  fetchDepartmentReportSources,
  fetchMyReports,
  fetchReport,
  fetchSessions,
  fetchTeamReportSources,
  fetchTodayReport,
  generateDepartmentReport,
  generateTeamReport,
  generateTodayReportDraft,
  saveReport,
  submitReport,
  submitTeamReport,
  updateDepartmentReport,
  updateTeamReport
} from "../../api/client";
import type {
  DailyReport,
  DepartmentReportSources,
  DepartmentReport,
  GenerateReportDraftPayload,
  Session,
  TeamReport,
  TeamReportSources
} from "../../api/types";

import "./DailyReportGenerateModal.css";

const { TextArea } = Input;

export type DailyGenerateScope = "personal" | "team" | "department";

interface DailyReportGenerateModalProps {
  open: boolean;
  scope: DailyGenerateScope;
  reportId?: string;
  reportDate?: string;
  title?: string;
  onClose: () => void;
  onDone?: (result: DailyReport | TeamReport | DepartmentReport, scope: DailyGenerateScope) => void;
}

type Step = "sessions" | "source" | "editor";

interface SessionOption {
  tool: string;
  timeRange: string;
  summary: string;
  value: string;
}

type ReportSkillOption = { label: string; value: string; source?: "system" | "upload"; content?: string };

const REPORT_SKILL_OPTIONS: ReportSkillOption[] = [
  { label: "默认日报 Skill", value: "default_daily", source: "system" }
];

function normalizedDate(value?: string) {
  return value ? dayjs(value).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请稍后重试";
}

function getAgentLabel(agentType: string) {
  if (agentType === "codex") return "Codex session";
  if (agentType === "claude_code") return "Claude Code session";
  return `${agentType || "AI"} session`;
}

function toSessionOption(session: Session): SessionOption {
  const started = formatDateTime(session.started_at, "HH:mm");
  const ended = session.ended_at ? formatDateTime(session.ended_at, "HH:mm") : "";
  return {
    tool: getAgentLabel(session.agent_type),
    timeRange: ended && ended !== "-" ? `${started} - ${ended}` : started,
    summary: session.summary || session.task_title || session.session_ref,
    value: session.id
  };
}

function scopeName(scope: DailyGenerateScope) {
  if (scope === "team") return "小组日报";
  if (scope === "department") return "部门日报";
  return "我的日报";
}

function modalWidth(scope: DailyGenerateScope, step: Step) {
  if (step === "editor") return 860;
  if (scope === "team") return 840;
  return 720;
}

function sourceSteps(scope: DailyGenerateScope) {
  if (scope === "personal") {
    return [{ title: "选择来源" }, { title: "确认日报" }];
  }
  return [{ title: "确认来源" }, { title: "生成草稿" }, { title: scope === "team" ? "提交给总监" : "保存归档" }];
}

function getUploadedSkillName(fileName: string, content: string) {
  const frontmatterName = content.match(/^\s*name:\s*["']?(.+?)["']?\s*$/m)?.[1]?.trim();
  const baseName = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  const rawName = frontmatterName || baseName || "上传 Skill";

  return /skill/i.test(rawName) || rawName.includes("Skill") ? rawName : `${rawName} Skill`;
}

export function DailyReportGenerateModal({
  open,
  scope,
  reportId,
  reportDate,
  title,
  onClose,
  onDone
}: DailyReportGenerateModalProps) {
  const { user } = useAuth();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const date = normalizedDate(reportDate);
  const initialStep: Step = scope === "personal" ? "sessions" : "source";
  const [step, setStep] = useState<Step | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [draftTouched, setDraftTouched] = useState(false);
  const [personalDraftSessionIds, setPersonalDraftSessionIds] = useState<string[]>([]);
  const [teamDraft, setTeamDraft] = useState<TeamReport | null>(null);
  const [departmentDraft, setDepartmentDraft] = useState<DepartmentReport | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState(REPORT_SKILL_OPTIONS[0].value);
  const [uploadedSkills, setUploadedSkills] = useState<ReportSkillOption[]>([]);
  const [expandedTeamReportUserId, setExpandedTeamReportUserId] = useState<string | null>(null);
  const [expandedDepartmentReportId, setExpandedDepartmentReportId] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["reports", "daily", "generate-modal", "sessions", date],
    queryFn: () =>
      fetchSessions({
        started_from: dayjs(date).startOf("day").toISOString(),
        started_to: dayjs(date).endOf("day").toISOString(),
        page: "1",
        page_size: "100"
      }),
    enabled: open && scope === "personal",
    staleTime: 30_000
  });

  const sessionItems = sessionsQuery.data?.items ?? [];
  const ownSessionItems = user?.id ? sessionItems.filter((session) => session.user_id === user.id) : sessionItems;
  const sessionOptions = ownSessionItems.map(toSessionOption);

  const effectiveSelectedSessionIds = selectionTouched
    ? selectedSessionIds
    : sessionOptions.map((session) => session.value);

  const existingPersonalListQuery = useQuery({
    queryKey: ["reports", "daily", "generate-modal", "personal-existing", date],
    queryFn: () =>
      fetchMyReports({
        from: date,
        to: date,
        page: "1",
        page_size: "1"
      }),
    enabled: open && scope === "personal" && !reportId,
    staleTime: 0
  });

  const personalReportId = reportId ?? existingPersonalListQuery.data?.items[0]?.id;
  const personalReportQuery = useQuery({
    queryKey: ["reports", "daily", "generate-modal", "personal-report", personalReportId],
    queryFn: () => fetchReport(personalReportId ?? ""),
    enabled: open && scope === "personal" && Boolean(personalReportId),
    staleTime: 0
  });
  const personalReport = personalReportQuery.data;
  const personalLookupLoading =
    scope === "personal" && step === null && !reportId && existingPersonalListQuery.isLoading;
  const hasExistingPersonalReport = scope === "personal" && Boolean(personalReportId);
  const effectiveStep: Step =
    step ?? (scope === "personal" && hasExistingPersonalReport && !personalLookupLoading ? "editor" : initialStep);
  const editorMarkdown = draftTouched ? draftMarkdown : scope === "personal" ? (personalReport?.content ?? "") : draftMarkdown;
  const personalSessionIds =
    personalDraftSessionIds.length > 0
      ? personalDraftSessionIds
      : personalReport?.session_ids && personalReport.session_ids.length > 0
        ? personalReport.session_ids
        : effectiveSelectedSessionIds;

  const teamSourcesQuery = useQuery({
    queryKey: ["reports", "daily", "generate-modal", "team-sources", date],
    queryFn: () => fetchTeamReportSources(date),
    enabled: open && scope === "team",
    staleTime: 30_000
  });

  const departmentSourcesQuery = useQuery({
    queryKey: ["reports", "daily", "generate-modal", "department-sources", date],
    queryFn: () => fetchDepartmentReportSources(date),
    enabled: open && scope === "department",
    staleTime: 30_000
  });

  const personalDraftMutation = useMutation({
    mutationFn: (payload: GenerateReportDraftPayload) => generateTodayReportDraft(payload),
    onSuccess: (draft) => {
      setDraftMarkdown(draft.report_markdown);
      setDraftTouched(true);
      setPersonalDraftSessionIds(draft.selected_session_ids);
      setDraftError(null);
      setStep("editor");
    },
    onError: (error: unknown) => {
      const text = errorMessage(error);
      setDraftError(text);
      message.error(text);
    }
  });

  const teamGenerateMutation = useMutation({
    mutationFn: () => generateTeamReport(date),
    onSuccess: (report) => {
      setTeamDraft(report);
      setDraftMarkdown(report.content);
      setDraftError(null);
      setStep("editor");
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "team-list"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "team-detail"] });
    },
    onError: (error: unknown) => {
      const text = errorMessage(error);
      setDraftError(text);
      message.error(text);
    }
  });

  const departmentGenerateMutation = useMutation({
    mutationFn: () => generateDepartmentReport(date),
    onSuccess: (report) => {
      setDepartmentDraft(report);
      setDraftMarkdown(report.content);
      setDraftError(null);
      setStep("editor");
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "department-list"] });
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily", "department-detail"] });
    },
    onError: (error: unknown) => {
      const text = errorMessage(error);
      setDraftError(text);
      message.error(text);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async ({ finalAction }: { finalAction: boolean }) => {
      if (scope === "personal") {
        if (personalReportId && !personalReport) {
          throw new Error("日报正文尚未加载完成");
        }
        const report = personalReport ?? await fetchTodayReport();
        const payload = {
          content: editorMarkdown,
          session_ids: personalSessionIds
        };
        return finalAction ? submitReport(report.id, payload) : saveReport(report.id, payload);
      }
      if (scope === "team") {
        if (!teamDraft) throw new Error("请先生成小组日报草稿");
        const saved = await updateTeamReport(teamDraft.id, { content: draftMarkdown });
        return finalAction ? submitTeamReport(saved.id) : saved;
      }
      if (!departmentDraft) throw new Error("请先生成部门日报草稿");
      return updateDepartmentReport(departmentDraft.id, { content: draftMarkdown, archive: finalAction });
    },
    onSuccess: (result, variables) => {
      setDraftTouched(false);
      void queryClient.invalidateQueries({ queryKey: ["reports", "daily"] });
      void queryClient.invalidateQueries({ queryKey: ["reports"] });
      message.success(variables.finalAction ? (scope === "team" ? "已提交给总监" : scope === "department" ? "已归档" : "日报已发送") : "日报已保存");
      onDone?.(result, scope);
      onClose();
    },
    onError: (error: unknown) => message.error(errorMessage(error))
  });

  const isGenerating = personalDraftMutation.isPending || teamGenerateMutation.isPending || departmentGenerateMutation.isPending;
  const currentTitle = title ?? `${effectiveStep === "editor" ? "编辑" : "生成"}${scopeName(scope)}`;
  const skillOptions = [...REPORT_SKILL_OPTIONS, ...uploadedSkills];
  const currentSkill = skillOptions.find((skill) => skill.value === selectedSkill) ?? REPORT_SKILL_OPTIONS[0];
  const personalSubmitLabel =
    user?.role === "employee" ? "保存并发送给 TL" : user?.role === "team_leader" || user?.role === "pm" ? "保存并发送给总监" : "";
  const canSubmitPersonal = personalSubmitLabel.length > 0;
  const personalEditorLoading = scope === "personal" && hasExistingPersonalReport && personalReportQuery.isLoading && !draftTouched;

  const uploadReportSkill = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".md")) {
      message.error("请上传 markdown 格式的 skill.md 文件");
      return false;
    }

    void file.text().then((content) => {
      const uploadedSkillName = getUploadedSkillName(file.name, content);
      const uploadedSkillValue = `upload:${uploadedSkillName}`;
      setUploadedSkills((current) => {
        const next = current.filter((item) => item.value !== uploadedSkillValue);
        return [...next, { label: uploadedSkillName, value: uploadedSkillValue, source: "upload", content }];
      });
      setSelectedSkill(uploadedSkillValue);
      message.success("Skill 已载入，本次生成将作为补充约束");
    }).catch(() => {
      message.error("Skill 文件读取失败");
    });

    return false;
  };

  const runGenerate = () => {
    if (scope === "personal") {
      personalDraftMutation.mutate({
        report_date: date,
        session_ids: effectiveSelectedSessionIds,
        skill_id: "default_daily",
        skill_content: currentSkill.source === "upload" ? currentSkill.content : undefined,
        include_task_progress: true
      });
      return;
    }
    if (scope === "team") {
      teamGenerateMutation.mutate();
      return;
    }
    departmentGenerateMutation.mutate();
  };

  const handleGenerate = () => {
    if (scope === "personal" && editorMarkdown.trim().length > 0 && (draftTouched || hasExistingPersonalReport)) {
      Modal.confirm({
        title: "重新生成会覆盖当前编辑区内容，是否继续？",
        okText: "继续生成",
        cancelText: "取消",
        onOk: runGenerate
      });
      return;
    }
    runGenerate();
  };

  const handleClose = () => {
    if (scope === "personal" && draftTouched) {
      Modal.confirm({
        title: "当前内容尚未保存，关闭后将丢失，是否关闭？",
        okText: "确认关闭",
        cancelText: "继续编辑",
        onOk: onClose
      });
      return;
    }
    onClose();
  };

  const footer =
    personalLookupLoading ? null : effectiveStep === "editor" ? (
      <Space>
        <Button onClick={() => setStep(scope === "personal" ? "sessions" : "source")} disabled={saveMutation.isPending}>
          上一步
        </Button>
        <Button
          onClick={() => saveMutation.mutate({ finalAction: false })}
          loading={saveMutation.isPending}
          disabled={personalEditorLoading}
        >
          {scope === "personal" ? "保存日报" : "保存修改"}
        </Button>
        {scope !== "personal" || canSubmitPersonal ? (
          <Button
            type="primary"
            icon={<FileDoneOutlined />}
            onClick={() => saveMutation.mutate({ finalAction: true })}
            loading={saveMutation.isPending}
            disabled={personalEditorLoading}
          >
            {scope === "team" ? "提交给总监" : scope === "department" ? "保存归档" : personalSubmitLabel}
          </Button>
        ) : null}
      </Space>
    ) : (
      <Space>
        <Button onClick={handleClose} disabled={isGenerating}>
          稍后处理
        </Button>
        <Button
          type="primary"
          loading={isGenerating}
          disabled={
            (scope === "personal" && (sessionsQuery.isLoading || effectiveSelectedSessionIds.length === 0)) ||
            (scope === "team" && (teamSourcesQuery.data?.submitted ?? 0) === 0) ||
            (scope === "department" && (departmentSourcesQuery.data?.submitted_team_count ?? 0) === 0)
          }
          onClick={handleGenerate}
        >
          {scope === "personal"
            ? "生成日报"
            : scope === "team"
              ? "基于已提交成员日报生成草稿"
              : "基于已提交组日报生成草稿"}
        </Button>
      </Space>
    );

  return (
    <Modal
      className="console-report-workflow-modal"
      title={currentTitle}
      open={open}
      width={modalWidth(scope, effectiveStep)}
      footer={footer}
      onCancel={handleClose}
    >
      <div className="console-report-modal">
        <Steps size="small" current={effectiveStep === "editor" ? 1 : 0} items={sourceSteps(scope)} />
        {draftError ? <Alert type="error" showIcon message="日报草稿生成失败" description={draftError} /> : null}
        {personalLookupLoading ? (
          <div className="console-session-empty">正在加载今日日报状态...</div>
        ) : null}
        {!personalLookupLoading && effectiveStep === "sessions" ? (
          <>
            <div className="console-session-modal__section">
              <strong>选择生成来源</strong>
              <span>
                {sessionsQuery.isLoading
                  ? "正在加载已上传 session。"
                  : `已找到 ${sessionOptions.length} 个 session，默认勾选全部记录。`}
              </span>
            </div>
            {sessionsQuery.isError ? <Alert type="error" showIcon message="Session 加载失败" /> : null}
            <Checkbox.Group
              value={effectiveSelectedSessionIds}
              onChange={(value) => {
                setSelectionTouched(true);
                setSelectedSessionIds(value as string[]);
              }}
            >
              <div className="console-session-list">
                {sessionsQuery.isLoading ? (
                  <div className="console-session-empty">正在加载 session...</div>
                ) : sessionOptions.length === 0 ? (
                  <div className="console-session-empty">
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当天暂无已上传 session" />
                  </div>
                ) : (
                  sessionOptions.map((session) => (
                    <label key={session.value} className="console-session-item">
                      <Checkbox value={session.value} />
                      <span>
                        <strong>{session.tool}</strong>
                        <em>{session.timeRange} · {session.summary}</em>
                      </span>
                      <Tag color="blue">默认勾选</Tag>
                    </label>
                  ))
                )}
              </div>
            </Checkbox.Group>
            <GenerationSettingsPanel
              selectedSkill={selectedSkill}
              skillOptions={skillOptions}
              uploadedSkills={uploadedSkills}
              onSelectedSkillChange={setSelectedSkill}
              onSkillUpload={uploadReportSkill}
            />
          </>
        ) : null}
        {effectiveStep === "source" && scope === "team" ? (
          <>
            <TeamSourceReview
              sources={teamSourcesQuery.data ?? null}
              loading={teamSourcesQuery.isLoading}
              error={teamSourcesQuery.isError ? "成员日报收集情况加载失败" : null}
              expandedUserId={expandedTeamReportUserId}
              onExpandedUserIdChange={setExpandedTeamReportUserId}
            />
            <details className="console-generation-settings-disclosure">
              <summary>高级配置</summary>
              <GenerationSettingsPanel
                selectedSkill={selectedSkill}
                skillOptions={skillOptions}
                uploadedSkills={uploadedSkills}
                onSelectedSkillChange={setSelectedSkill}
                onSkillUpload={uploadReportSkill}
                compact
              />
            </details>
          </>
        ) : null}
        {effectiveStep === "source" && scope === "department" ? (
          <>
            <DepartmentSourceReview
              sources={departmentSourcesQuery.data ?? null}
              loading={departmentSourcesQuery.isLoading}
              error={departmentSourcesQuery.isError ? "小组日报收集情况加载失败" : null}
              expandedReportId={expandedDepartmentReportId}
              onExpandedReportIdChange={setExpandedDepartmentReportId}
            />
          </>
        ) : null}
        {effectiveStep === "editor" ? (
          <div className="console-report-editor-layout">
            <div className="console-report-editor-layout__main">
              <div className="console-session-modal__section">
                <strong>{scope === "personal" ? "个人日报正文" : `${scopeName(scope)}草稿`}</strong>
                <span>
                  {scope === "personal"
                    ? personalReport?.status === "submitted"
                      ? "当前日报已发送，可继续修改后保存或再次发送。"
                      : personalReport?.status === "saved"
                        ? "当前日报已保存，可继续修改后保存或发送。"
                        : "检查 Agent 生成结果后保存。"
                    : "检查 Agent 生成结果后保存。"}
                </span>
              </div>
              {personalReportQuery.isLoading && scope === "personal" && !draftTouched ? (
                <div className="console-session-empty">正在加载日报正文...</div>
              ) : (
                <TextArea
                  rows={16}
                  value={editorMarkdown}
                  onChange={(event) => {
                    setDraftTouched(true);
                    setDraftMarkdown(event.target.value);
                  }}
                />
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function TeamSourceReview({
  sources,
  loading,
  error,
  expandedUserId,
  onExpandedUserIdChange
}: {
  sources: TeamReportSources | null;
  loading: boolean;
  error: string | null;
  expandedUserId: string | null;
  onExpandedUserIdChange: (id: string | null) => void;
}) {
  if (loading) return <div className="console-session-empty">正在加载成员原始日报收集情况...</div>;
  if (error) return <Alert type="error" showIcon message={error} />;
  if (!sources) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无成员日报收集数据" />;

  const members = sources.members;
  const total = members.length;
  const submitted = sources.submitted ?? members.filter((member) => member.has_report).length;
  const missing = sources.missing ?? total - submitted;
  const edited = members.filter((member) => member.has_report && member.content.trim().length > 0).length;

  return (
    <div className="console-department-source">
      <div className="console-session-modal__section">
        <strong>确认成员原始日报来源</strong>
        <span>
          {sources.team_name} · {sources.report_date} · 已收集 {submitted}/{total} 份成员日报，
          {missing} 人未提交。
        </span>
      </div>

      <div className="console-team-source__stats" aria-label="成员日报提交统计">
        <span><strong>{total}</strong><em>成员总数</em></span>
        <span><strong>{submitted}</strong><em>今日已交</em></span>
        <span><strong>{missing}</strong><em>今日未交</em></span>
        <span><strong>{edited}</strong><em>已编辑</em></span>
      </div>

      <section className="console-department-source__block console-team-source__block">
        <div className="console-department-source__head">
          <strong>成员原始日报</strong>
          <Tag color={missing > 0 ? "gold" : "green"}>{submitted}/{total} 已提交</Tag>
        </div>
        {members.length === 0 ? (
          <div className="console-session-empty">暂无团队成员</div>
        ) : (
          <div className="console-team-source__list">
            {members.map((member) => {
              const expanded = expandedUserId === member.user_id;
              return (
                <article
                  key={member.user_id}
                  className={`console-team-source__item ${member.has_report ? "" : "is-missing"}`}
                >
                  <div className="console-team-source__row">
                    <div className="console-team-source__member">
                      <strong title={member.user_name}>{member.user_name}</strong>
                      <Tag color={member.has_report ? "blue" : "gold"} bordered={false}>
                        {member.has_report ? "已提交" : "未提交"}
                      </Tag>
                    </div>
                    <div className="console-team-source__actions">
                      <time>{member.submitted_at ? formatDateTime(member.submitted_at, "HH:mm") : "未提交"}</time>
                      {member.has_report ? (
                        <Button size="small" onClick={() => onExpandedUserIdChange(expanded ? null : member.user_id)}>
                          {expanded ? "收起原文" : "查看原文"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {expanded ? (
                    <pre className="console-department-source__content console-team-source__content">
                      {member.content || "暂无内容"}
                    </pre>
                  ) : !member.has_report ? (
                    <p className="console-team-source__missing-note">成员今日尚未提交原始日报。</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function DepartmentSourceReview({
  sources,
  loading,
  error,
  expandedReportId,
  onExpandedReportIdChange
}: {
  sources: DepartmentReportSources | null;
  loading: boolean;
  error: string | null;
  expandedReportId: string | null;
  onExpandedReportIdChange: (id: string | null) => void;
}) {
  if (loading) return <div className="console-session-empty">正在加载小组日报收集情况...</div>;
  if (error) return <Alert type="error" showIcon message={error} />;
  if (!sources) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无小组日报收集数据" />;

  const submitted = sources.submitted_team_reports;
  const missing = sources.missing_teams;

  return (
    <div className="console-department-source">
      <div className="console-session-modal__section">
        <strong>确认小组日报来源</strong>
        <span>
          已收集 {sources.submitted_team_count}/{sources.total_team_count} 个小组日报，
          {missing.length} 个小组未提交。
        </span>
      </div>

      <section className="console-department-source__block">
        <div className="console-department-source__head">
          <strong>已提交小组</strong>
          <Tag color="blue">{submitted.length} 组</Tag>
        </div>
        {submitted.length === 0 ? (
          <div className="console-session-empty">暂无已提交小组日报</div>
        ) : (
          <div className="console-department-source__list">
            {submitted.map((item) => {
              const reportId = item.team_report_id ?? item.report_id ?? item.team_id;
              const expanded = expandedReportId === reportId;
              return (
                <article key={reportId} className="console-department-source__item">
                  <div className="console-department-source__row">
                    <span>
                      <strong>{item.team_name}</strong>
                      <em>{item.team_leader_name || item.leader_name || "未记录 TL"}</em>
                    </span>
                    <span>
                      <time>{item.submitted_at ? formatDateTime(item.submitted_at, "HH:mm") : "-"}</time>
                      <Button size="small" onClick={() => onExpandedReportIdChange(expanded ? null : reportId)}>
                        {expanded ? "收起原文" : "查看原文"}
                      </Button>
                    </span>
                  </div>
                  {expanded ? (
                    <pre className="console-department-source__content">{item.content || "暂无内容"}</pre>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="console-department-source__block">
        <div className="console-department-source__head">
          <strong>未提交小组</strong>
          <Tag color={missing.length > 0 ? "gold" : "green"}>{missing.length} 组</Tag>
        </div>
        {missing.length === 0 ? (
          <div className="console-session-empty">所有小组均已提交</div>
        ) : (
          <div className="console-department-source__missing">
            {missing.map((team) => (
              <Tag key={team.team_id} color="gold">{team.team_name}</Tag>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function GenerationSettingsPanel({
  selectedSkill,
  skillOptions,
  uploadedSkills,
  onSelectedSkillChange,
  onSkillUpload,
  compact
}: {
  selectedSkill: string;
  skillOptions: ReportSkillOption[];
  uploadedSkills: ReportSkillOption[];
  onSelectedSkillChange: (value: string) => void;
  onSkillUpload: (file: File) => boolean;
  compact?: boolean;
}) {
  const selectedSkillLabel = skillOptions.find((option) => option.value === selectedSkill)?.label ?? selectedSkill;
  return (
    <section className={`console-generation-settings${compact ? " console-generation-settings--compact" : ""}`}>
      <div className="console-generation-settings__head">
        <span>
          <strong>Skill 预设</strong>
          <em>选择日报生成口径；上传 skill.md 后会加入预设，并用于本次生成。</em>
        </span>
        <Tag color="blue">{selectedSkillLabel}</Tag>
      </div>
      <div className="console-generation-settings__body">
        <label>
          <span>当前预设</span>
          <Select
            value={selectedSkill}
            options={skillOptions.map((option) => ({
              label: option.label,
              value: option.value
            }))}
            popupMatchSelectWidth={false}
            onChange={onSelectedSkillChange}
          />
        </label>
        <div className="console-generation-settings__upload">
          <span>上传预设</span>
          <Upload
            accept=".md,text/markdown"
            beforeUpload={(file) => onSkillUpload(file)}
            maxCount={1}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>上传 skill.md</Button>
          </Upload>
        </div>
      </div>
      {uploadedSkills.length > 0 ? (
        <div className="console-generation-settings__presets" aria-label="已上传 Skill">
          {uploadedSkills.map((skill) => (
            <Tag key={skill.value} color={skill.value === selectedSkill ? "blue" : "default"}>
              {skill.label}
            </Tag>
          ))}
        </div>
      ) : null}
    </section>
  );
}
