import { Alert, App, Button, Card, DatePicker, Input, Select, Space, Spin, Tag } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  fetchManagedAgentRun,
  fetchManagedAgents,
  startManagedAgentRun,
  startReportAgentRun
} from "../../api/client";
import type { AIRun, ManagedAgent, ReportType } from "../../api/types";
import {
  errorMessage,
  extractPromptVariables,
  renderPromptPreview
} from "../utils/agentAssets";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { useAuth } from "@/shared/auth/authContext";
import type { UserRole } from "@/shared/auth/types";

import "../components/AgentWorkspace.css";

const AI_ASSETS_HOME = "/ai-assets";

const REPORT_AGENT_MARKER = "AIDA_REPORT_AGENT:default";
const REPORT_TYPES_MARKER = "AIDA_REPORT_AGENT_TYPES:";
const REPORT_SYSTEM_PROMPT_KEYS = new Set([
  "report_type",
  "period_json",
  "target_json",
  "run_id",
  "mcp_url",
  "credential_slot",
  "AIDA_REPORT_MCP_AUTH"
]);

const REPORT_TYPE_OPTIONS: Array<{ label: string; value: ReportType; roles: UserRole[] }> = [
  { label: "个人日报", value: "personal_daily", roles: ["employee", "pm", "team_leader", "director", "admin"] },
  { label: "个人周报", value: "personal_weekly", roles: ["employee", "pm", "team_leader", "director", "admin"] },
  { label: "小组日报", value: "team_daily", roles: ["team_leader", "admin"] },
  { label: "小组周报", value: "team_weekly", roles: ["team_leader", "admin"] },
  { label: "部门日报", value: "department_daily", roles: ["director", "admin"] },
  { label: "部门周报", value: "department_weekly", roles: ["director", "admin"] }
];

function isWeeklyReportType(type: ReportType) {
  return type.endsWith("_weekly");
}

function agentMarkerText(agent: ManagedAgent) {
  return [agent.description, agent.instructions, agent.start_prompt_template].filter(Boolean).join("\n");
}

function supportedReportTypes(agent: ManagedAgent): ReportType[] {
  if (agent.business_type === "report") {
    return agent.report_types?.length ? agent.report_types : REPORT_TYPE_OPTIONS.map((item) => item.value);
  }
  if (agent.business_type === "generic") {
    return [];
  }
  const text = agentMarkerText(agent);
  if (!text.includes(REPORT_AGENT_MARKER)) return [];
  const markerLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(REPORT_TYPES_MARKER));
  if (!markerLine) return REPORT_TYPE_OPTIONS.map((item) => item.value);
  const supported = markerLine
    .slice(REPORT_TYPES_MARKER.length)
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is ReportType =>
      REPORT_TYPE_OPTIONS.some((option) => option.value === item)
    );
  return supported.length > 0 ? supported : REPORT_TYPE_OPTIONS.map((item) => item.value);
}

function reportTypeOptionsForUser(agent: ManagedAgent, role?: UserRole) {
  const supported = supportedReportTypes(agent);
  if (supported.length === 0 || !role) return [];
  return REPORT_TYPE_OPTIONS.filter(
    (option) => supported.includes(option.value) && option.roles.includes(role)
  );
}

function isReportAgent(agent: ManagedAgent) {
  if (agent.business_type === "report") return true;
  if (agent.business_type === "generic") return false;
  return supportedReportTypes(agent).length > 0;
}

function defaultWeekRange(): [Dayjs, Dayjs] {
  const today = dayjs();
  const weekday = today.day() === 0 ? 7 : today.day();
  const weekStart = today.subtract(weekday - 1, "day").startOf("day");
  return [weekStart, weekStart.add(6, "day")];
}

function cleanAgentDescription(agent: ManagedAgent, reportAgent: boolean) {
  const description = (agent.description || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("AIDA_"))
    .join("\n");
  if (description) return description;
  if (reportAgent) return "标准 Agent 的 Aida 报告业务用途，运行时由 Aida 注入报告上下文和 Report MCP。";
  return "暂无描述";
}

function RunStatusCard({ run }: { run?: AIRun }) {
  return (
    <Card title="运行状态" className="ai-assets-editor-section">
      <div className="ai-assets-runner__status">
        <strong>状态</strong>
        <Tag color={run?.status === "succeeded" ? "green" : run?.status === "failed" ? "red" : "blue"}>
          {run?.status || "未提交"}
        </Tag>
        {run?.external_task_id ? <span>Task: {run.external_task_id}</span> : null}
        {run?.external_session_id ? <span>Session: {run.external_session_id}</span> : null}
      </div>
      {run?.error_message ? (
        <pre className="ai-assets-runner__result is-error">{run.error_message}</pre>
      ) : (
        <pre className="ai-assets-runner__result">
          {run?.result || "运行完成后，结果会显示在这里。"}
        </pre>
      )}
    </Card>
  );
}

function AgentContextCard({ agent, reportAgent }: { agent: ManagedAgent; reportAgent: boolean }) {
  const description = cleanAgentDescription(agent, reportAgent);
  const version = agent.current_version_id || agent.managed_version || "-";
  return (
    <Card className="ai-assets-run-context">
      <div className="ai-assets-run-context__head">
        <h3>{agent.name}</h3>
        {reportAgent ? <Tag color="purple">Report Agent</Tag> : <Tag>普通 Agent</Tag>}
      </div>
      <p>{description}</p>
      <dl className="ai-assets-run-meta-list">
        <div>
          <dt>Engine</dt>
          <dd>{agent.engine || "-"}</dd>
        </div>
        <div>
          <dt>默认模型</dt>
          <dd>{agent.default_model_id || "未配置"}</dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>{version}</dd>
        </div>
      </dl>
    </Card>
  );
}

function GenericAgentRunForm({ agent }: { agent: ManagedAgent }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const template = agent.start_prompt_template?.trim() || "";
  const promptVariables = useMemo(() => extractPromptVariables(template), [template]);

  const [startPromptValues, setStartPromptValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(promptVariables.map((key) => [key, ""]))
  );
  const [runMessage, setRunMessage] = useState("");
  const [runModelId, setRunModelId] = useState("");
  const [activeRunId, setActiveRunId] = useState<string>();

  const activeRunQuery = useQuery<AIRun>({
    queryKey: ["managed-agent-run", activeRunId],
    queryFn: () => fetchManagedAgentRun(activeRunId as string),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 2500 : false;
    }
  });

  const modelId = runModelId.trim() || agent.default_model_id?.trim() || "";
  const missingPromptVariables = promptVariables.filter((key) => !startPromptValues[key]?.trim());
  const promptPreview = template ? renderPromptPreview(template, startPromptValues) : "";
  const hasPromptInput = promptVariables.length > 0
    ? missingPromptVariables.length === 0
    : runMessage.trim().length > 0;
  const canRun = !activeRunQuery.isFetching && Boolean(modelId) && hasPromptInput;

  const runMutation = useMutation({
    mutationFn: () => {
      const messageText = template ? renderPromptPreview(template, startPromptValues) : runMessage;
      return startManagedAgentRun(agent.agent_id, {
        message: messageText,
        model_id: modelId,
        params: promptVariables.length ? startPromptValues : undefined
      });
    },
    onSuccess: (run) => {
      message.success("Agent 已提交运行");
      setActiveRunId(run.id);
      void queryClient.invalidateQueries({ queryKey: ["managed-agent-runs"] });
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  return (
    <section className="ai-assets-workspace">
      <div className="ai-assets-run-layout">
        <AgentContextCard agent={agent} reportAgent={false} />
        <div className="ai-assets-run-form">
          {promptVariables.length > 0 ? (
            <Card title="Start Prompt Values" className="ai-assets-editor-section">
              <div className="ai-assets-prompt-values">
                {promptVariables.map((key) => (
                  <label key={key} className="ai-assets-prompt-field">
                    <span>{key}<em>*</em></span>
                    <Input.TextArea
                      rows={2}
                      value={startPromptValues[key] || ""}
                      onChange={(event) =>
                        setStartPromptValues((current) => ({ ...current, [key]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            </Card>
          ) : (
            <Card title="Initial Message" className="ai-assets-editor-section">
              <Input.TextArea
                rows={5}
                value={runMessage}
                onChange={(event) => setRunMessage(event.target.value)}
                placeholder="这个 Agent 未配置 Start Prompt Template，请直接输入初始消息。"
              />
            </Card>
          )}

          <Card title="模型" className="ai-assets-editor-section">
            <Input
              value={runModelId}
              onChange={(event) => setRunModelId(event.target.value)}
              placeholder={agent.default_model_id ? `留空使用 Agent 默认模型：${agent.default_model_id}` : "请输入模型 ID"}
            />
          </Card>

          {template ? (
            <Card title="Prompt 预览" className="ai-assets-editor-section">
              <pre className="ai-assets-prompt-preview">{promptPreview}</pre>
            </Card>
          ) : null}

          <RunStatusCard run={activeRunQuery.data} />

          <div className="ai-assets-workspace__actions">
            <Space>
              <Button onClick={() => navigate(AI_ASSETS_HOME)}>返回</Button>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={runMutation.isPending}
                disabled={!canRun || runMutation.isPending}
                onClick={() => runMutation.mutate()}
              >
                运行
              </Button>
            </Space>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReportAgentRunForm({ agent }: { agent: ManagedAgent }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { message } = App.useApp();

  const template = agent.start_prompt_template?.trim() || "";
  const promptVariables = useMemo(() => extractPromptVariables(template), [template]);
  const userPromptVariables = useMemo(
    () => promptVariables.filter((key) => !REPORT_SYSTEM_PROMPT_KEYS.has(key)),
    [promptVariables]
  );
  const options = useMemo(() => reportTypeOptionsForUser(agent, user?.role), [agent, user?.role]);
  const [startPromptValues, setStartPromptValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(userPromptVariables.map((key) => [key, ""]))
  );
  const [runMessage, setRunMessage] = useState("");
  const [reportTypeInput, setReportTypeInput] = useState<ReportType>("personal_daily");
  const [reportDate, setReportDate] = useState<Dayjs>(dayjs());
  const [weekRange, setWeekRange] = useState<[Dayjs, Dayjs]>(() => defaultWeekRange());
  const [runModelId, setRunModelId] = useState("");
  const [activeRunId, setActiveRunId] = useState<string>();

  const activeRunQuery = useQuery<AIRun>({
    queryKey: ["managed-agent-run", activeRunId],
    queryFn: () => fetchManagedAgentRun(activeRunId as string),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 2500 : false;
    }
  });

  const reportType = options.some((option) => option.value === reportTypeInput)
    ? reportTypeInput
    : options[0]?.value ?? reportTypeInput;
  const modelId = runModelId.trim() || agent.default_model_id?.trim() || "";
  const missingPromptVariables = userPromptVariables.filter((key) => !startPromptValues[key]?.trim());
  const promptPreview = template ? renderPromptPreview(template, startPromptValues) : "";
  const canRun = options.length > 0
    && Boolean(modelId)
    && missingPromptVariables.length === 0
    && !activeRunQuery.isFetching;

  const runMutation = useMutation({
    mutationFn: () => {
      const period = isWeeklyReportType(reportType)
        ? {
            week_start: weekRange[0].format("YYYY-MM-DD"),
            week_end: weekRange[1].format("YYYY-MM-DD")
          }
        : { date: reportDate.format("YYYY-MM-DD") };
      return startReportAgentRun(agent.agent_id, {
        report_type: reportType,
        period,
        target: { type: "self" },
        model_id: modelId,
        start_prompt_values: userPromptVariables.length ? startPromptValues : undefined,
        message: runMessage.trim() || undefined
      });
    },
    onSuccess: (run) => {
      message.success("Report Agent 已提交运行");
      setActiveRunId(run.id);
      void queryClient.invalidateQueries({ queryKey: ["managed-agent-runs"] });
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  return (
    <section className="ai-assets-workspace">
      <div className="ai-assets-run-layout">
        <AgentContextCard agent={agent} reportAgent />
        <div className="ai-assets-run-form">
          <Card title="报告参数" className="ai-assets-editor-section">
            {options.length === 0 ? (
              <Alert type="warning" showIcon message="当前账号没有可运行的报告类型" />
            ) : (
              <div className="ai-assets-editor-grid">
                <label className="ai-assets-prompt-field">
                  <span>报告类型<em>*</em></span>
                  <Select
                    value={reportType}
                    options={options}
                    onChange={(value) => setReportTypeInput(value)}
                  />
                </label>
                {isWeeklyReportType(reportType) ? (
                  <label className="ai-assets-prompt-field">
                    <span>报告周期<em>*</em></span>
                    <DatePicker.RangePicker
                      value={weekRange}
                      onChange={(value) => {
                        if (value?.[0] && value[1]) {
                          setWeekRange([value[0], value[1]]);
                        }
                      }}
                    />
                  </label>
                ) : (
                  <label className="ai-assets-prompt-field">
                    <span>报告日期<em>*</em></span>
                    <DatePicker
                      value={reportDate}
                      onChange={(value) => {
                        if (value) setReportDate(value);
                      }}
                    />
                  </label>
                )}
              </div>
            )}
          </Card>

          {userPromptVariables.length > 0 ? (
            <Card title="Start Prompt Values" className="ai-assets-editor-section">
              <div className="ai-assets-prompt-values">
                {userPromptVariables.map((key) => (
                  <label key={key} className="ai-assets-prompt-field">
                    <span>{key}<em>*</em></span>
                    <Input.TextArea
                      rows={2}
                      value={startPromptValues[key] || ""}
                      onChange={(event) =>
                        setStartPromptValues((current) => ({ ...current, [key]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
            </Card>
          ) : null}

          <Card title="Initial Message" className="ai-assets-editor-section">
            <Input.TextArea
              rows={4}
              value={runMessage}
              onChange={(event) => setRunMessage(event.target.value)}
              placeholder="可选：补充本次报告生成要求。"
            />
          </Card>

          <Card title="模型" className="ai-assets-editor-section">
            <Input
              value={runModelId}
              onChange={(event) => setRunModelId(event.target.value)}
              placeholder={agent.default_model_id ? `留空使用 Agent 默认模型：${agent.default_model_id}` : "请输入模型 ID"}
            />
          </Card>

          {template ? (
            <Card title="Prompt 预览" className="ai-assets-editor-section">
              <pre className="ai-assets-prompt-preview">{promptPreview}</pre>
            </Card>
          ) : null}

          <RunStatusCard run={activeRunQuery.data} />

          <div className="ai-assets-workspace__actions">
            <Space>
              <Button onClick={() => navigate(AI_ASSETS_HOME)}>返回</Button>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={runMutation.isPending}
                disabled={!canRun || runMutation.isPending}
                onClick={() => runMutation.mutate()}
              >
                运行
              </Button>
            </Space>
          </div>
        </div>
      </div>
    </section>
  );
}

export function AgentRunPage() {
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId: string }>();

  const agentsQuery = useQuery({
    queryKey: ["managed-agents"],
    queryFn: () => fetchManagedAgents(),
    staleTime: 30_000
  });

  const agent = useMemo(
    () => agentsQuery.data?.agents.find((item) => item.agent_id === agentId) ?? null,
    [agentsQuery.data, agentId]
  );

  if (agentsQuery.isLoading) {
    return (
      <PagePanel
        title="运行 Managed Agent"
        description="加载 Agent 中…"
        backTo={AI_ASSETS_HOME}
        onBack={() => navigate(AI_ASSETS_HOME)}
        onNavigate={(path) => navigate(path)}
        breadcrumbs={[
          { title: "系统" },
          { title: "我的 AI 资产", path: AI_ASSETS_HOME },
          { title: "运行 Agent" }
        ]}
      >
        <Spin />
      </PagePanel>
    );
  }

  if (!agent) {
    return (
      <PagePanel
        title="运行 Managed Agent"
        description="未找到该 Agent"
        backTo={AI_ASSETS_HOME}
        onBack={() => navigate(AI_ASSETS_HOME)}
        onNavigate={(path) => navigate(path)}
        breadcrumbs={[
          { title: "系统" },
          { title: "我的 AI 资产", path: AI_ASSETS_HOME },
          { title: "运行 Agent" }
        ]}
      >
        <Alert
          type="warning"
          showIcon
          message="未找到该 Agent"
          description="该 Agent 可能已被删除，请返回列表查看。"
        />
      </PagePanel>
    );
  }

  const reportAgent = isReportAgent(agent);

  return (
    <PagePanel
      title={`运行 ${agent.name}`}
      description={reportAgent ? "选择报告业务参数后运行 Report Agent。" : "根据 Agent 输入契约填写运行参数。"}
      backTo={AI_ASSETS_HOME}
      onBack={() => navigate(AI_ASSETS_HOME)}
      onNavigate={(path) => navigate(path)}
      breadcrumbs={[
        { title: "系统" },
        { title: "我的 AI 资产", path: AI_ASSETS_HOME },
        { title: agent.name || "运行 Agent" },
        { title: "运行" }
      ]}
    >
      {reportAgent ? (
        <ReportAgentRunForm key={agent.agent_id} agent={agent} />
      ) : (
        <GenericAgentRunForm key={agent.agent_id} agent={agent} />
      )}
    </PagePanel>
  );
}
