import { Card, Checkbox, Form, Input, Segmented } from "antd";
import type { FormInstance } from "antd";
import { useMemo } from "react";

import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import type { ManagedMCPEntry } from "../../api/types";
import "./AgentWorkspace.css";

type Transport = "http" | "stdio";

export interface MCPCreateFormValues {
  slug: string;
  version: string;
  name?: string;
  description?: string;
  transport: Transport;
  url?: string;
  auth_header?: string;
  auth_scheme?: string;
  command?: string;
  args?: string;
  env_text?: string;
  credential_env?: string;
  requires_credential: boolean;
}

interface MCPCreateFormProps {
  form: FormInstance<MCPCreateFormValues>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: ManagedMCPEntry) => void;
}

function parseArgsText(value: string): string[] {
  return value.split(/\s+/).map((item) => item.trim()).filter(Boolean);
}

function parseEnvText(value: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of value.split("\n")) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) env[key] = val;
  }
  return env;
}

export function MCPCreateForm({ form, submitting, onCancel, onSubmit }: MCPCreateFormProps) {
  const transport = Form.useWatch("transport", form) ?? "http";

  const handleSubmit = (values: MCPCreateFormValues) => {
    const payload: ManagedMCPEntry = {
      slug: values.slug.trim(),
      version: values.version.trim(),
      name: values.name?.trim() ?? "",
      description: values.description?.trim() || undefined,
      transport: values.transport,
      requires_credential: values.requires_credential ?? false,
      archived: false
    };
    if (values.transport === "http") {
      payload.url = values.url?.trim() ?? "";
      if (values.auth_header?.trim()) payload.auth_header = values.auth_header.trim();
      if (values.auth_scheme?.trim()) payload.auth_scheme = values.auth_scheme.trim();
    } else {
      payload.command = values.command?.trim() ?? "";
      payload.args = parseArgsText(values.args ?? "");
      const env = parseEnvText(values.env_text ?? "");
      if (Object.keys(env).length) payload.env = env;
      if (values.credential_env?.trim()) payload.credential_env = values.credential_env.trim();
    }
    onSubmit(payload);
  };

  const placeholderVersion = useMemo(() => "1.0.0", []);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ transport: "http", version: "1.0.0", requires_credential: false }}
      onFinish={handleSubmit}
    >
      <Card title="基础信息" className="ai-assets-editor-section">
        <Form.Item label="Transport">
          <Segmented
            value={transport}
            onChange={(val) => form.setFieldValue("transport", val as Transport)}
            options={[
              { label: "HTTP", value: "http" },
              { label: "stdio", value: "stdio" }
            ]}
          />
        </Form.Item>
        <div className="ai-assets-editor-grid">
          <Form.Item
            name="slug"
            label="Slug"
            rules={[{ required: true, message: "请输入 Slug" }]}
          >
            <Input placeholder="github" />
          </Form.Item>
          <Form.Item
            name="version"
            label="版本"
            rules={[{ required: true, message: "请输入版本" }]}
          >
            <Input placeholder={placeholderVersion} />
          </Form.Item>
          <Form.Item name="name" label="显示名称（可选）">
            <Input placeholder="GitHub" />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）" className="ai-assets-editor-grid__wide">
            <Input.TextArea rows={2} placeholder="这个 MCP Server 提供什么能力" />
          </Form.Item>
        </div>
      </Card>

      {transport === "http" ? (
        <Card title="连接与鉴权" className="ai-assets-editor-section">
          <Form.Item
            name="url"
            label="URL"
            rules={[{ required: true, message: "请输入 URL" }]}
          >
            <Input placeholder="https://mcp.example.com/v1" />
          </Form.Item>
          <div className="ai-assets-editor-grid">
            <Form.Item name="auth_header" label="Auth Header（默认 Authorization）">
              <Input placeholder="Authorization" />
            </Form.Item>
            <Form.Item name="auth_scheme" label="Auth Scheme（默认 Bearer）">
              <Input placeholder="Bearer，填 none 为裸值" />
            </Form.Item>
          </div>
        </Card>
      ) : (
        <Card title="命令与环境" className="ai-assets-editor-section">
          <div className="ai-assets-editor-grid">
            <Form.Item
              name="command"
              label="命令"
              rules={[{ required: true, message: "请输入命令" }]}
            >
              <Input placeholder="npx / uvx" />
            </Form.Item>
            <Form.Item name="credential_env" label="凭据环境变量（可选）">
              <Input placeholder="GITHUB_TOKEN" />
            </Form.Item>
          </div>
          <Form.Item name="args" label="参数（空格分隔）" className="ai-assets-editor-grid__wide">
            <Input placeholder="-y @modelcontextprotocol/server-github" />
          </Form.Item>
          <Form.Item
            name="env_text"
            label="静态环境变量（可选，每行 KEY=VALUE）"
            className="ai-assets-editor-grid__wide"
          >
            <Input.TextArea rows={3} placeholder={"LOG_LEVEL=info\n（不要放密钥）"} />
          </Form.Item>
        </Card>
      )}

      <Card title="凭据" className="ai-assets-editor-section">
        <Form.Item name="requires_credential" valuePropName="checked" noStyle>
          <Checkbox>需要凭据（绑定到 Agent 时必须选择凭据槽）</Checkbox>
        </Form.Item>
      </Card>

      <FormSubmitButton submitText="创建 MCP" loading={submitting} onCancel={onCancel} />
    </Form>
  );
}
