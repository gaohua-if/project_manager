import {
  ApiOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RobotOutlined,
  ToolOutlined
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag
} from "antd";
import type { TableProps } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createManagedAgentSchedule,
  deleteManagedAgentSchedule,
  fetchDailyReportAgentIntegration,
  fetchManagedAgentRuns,
  fetchManagedAgentSchedules,
  fetchManagedAgents,
  fetchManagedMCPEntries,
  fetchManagedSkills,
  runManagedAgentScheduleNow,
  updateManagedAgentSchedule
} from "../../api/client";
import type {
  AIRun,
  ManagedAgent,
  ManagedAgentSchedule,
  ManagedMCPBinding,
  ManagedMCPEntry,
  ManagedScope,
  ManagedSkill,
  ManagedSkillRef,
  UpsertManagedAgentSchedulePayload
} from "../../api/types";
import {
  RequirementMetricCard,
  RequirementMetricGrid
} from "../../requirements/components/RequirementMetricCard";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { HttpError } from "@/shared/request/types";
import { errorMessage, refKey, SCOPE_OPTIONS } from "../utils/agentAssets";

import "./AIAssetsPage.css";

type AssetTab = "skills" | "mcp" | "agents" | "schedules";

interface ScheduleFormValues {
  name: string;
  agent_id: string;
  model_id?: string;
  schedule_type: "daily" | "weekly";
  weekdays?: number[];
  time_of_day: string;
  timezone?: string;
  message: string;
  params_text?: string;
  enabled?: boolean;
}

const WEEKDAY_OPTIONS = [
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
  { label: "周日", value: 7 }
];

function unixTime(value?: number) {
  if (!value) return "-";
  return new Date(value * 1000).toLocaleString();
}

type ManagedAgentPlatformIssue = {
  code: "MANAGED_AGENT_NOT_CONFIGURED" | "MANAGED_AGENT_UNREACHABLE" | "MANAGED_AGENT_UPSTREAM_ERROR" | "UNKNOWN";
  title: string;
  description: string;
};

function managedAgentPayloadCode(error: unknown) {
  if (!(error instanceof HttpError) || !error.payload || typeof error.payload !== "object") {
    return undefined;
  }
  const payload = error.payload as { code?: unknown };
  return typeof payload.code === "string" ? payload.code : undefined;
}

function managedAgentPlatformIssue(error: unknown): ManagedAgentPlatformIssue | null {
  const code = managedAgentPayloadCode(error);
  if (code === "MANAGED_AGENT_NOT_CONFIGURED") {
    return {
      code,
      title: "Managed Agent 平台未配置",
      description: "Managed Agent 平台未配置，请联系管理员配置服务地址和 Token。"
    };
  }
  if (code === "MANAGED_AGENT_UNREACHABLE") {
    return {
      code,
      title: "Managed Agent 平台不可达",
      description: "Managed Agent 平台暂时不可用，请稍后重试或联系管理员检查服务连通性。"
    };
  }
  if (code === "MANAGED_AGENT_UPSTREAM_ERROR") {
    return {
      code,
      title: "Managed Agent 平台返回错误",
      description: errorMessage(error)
    };
  }
  if (error) {
    return {
      code: "UNKNOWN",
      title: "Managed Agent 平台请求失败",
      description: errorMessage(error)
    };
  }
  return null;
}

function externalAssetEmptyText(
  platformIssue: ManagedAgentPlatformIssue | null,
  emptyDescription: string
) {
  if (!platformIssue) return <Empty description={emptyDescription} />;
  return <Empty description={platformIssue.title} />;
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

function formatParamLines(params?: Record<string, string>): string {
  if (!params) return "";
  return Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function schedulePayload(values: ScheduleFormValues): UpsertManagedAgentSchedulePayload {
  return {
    name: values.name,
    agent_id: values.agent_id,
    model_id: values.model_id?.trim() || undefined,
    schedule_type: values.schedule_type,
    weekdays: values.schedule_type === "weekly" ? values.weekdays ?? [] : [],
    time_of_day: values.time_of_day,
    timezone: values.timezone?.trim() || "Asia/Shanghai",
    message: values.message,
    params: parseParamLines(values.params_text ?? ""),
    enabled: values.enabled ?? true
  };
}

const AGENTS_PATH = "/ai-assets/agents";

export function AIAssetsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [tab, setTab] = useState<AssetTab>("skills");
  const [scope, setScope] = useState<ManagedScope>("mine");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ManagedAgentSchedule | null>(null);
  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [scheduleForm] = Form.useForm<ScheduleFormValues>();
  const scheduleType = Form.useWatch("schedule_type", scheduleForm);

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
  const schedulesQuery = useQuery({
    queryKey: ["managed-agent-schedules"],
    queryFn: () => fetchManagedAgentSchedules(),
    staleTime: 15_000
  });
  const integrationQuery = useQuery({
    queryKey: ["daily-report-agent-integration"],
    queryFn: () => fetchDailyReportAgentIntegration(),
    enabled: integrationOpen,
    staleTime: 60_000
  });

  const skills = useMemo(() => skillsQuery.data?.skills ?? [], [skillsQuery.data]);
  const mcpEntries = useMemo(() => mcpQuery.data?.entries ?? [], [mcpQuery.data]);
  const agents = useMemo(() => agentsQuery.data?.agents ?? [], [agentsQuery.data]);
  const runs = useMemo(() => runsQuery.data?.runs ?? [], [runsQuery.data]);
  const schedules = useMemo(
    () => schedulesQuery.data?.schedules ?? [],
    [schedulesQuery.data]
  );
  const platformIssue = useMemo(
    () =>
      managedAgentPlatformIssue(skillsQuery.error) ??
      managedAgentPlatformIssue(mcpQuery.error) ??
      managedAgentPlatformIssue(agentsQuery.error),
    [agentsQuery.error, mcpQuery.error, skillsQuery.error]
  );
  const platformBlocked = Boolean(platformIssue);
  const platformActionTitle = platformIssue?.description;
  const agentNameByID = useMemo(() => {
    const names = new Map<string, string>();
    for (const agent of agents) {
      names.set(agent.agent_id, agent.name || agent.agent_id);
    }
    return names;
  }, [agents]);

  const createScheduleMutation = useMutation({
    mutationFn: (payload: UpsertManagedAgentSchedulePayload) =>
      createManagedAgentSchedule(payload),
    onSuccess: () => {
      message.success("定时任务已创建");
      setScheduleOpen(false);
      scheduleForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["managed-agent-schedules"] });
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  const updateScheduleMutation = useMutation({
    mutationFn: (payload: UpsertManagedAgentSchedulePayload) =>
      updateManagedAgentSchedule(editingSchedule?.id || "", payload),
    onSuccess: () => {
      message.success("定时任务已更新");
      setScheduleOpen(false);
      setEditingSchedule(null);
      scheduleForm.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["managed-agent-schedules"] });
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (scheduleId: string) => deleteManagedAgentSchedule(scheduleId),
    onSuccess: () => {
      message.success("定时任务已删除");
      void queryClient.invalidateQueries({ queryKey: ["managed-agent-schedules"] });
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  const runScheduleMutation = useMutation({
    mutationFn: (scheduleId: string) => runManagedAgentScheduleNow(scheduleId),
    onSuccess: () => {
      message.success("定时任务已提交运行");
      void queryClient.invalidateQueries({ queryKey: ["managed-agent-runs"] });
      void queryClient.invalidateQueries({ queryKey: ["managed-agent-schedules"] });
    },
    onError: (err: unknown) => message.error(errorMessage(err))
  });

  const agentOptions = useMemo(
    () =>
      agents.map((agent) => ({
        label: `${agent.name || agent.agent_id} (${agent.agent_id})`,
        value: agent.agent_id
      })),
    [agents]
  );

  const openCreateSchedule = () => {
    setEditingSchedule(null);
    scheduleForm.resetFields();
    scheduleForm.setFieldsValue({
      schedule_type: "daily",
      time_of_day: "19:00",
      timezone: "Asia/Shanghai",
      enabled: true
    });
    setScheduleOpen(true);
  };

  const openEditSchedule = (schedule: ManagedAgentSchedule) => {
    setEditingSchedule(schedule);
    scheduleForm.resetFields();
    scheduleForm.setFieldsValue({
      name: schedule.name,
      agent_id: schedule.agent_id,
      model_id: schedule.model_id,
      schedule_type: schedule.schedule_type,
      weekdays: schedule.weekdays,
      time_of_day: schedule.time_of_day,
      timezone: schedule.timezone,
      message: schedule.message,
      params_text: formatParamLines(schedule.params),
      enabled: schedule.enabled
    });
    setScheduleOpen(true);
  };

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
            disabled={platformBlocked}
            title={platformActionTitle}
            onClick={() => navigate(`${AGENTS_PATH}/${record.agent_id}/run`)}
          >
            运行
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => navigate(`${AGENTS_PATH}/${record.agent_id}/edit`)}
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
      render: (value: string) => {
        if (value === "manual_agent_run") return "手动运行";
        if (value === "scheduled_agent_run") return "定时任务";
        return value;
      }
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

  const scheduleColumns: TableProps<ManagedAgentSchedule>["columns"] = [
    {
      title: "任务",
      dataIndex: "name",
      render: (_: string, record) => (
        <span className="ai-assets-name">
          <strong>{record.name}</strong>
          <span>{agentNameByID.get(record.agent_id) || record.agent_id}</span>
        </span>
      )
    },
    {
      title: "触发",
      dataIndex: "schedule_type",
      width: 180,
      render: (_: string, record) => {
        const weekdays =
          record.schedule_type === "weekly"
            ? record.weekdays
                .map((day) => WEEKDAY_OPTIONS.find((item) => item.value === day)?.label)
                .filter(Boolean)
                .join("、")
            : "每天";
        return `${weekdays} ${record.time_of_day}`;
      }
    },
    { title: "时区", dataIndex: "timezone", width: 150 },
    {
      title: "状态",
      dataIndex: "enabled",
      width: 100,
      render: (enabled: boolean) =>
        enabled ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>
    },
    {
      title: "最近运行",
      dataIndex: "last_run_at",
      width: 180,
      render: (value?: string) => (value ? new Date(value).toLocaleString() : "-")
    },
    {
      title: "操作",
      width: 240,
      render: (_: unknown, record) => (
        <Space>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            loading={runScheduleMutation.isPending && runScheduleMutation.variables === record.id}
            disabled={platformBlocked}
            title={platformActionTitle}
            onClick={() => runScheduleMutation.mutate(record.id)}
          >
            运行
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditSchedule(record)}>
            编辑
          </Button>
          <Popconfirm
            title="删除定时任务"
            description="删除后不会再自动触发该 Agent。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => deleteScheduleMutation.mutate(record.id)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
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
      <Button
        icon={<ApiOutlined />}
        disabled={platformBlocked}
        title={platformActionTitle}
        onClick={() => navigate("/ai-assets/mcp/new")}
      >
        新建 MCP
      </Button>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        disabled={platformBlocked}
        title={platformActionTitle}
        onClick={() => navigate(`${AGENTS_PATH}/new`)}
      >
        新建 Agent
      </Button>
      <Button icon={<ClockCircleOutlined />} onClick={openCreateSchedule}>
        新建定时任务
      </Button>
      <Button
        icon={<RobotOutlined />}
        disabled={platformBlocked}
        title={platformActionTitle}
        onClick={() => setIntegrationOpen(true)}
      >
        日报 MCP/Skill
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
        <RequirementMetricCard
          tone="warning"
          icon={<ClockCircleOutlined />}
          loading={schedulesQuery.isLoading}
          metric={{
            key: "schedules",
            title: "定时任务",
            value: schedules.length,
            description: `${schedules.filter((item) => item.enabled).length} 个启用`
          }}
        />
      </RequirementMetricGrid>

      {platformIssue ? (
        <Alert
          className="ai-assets-platform-alert"
          type={platformIssue.code === "MANAGED_AGENT_NOT_CONFIGURED" ? "warning" : "error"}
          showIcon
          message={platformIssue.title}
          description={platformIssue.description}
        />
      ) : null}

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
                locale={{ emptyText: externalAssetEmptyText(platformIssue, "暂无 Skill") }}
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
                locale={{ emptyText: externalAssetEmptyText(platformIssue, "暂无 MCP") }}
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
                  locale={{ emptyText: externalAssetEmptyText(platformIssue, "暂无 Agent") }}
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
          },
          {
            key: "schedules",
            label: "定时任务",
            children: (
              <Table
                rowKey="id"
                columns={scheduleColumns}
                dataSource={schedules}
                loading={schedulesQuery.isLoading}
                locale={{ emptyText: <Empty description="暂无定时任务" /> }}
              />
            )
          }
        ]}
      />

      <Modal
        title="日报 MCP / Skill"
        open={integrationOpen}
        onCancel={() => setIntegrationOpen(false)}
        width={820}
        footer={<Button onClick={() => setIntegrationOpen(false)}>关闭</Button>}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Input
            addonBefore="MCP URL"
            value={integrationQuery.data?.mcp.url ?? ""}
            readOnly
            suffix={
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                disabled={!integrationQuery.data?.mcp.url}
                onClick={() => {
                  void navigator.clipboard.writeText(integrationQuery.data?.mcp.url ?? "");
                  message.success("MCP URL 已复制");
                }}
              />
            }
          />
          <Input
            addonBefore="Skill"
            value={
              integrationQuery.data
                ? `${integrationQuery.data.skill.slug}@${integrationQuery.data.skill.version}`
                : ""
            }
            readOnly
          />
          <Input.TextArea
            rows={14}
            value={integrationQuery.data?.skill.skill_md ?? ""}
            readOnly
          />
          <Space>
            <Button
              icon={<CopyOutlined />}
              disabled={!integrationQuery.data?.skill.skill_md}
              onClick={() => {
                void navigator.clipboard.writeText(integrationQuery.data?.skill.skill_md ?? "");
                message.success("Skill Markdown 已复制");
              }}
            >
              复制 Skill Markdown
            </Button>
          </Space>
        </Space>
      </Modal>

      <Modal
        title={editingSchedule ? "编辑定时任务" : "新建定时任务"}
        open={scheduleOpen}
        onCancel={() => {
          setScheduleOpen(false);
          setEditingSchedule(null);
          scheduleForm.resetFields();
        }}
        onOk={() => scheduleForm.submit()}
        confirmLoading={createScheduleMutation.isPending || updateScheduleMutation.isPending}
        destroyOnClose
      >
        <Form
          form={scheduleForm}
          layout="vertical"
          onFinish={(values) => {
            const payload = schedulePayload(values);
            if (editingSchedule) {
              updateScheduleMutation.mutate(payload);
            } else {
              createScheduleMutation.mutate(payload);
            }
          }}
        >
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="agent_id"
            label="Agent"
            rules={[{ required: true, message: "请选择 Agent" }]}
          >
            <Select options={agentOptions} />
          </Form.Item>
          <Form.Item name="model_id" label="模型">
            <Input placeholder="留空使用 Agent 默认模型" />
          </Form.Item>
          <Form.Item name="schedule_type" label="重复" rules={[{ required: true }]}>
            <Select
              options={[
                { label: "每天", value: "daily" },
                { label: "每周", value: "weekly" }
              ]}
            />
          </Form.Item>
          {scheduleType === "weekly" ? (
            <Form.Item
              name="weekdays"
              label="星期"
              rules={[{ required: true, message: "请选择星期" }]}
            >
              <Select mode="multiple" options={WEEKDAY_OPTIONS} />
            </Form.Item>
          ) : null}
          <Form.Item
            name="time_of_day"
            label="触发时间"
            rules={[
              { required: true, message: "请输入触发时间" },
              { pattern: /^([01]\d|2[0-3]):[0-5]\d$/, message: "格式应为 HH:mm" }
            ]}
          >
            <Input placeholder="19:00" />
          </Form.Item>
          <Form.Item name="timezone" label="时区">
            <Input placeholder="Asia/Shanghai" />
          </Form.Item>
          <Form.Item name="message" label="触发消息" rules={[{ required: true, message: "请输入消息" }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="params_text" label="参数">
            <Input.TextArea
              rows={4}
              placeholder={"每行一个 key=value，例如：\nreport_date=today\nproject=Aida"}
            />
          </Form.Item>
          <Form.Item name="enabled" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>

    </PagePanel>
  );
}
