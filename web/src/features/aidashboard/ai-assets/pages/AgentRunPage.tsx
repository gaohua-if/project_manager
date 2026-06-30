import { Alert, App, Button, Card, Input, Space, Spin, Tag } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { fetchManagedAgentRun, fetchManagedAgents, startManagedAgentRun } from "../../api/client";
import type { AIRun, ManagedAgent } from "../../api/types";
import {
  errorMessage,
  extractPromptVariables,
  renderPromptPreview
} from "../utils/agentAssets";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

import "../components/AgentWorkspace.css";

const AI_ASSETS_HOME = "/ai-assets";

function AgentRunForm({ agent }: { agent: ManagedAgent }) {
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

  const missingPromptVariables = promptVariables.filter(
    (key) => !startPromptValues[key]?.trim()
  );
  const promptPreview = template ? renderPromptPreview(template, startPromptValues) : "";
  const modelId = runModelId.trim() || agent.default_model_id?.trim() || "";
  const hasPromptInput = promptVariables.length > 0
    ? missingPromptVariables.length === 0
    : runMessage.trim().length > 0;
  const canRun = !runMutation.isPending && Boolean(modelId) && hasPromptInput;

  const runResult = activeRunQuery.data;

  return (
    <section className="ai-assets-workspace">
      <div className="ai-assets-workspace__header">
        <div>
          <h2>运行 {agent.name}</h2>
          <p>根据 Start Prompt 模板填写运行参数；提交仍走当前 Aida Agent 运行接口。</p>
        </div>
        <Space>
          <Button onClick={() => navigate(AI_ASSETS_HOME)}>返回</Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={runMutation.isPending}
            disabled={!canRun}
            onClick={() => runMutation.mutate()}
          >
            运行
          </Button>
        </Space>
      </div>

      <div className="ai-assets-run-layout">
        <Card className="ai-assets-run-context">
          <h3>{agent.name}</h3>
          <p>{agent.description || "暂无描述"}</p>
          <div className="ai-assets-run-meta">Engine：{agent.engine || "-"}</div>
          <div className="ai-assets-run-meta">
            默认模型：{agent.default_model_id || "未配置"}
          </div>
          <div className="ai-assets-run-meta">
            版本：{agent.current_version_id || agent.managed_version || "-"}
          </div>
        </Card>

        <div className="ai-assets-run-form">
          {promptVariables.length > 0 ? (
            <Card title="Start Prompt Values" className="ai-assets-editor-section">
              <div className="ai-assets-prompt-values">
                {promptVariables.map((key) => (
                  <label key={key} className="ai-assets-prompt-field">
                    <span>
                      {key}
                      <em>*</em>
                    </span>
                    <Input.TextArea
                      rows={2}
                      value={startPromptValues[key] || ""}
                      onChange={(event) =>
                        setStartPromptValues((current) => ({
                          ...current,
                          [key]: event.target.value
                        }))
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
              placeholder={
                agent.default_model_id
                  ? `留空使用 Agent 默认模型：${agent.default_model_id}`
                  : "请输入模型 ID（Agent 未配置默认模型，此项必填）"
              }
            />
            {!agent.default_model_id ? (
              <div className="ai-assets-run-meta" style={{ marginTop: 8, color: "#dc2626" }}>
                该 Agent 未配置默认模型，请在此处填写 model_id 后再运行。
              </div>
            ) : null}
          </Card>

          {template ? (
            <Card title="Prompt 预览" className="ai-assets-editor-section">
              <pre className="ai-assets-prompt-preview">{promptPreview}</pre>
            </Card>
          ) : null}

          <Card title="运行状态" className="ai-assets-editor-section">
            <div className="ai-assets-runner__status">
              <strong>状态</strong>
              <Tag color={runResult?.status === "succeeded" ? "green" : "blue"}>
                {runResult?.status || "未提交"}
              </Tag>
              {runResult?.external_task_id ? (
                <span>Task: {runResult.external_task_id}</span>
              ) : null}
            </div>
            {runResult?.error_message ? (
              <pre className="ai-assets-runner__result is-error">
                {runResult.error_message}
              </pre>
            ) : (
              <pre className="ai-assets-runner__result">
                {runResult?.result || "运行完成后，结果会显示在这里。"}
              </pre>
            )}
          </Card>
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

  return (
    <PagePanel
      title={`运行 ${agent.name}`}
      description="根据 Start Prompt 模板填写运行参数；提交仍走当前 Aida Agent 运行接口。"
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
      <AgentRunForm key={agent.agent_id} agent={agent} />
    </PagePanel>
  );
}
