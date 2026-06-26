import {
  ApiOutlined,
  CloudServerOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RobotOutlined,
  ToolOutlined
} from "@ant-design/icons";
import { App, Button, Empty, Form, Input, Modal, Select, Space, Table, Tabs, Tag } from "antd";
import type { TableProps } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  createManagedAgent,
  createManagedMCPEntry,
  fetchManagedAgentRun,
  fetchManagedAgentRuns,
  fetchManagedAgents,
  fetchManagedMCPEntries,
  fetchManagedSkills,
  startManagedAgentRun,
  updateManagedAgent
} from "../../api/client";
import type {
  AIRun,
  ManagedAgent,
  ManagedMCPBinding,
  ManagedMCPEntry,
  ManagedScope,
  ManagedSkill,
  ManagedSkillRef,
  UpsertManagedAgentPayload
} from "../../api/types";
import {
  RequirementMetricCard,
  RequirementMetricGrid
} from "../../requirements/components/RequirementMetricCard";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

import "./AIAssetsPage.css";

type AssetTab = "skills" | "mcp" | "agents";

const SCOPE_OPTIONS: Array<{ label: string; value: ManagedScope }> = [
  { label: "我的", value: "mine" },
  { label: "公开", value: "public" },
  { label: "全部", value: "all" }
];

function unixTime(value?: number) {
  if (!value) return "-";
  return new Date(value * 1000).toLocaleString();
}

function refKey(owner: string | undefined, slug: string, version: string) {
  return [owner || "", slug, version].join("/");
}

function parseRefKey(value: string): ManagedSkillRef {
  const [owner, slug, version] = value.split("/");
  return { owner: owner || undefined, slug, version };
}

function parseMCPBindingKey(value: string): ManagedMCPBinding {
  return parseRefKey(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败";
}

function parseParamLines(value: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const line of value.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    params[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return params;
}

export function AIAssetsPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState<AssetTab>("skills");
  const [scope, setScope] = useState<ManagedScope>("mine");
  const [agentOpen, setAgentOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<ManagedAgent | null>(null);
  const [runningAgent, setRunningAgent] = useState<ManagedAgent | null>(null);
  const [runMessage, setRunMessage] = useState("");
  const [runModelId, setRunModelId] = useState("");
  const [runParamsText, setRunParamsText] = useState("");
  const [activeRunId, setActiveRunId] = useState<string>();
  const resetRunner = () => {
    setRunningAgent(null);
    setRunMessage("");
    setRunModelId("");
    setRunParamsText("");
    setActiveRunId(undefined);
  };
  const [mcpOpen, setMcpOpen] = useState(false);
  const [agentForm] = Form.useForm<{
    name: string;
    description?: string;
    engine: string;
    instructions?: string;
    default_model_id?: string;
    start_prompt_template?: string;
    skills?: string[];
    mcp_bindings?: string[];
  }>();
  const [mcpForm] = Form.useForm<ManagedMCPEntry>();

  const skillsQuery = useQuery({
    queryKey: ["managed-skills", scope],
    queryFn: () => fetchManagedSkills(scope),
    staleTime: 60_000
  });
  const mcpQuery = useQuery({
    queryKey: ["managed-mcp", scope],
    queryFn: () => fetchManagedMCPEntries(scope),
    staleTime: 60_000
  });
  const agentsQuery = useQuery({
    queryKey: ["managed-agents"],
    queryFn: () => fetchManagedAgents(),
    staleTime: 30_000
  });
  const runsQuery = useQuery({
    queryKey: ["managed-agent-runs"],
    queryFn: () => fetchManagedAgentRuns({ page_size: "50" }),
    staleTime: 15_000
  });
  const activeRunQuery = useQuery<AIRun>({
    queryKey: ["managed-agent-run", activeRunId],
    queryFn: () => fetchManagedAgentRun(activeRunId as string),
    enabled: Boolean(activeRunId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 2500 : false;
    }
  });

  const skills = useMemo(() => skillsQuery.data?.skills ?? [], [skillsQuery.data]);
  const mcpEntries = useMemo(() => mcpQuery.data?.entries ?? [], [mcpQuery.data]);
  const agents = useMemo(() => agentsQuery.data?.agents ?? [], [agentsQuery.data]);
  const runs = useMemo(() => runsQuery.data?.runs ?? [], [runsQuery.data]);

  const createAgentMutation = useMutation({
    mutationFn: (payload: UpsertManagedAgentPayload) => createManagedAgent(payload),
    onSuccess: () => {
      message.success("Agent 已创建");
      setAgentOpen(false);
      agentForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["managed-agents"] });
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  const updateAgentMutation = useMutation({
    mutationFn: (payload: UpsertManagedAgentPayload) =>
      updateManagedAgent(editingAgent?.agent_id || "", payload),
    onSuccess: () => {
      message.success("Agent 已更新");
      setAgentOpen(false);
      setEditingAgent(null);
      agentForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["managed-agents"] });
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  const createMCPMutation = useMutation({
    mutationFn: (payload: ManagedMCPEntry) => createManagedMCPEntry(payload),
    onSuccess: () => {
      message.success("MCP 已创建");
      setMcpOpen(false);
      mcpForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["managed-mcp"] });
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  const runAgentMutation = useMutation({
    mutationFn: () =>
      startManagedAgentRun(runningAgent?.agent_id || "", {
        message: runMessage,
        model_id: runModelId,
        params: parseParamLines(runParamsText)
      }),
    onSuccess: (run) => {
      message.success("Agent 已提交运行");
      setActiveRunId(run.id);
      void queryClient.invalidateQueries({ queryKey: ["managed-agent-runs"] });
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  const skillOptions = useMemo(
    () =>
      skills.map((skill) => ({
        label: `${skill.name || skill.slug} (${skill.slug}@${skill.version})`,
        value: refKey(skill.owner, skill.slug, skill.version)
      })),
    [skills]
  );
  const mcpOptions = useMemo(
    () =>
      mcpEntries.map((entry) => ({
        label: `${entry.name || entry.slug} (${entry.slug}@${entry.version})`,
        value: refKey(entry.owner, entry.slug, entry.version)
      })),
    [mcpEntries]
  );

  const skillColumns: TableProps<ManagedSkill>["columns"] = [
    {
      title: "Skill",
      dataIndex: "name",
      render: (_: string, record) => (
        <span className="ai-assets-name">
          <strong>{record.name || record.slug}</strong>
          <span>{record.description || `${record.slug}@${record.version}`}</span>
        </span>
      )
    },
    { title: "Owner", dataIndex: "owner", width: 140, render: (v?: string) => v || "-" },
    { title: "Slug", dataIndex: "slug", width: 160 },
    { title: "版本", dataIndex: "version", width: 120 },
    {
      title: "状态",
      dataIndex: "archived",
      width: 100,
      render: (archived: boolean) =>
        archived ? <Tag color="default">已归档</Tag> : <Tag color="green">可用</Tag>
    },
    { title: "创建时间", dataIndex: "created_at", width: 180, render: unixTime }
  ];

  const mcpColumns: TableProps<ManagedMCPEntry>["columns"] = [
    {
      title: "MCP",
      dataIndex: "name",
      render: (_: string, record) => (
        <span className="ai-assets-name">
          <strong>{record.name || record.slug}</strong>
          <span>{record.description || record.url || record.command || "-"}</span>
        </span>
      )
    },
    { title: "Transport", dataIndex: "transport", width: 130 },
    { title: "Slug", dataIndex: "slug", width: 160 },
    { title: "版本", dataIndex: "version", width: 110 },
    {
      title: "凭据",
      dataIndex: "requires_credential",
      width: 100,
      render: (required: boolean) => (required ? <Tag color="orange">需要</Tag> : <Tag>无</Tag>)
    }
  ];

  const agentColumns: TableProps<ManagedAgent>["columns"] = [
    {
      title: "Agent",
      dataIndex: "name",
      render: (_: string, record) => (
        <span className="ai-assets-name">
          <strong>{record.name}</strong>
          <span>{record.description || record.agent_id}</span>
        </span>
      )
    },
    { title: "Engine", dataIndex: "engine", width: 130 },
    {
      title: "版本",
      dataIndex: "current_version_id",
      width: 100,
      render: (v: number | undefined, record) => v || record.managed_version || "-"
    },
    {
      title: "Skill",
      dataIndex: "skills",
      width: 120,
      render: (items?: ManagedSkillRef[]) => items?.length ?? 0
    },
    {
      title: "MCP",
      dataIndex: "mcp_bindings",
      width: 120,
      render: (items?: ManagedMCPBinding[]) => items?.length ?? 0
    },
    {
      title: "状态",
      dataIndex: "archived",
      width: 100,
      render: (archived: boolean) =>
        archived ? <Tag color="default">已归档</Tag> : <Tag color="blue">可用</Tag>
    },
    {
      title: "操作",
      key: "actions",
      width: 180,
      render: (_: unknown, record) => (
        <Space>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => {
            setRunningAgent(record);
            setRunMessage("");
            setRunModelId(record.default_model_id || "");
            setRunParamsText("");
            setActiveRunId(undefined);
          }}
          >
            运行
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingAgent(record);
              agentForm.setFieldsValue({
                name: record.name,
                description: record.description,
                engine: record.engine,
                instructions: record.instructions,
                default_model_id: record.default_model_id,
                start_prompt_template: record.start_prompt_template,
                skills: record.skills?.map((item) => refKey(item.owner, item.slug, item.version)),
                mcp_bindings: record.mcp_bindings?.map((item) =>
                  refKey(item.owner, item.slug, item.version)
                )
              });
              setAgentOpen(true);
            }}
          >
            编辑
          </Button>
        </Space>
      )
    }
  ];

  const runColumns: TableProps<AIRun>["columns"] = [
    {
      title: "Agent",
      dataIndex: "agent_id",
      width: 220,
      render: (value: string) => <span className="ai-assets-run-agent">{value}</span>
    },
    {
      title: "类型",
      dataIndex: "business_type",
      width: 150,
      render: (value: string) => (value === "manual_agent_run" ? "手动运行" : value)
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (value: AIRun["status"]) => {
        const color = value === "succeeded" ? "green" : value === "failed" ? "red" : "blue";
        return <Tag color={color}>{value}</Tag>;
      }
    },
    { title: "模型", dataIndex: "model_id", width: 140, render: (value?: string) => value || "-" },
    {
      title: "Task",
      dataIndex: "external_task_id",
      width: 240,
      render: (value?: string) => value || "-"
    },
    {
      title: "结果",
      dataIndex: "result",
      render: (_: string, record) => (
        <span className="ai-assets-run-summary">
          {record.error_message || record.result || "-"}
        </span>
      )
    },
    {
      title: "时间",
      dataIndex: "created_at",
      width: 180,
      render: (value: string) => new Date(value).toLocaleString()
    }
  ];

  const operations = (
    <Space>
      <Select
        className="ai-assets-scope"
        value={scope}
        options={SCOPE_OPTIONS}
        onChange={setScope}
      />
      <Button icon={<ApiOutlined />} onClick={() => setMcpOpen(true)}>
        新建 MCP
      </Button>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setEditingAgent(null);
          agentForm.resetFields();
          agentForm.setFieldsValue({ engine: "codex" });
          setAgentOpen(true);
        }}
      >
        新建 Agent
      </Button>
    </Space>
  );

  return (
    <PagePanel
      title="我的 AI 资产"
      description="管理 Managed Agent 平台中的 Skill、MCP 和个人 Agent"
      breadcrumbs={[{ title: "系统" }, { title: "我的 AI 资产" }]}
      className="ai-assets-page aidashboard-list"
      actions={operations}
    >
      <RequirementMetricGrid>
        <RequirementMetricCard
          tone="primary"
          icon={<ToolOutlined />}
          loading={skillsQuery.isLoading}
          metric={{ key: "skills", title: "Skills", value: skills.length, description: scope }}
        />
        <RequirementMetricCard
          tone="info"
          icon={<CloudServerOutlined />}
          loading={mcpQuery.isLoading}
          metric={{ key: "mcp", title: "MCP", value: mcpEntries.length, description: scope }}
        />
        <RequirementMetricCard
          tone="success"
          icon={<RobotOutlined />}
          loading={agentsQuery.isLoading}
          metric={{ key: "agents", title: "Agents", value: agents.length, description: "我的" }}
        />
      </RequirementMetricGrid>

      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as AssetTab)}
        items={[
          {
            key: "skills",
            label: "我的 Skills",
            children: (
              <Table
                rowKey={(record) => record.skill_id || refKey(record.owner, record.slug, record.version)}
                columns={skillColumns}
                dataSource={skills}
                loading={skillsQuery.isLoading}
                locale={{ emptyText: <Empty description="暂无 Skill" /> }}
              />
            )
          },
          {
            key: "mcp",
            label: "我的 MCP",
            children: (
              <Table
                rowKey={(record) => record.entry_id || refKey(record.owner, record.slug, record.version)}
                columns={mcpColumns}
                dataSource={mcpEntries}
                loading={mcpQuery.isLoading}
                locale={{ emptyText: <Empty description="暂无 MCP" /> }}
              />
            )
          },
          {
            key: "agents",
            label: "我的 Agents",
            children: (
              <div className="ai-assets-agent-pane">
                <Table
                  rowKey="agent_id"
                  columns={agentColumns}
                  dataSource={agents}
                  loading={agentsQuery.isLoading}
                  locale={{ emptyText: <Empty description="暂无 Agent" /> }}
                />
                <section className="ai-assets-history">
                  <header>
                    <strong>运行历史</strong>
                    <Button size="small" onClick={() => void runsQuery.refetch()}>
                      刷新
                    </Button>
                  </header>
                  <Table
                    rowKey="id"
                    columns={runColumns}
                    dataSource={runs}
                    loading={runsQuery.isLoading}
                    pagination={{ pageSize: 8 }}
                    locale={{ emptyText: <Empty description="暂无运行记录" /> }}
                  />
                </section>
              </div>
            )
          }
        ]}
      />

      <Modal
        title={editingAgent ? "编辑 Managed Agent" : "新建 Managed Agent"}
        open={agentOpen}
        onCancel={() => {
          setAgentOpen(false);
          setEditingAgent(null);
          agentForm.resetFields();
        }}
        onOk={() => agentForm.submit()}
        confirmLoading={createAgentMutation.isPending || updateAgentMutation.isPending}
        destroyOnClose
      >
        <Form
          form={agentForm}
          layout="vertical"
          initialValues={{ engine: "codex" }}
          onFinish={(values) => {
            const payload = {
              name: values.name,
              description: values.description,
              engine: values.engine,
              instructions: values.instructions,
              default_model_id: values.default_model_id,
              start_prompt_template: values.start_prompt_template,
              skills: values.skills?.map(parseRefKey),
              mcp_bindings: values.mcp_bindings?.map(parseMCPBindingKey)
            };
            if (editingAgent) {
              updateAgentMutation.mutate(payload);
            } else {
              createAgentMutation.mutate(payload);
            }
          }}
        >
          {editingAgent ? (
            <Form.Item label="Agent ID">
              <Input value={editingAgent.agent_id} disabled />
            </Form.Item>
          ) : null}
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="engine"
            label="Engine"
            rules={[{ required: true, message: "请输入 engine" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="default_model_id" label="默认模型">
            <Input placeholder="例如 gpt-5-codex" />
          </Form.Item>
          <Form.Item name="start_prompt_template" label="Start Prompt 模板">
            <Input.TextArea
              rows={4}
              placeholder="例如：请为 {{user_name}} 生成 {{report_date}} 的日报。"
            />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="instructions" label="指令">
            <Input.TextArea rows={5} />
          </Form.Item>
          <Form.Item name="skills" label="绑定 Skills">
            <Select mode="multiple" options={skillOptions} />
          </Form.Item>
          <Form.Item name="mcp_bindings" label="绑定 MCP">
            <Select mode="multiple" options={mcpOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建 MCP"
        open={mcpOpen}
        onCancel={() => setMcpOpen(false)}
        onOk={() => mcpForm.submit()}
        confirmLoading={createMCPMutation.isPending}
        destroyOnClose
      >
        <Form
          form={mcpForm}
          layout="vertical"
          initialValues={{ transport: "http", version: "1.0.0", requires_credential: false }}
          onFinish={(values) => createMCPMutation.mutate(values)}
        >
          <Form.Item name="name" label="名称">
            <Input />
          </Form.Item>
          <Form.Item name="slug" label="Slug" rules={[{ required: true, message: "请输入 Slug" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="version"
            label="版本"
            rules={[{ required: true, message: "请输入版本" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="transport" label="Transport">
            <Select
              options={[
                { label: "http", value: "http" },
                { label: "sse", value: "sse" },
                { label: "stdio", value: "stdio" }
              ]}
            />
          </Form.Item>
          <Form.Item name="url" label="URL">
            <Input />
          </Form.Item>
          <Form.Item name="command" label="Command">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={runningAgent ? `运行 ${runningAgent.name}` : "运行 Agent"}
        open={Boolean(runningAgent)}
        onCancel={resetRunner}
        width={820}
        footer={
          <Space>
            <Button onClick={resetRunner}>
              关闭
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={runAgentMutation.isPending}
              disabled={!runMessage.trim() || !runModelId.trim() || activeRunQuery.data?.status === "running"}
              onClick={() => runAgentMutation.mutate()}
            >
              提交运行
            </Button>
          </Space>
        }
        destroyOnClose
      >
        <div className="ai-assets-runner">
          <Input
            value={runModelId}
            onChange={(event) => setRunModelId(event.target.value)}
            placeholder="模型 ID，例如平台支持的 claude / codex 模型"
          />
          {runningAgent?.start_prompt_template ? (
            <pre className="ai-assets-runner__template">{runningAgent.start_prompt_template}</pre>
          ) : null}
          <Input.TextArea
            rows={4}
            value={runParamsText}
            onChange={(event) => setRunParamsText(event.target.value)}
            placeholder={"模板参数，每行一个 key=value，例如：\nreport_date=2026-06-25\nuser_name=普通用户"}
          />
          <Input.TextArea
            rows={5}
            value={runMessage}
            onChange={(event) => setRunMessage(event.target.value)}
            placeholder="输入要交给 Agent 执行的任务，例如：基于今天的 Aida session 生成日报草稿。"
          />
          <div className="ai-assets-runner__status">
            <strong>运行状态</strong>
            <Tag color={activeRunQuery.data?.status === "succeeded" ? "green" : "blue"}>
              {activeRunQuery.data?.status || "未提交"}
            </Tag>
            {activeRunQuery.data?.external_task_id ? (
              <span>Task: {activeRunQuery.data.external_task_id}</span>
            ) : null}
          </div>
          {activeRunQuery.data?.error_message ? (
            <pre className="ai-assets-runner__result is-error">
              {activeRunQuery.data.error_message}
            </pre>
          ) : (
            <pre className="ai-assets-runner__result">
              {activeRunQuery.data?.result || "运行完成后，结果会显示在这里。"}
            </pre>
          )}
        </div>
      </Modal>
    </PagePanel>
  );
}
