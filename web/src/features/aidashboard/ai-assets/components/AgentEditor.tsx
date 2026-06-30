import { Button, Card, Form, Input, Select, Space } from "antd";
import type { FormInstance } from "antd";

import type {
  ManagedAgent,
  ManagedMCPEntry,
  ManagedSkill,
  UpsertManagedAgentPayload
} from "../../api/types";
import { MCPResourcePicker } from "./MCPResourcePicker";
import { SkillResourcePicker } from "./SkillResourcePicker";
import { parseMCPBindingKey, parseRefKey } from "../utils/agentAssets";

import "./AgentWorkspace.css";

export type AgentEditorSubmitPayload = UpsertManagedAgentPayload;

export interface AgentEditorValues {
  name: string;
  description?: string;
  engine: string;
  instructions?: string;
  default_model_id?: string;
  start_prompt_template?: string;
  skills?: string[];
  mcp_bindings?: string[];
}

interface AgentEditorProps {
  form: FormInstance<AgentEditorValues>;
  agent: ManagedAgent | null;
  skills: ManagedSkill[];
  mcpEntries: ManagedMCPEntry[];
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: AgentEditorSubmitPayload) => void;
}

export function AgentEditor({
  form,
  agent,
  skills,
  mcpEntries,
  submitting,
  onCancel,
  onSubmit
}: AgentEditorProps) {
  return (
    <section className="ai-assets-workspace">
      <div className="ai-assets-workspace__header">
        <div>
          <h2>{agent ? "编辑 Managed Agent" : "新建 Managed Agent"}</h2>
          <p>配置 Agent 基础信息、运行参数、Prompt 和资源绑定。保存仍使用当前 Aida Agent 接口。</p>
        </div>
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" loading={submitting} onClick={() => form.submit()}>
            {agent ? "保存" : "创建 Agent"}
          </Button>
        </Space>
      </div>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ engine: "codex" }}
        onFinish={(values: AgentEditorValues) => {
          const payload: AgentEditorSubmitPayload = {
            name: values.name,
            description: values.description,
            engine: values.engine,
            instructions: values.instructions,
            default_model_id: values.default_model_id,
            start_prompt_template: values.start_prompt_template,
            skills: values.skills?.map(parseRefKey),
            mcp_bindings: values.mcp_bindings?.map(parseMCPBindingKey)
          };
          onSubmit(payload);
        }}
      >
        <Card title="基础信息" className="ai-assets-editor-section">
          <div className="ai-assets-editor-grid">
            <Form.Item label="Agent ID">
              <Input value={agent?.agent_id || "创建后由平台生成"} disabled />
            </Form.Item>
            <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入名称" }]}>
              <Input placeholder="Agent 名称" />
            </Form.Item>
            <Form.Item name="description" label="描述" className="ai-assets-editor-grid__wide">
              <Input.TextArea rows={3} placeholder="这个 Agent 能做什么" />
            </Form.Item>
          </div>
        </Card>

        <Card title="运行配置" className="ai-assets-editor-section">
          <div className="ai-assets-editor-grid">
            <Form.Item
              name="engine"
              label="Engine"
              rules={[{ required: true, message: "请选择 engine" }]}
            >
              <Select
                options={[
                  { label: "codex", value: "codex" },
                  { label: "claude-code", value: "claude-code" }
                ]}
              />
            </Form.Item>
            <Form.Item name="default_model_id" label="默认模型">
              <Input placeholder="留空则由平台默认值决定" />
            </Form.Item>
          </div>
        </Card>

        <Card title="Prompt 配置" className="ai-assets-editor-section">
          <Form.Item name="instructions" label="Instructions">
            <Input.TextArea rows={6} placeholder="系统指令" />
          </Form.Item>
          <Form.Item name="start_prompt_template" label="Start Prompt 模板">
            <Input.TextArea
              rows={5}
              placeholder="例如：请帮我分析 {{ topic }}，{{ 变量 }} 会在运行页生成输入框。"
            />
          </Form.Item>
        </Card>

        <Card title="资源绑定" className="ai-assets-editor-section">
          <Form.Item name="skills" label="Skills">
            <SkillResourcePicker skills={skills} />
          </Form.Item>
          <Form.Item name="mcp_bindings" label="MCP Servers">
            <MCPResourcePicker entries={mcpEntries} />
          </Form.Item>
        </Card>
      </Form>
    </section>
  );
}
