import { Card, Form, Input } from "antd";
import type { FormInstance } from "antd";

import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import type { CreateManagedSkillPayload } from "../../api/types";
import "./AgentWorkspace.css";

export interface SkillCreateFormValues {
  slug: string;
  version: string;
  name?: string;
  description?: string;
  skill_md: string;
}

interface SkillCreateFormProps {
  form: FormInstance<SkillCreateFormValues>;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateManagedSkillPayload) => void;
}

export function SkillCreateForm({ form, submitting, onCancel, onSubmit }: SkillCreateFormProps) {
  const handleSubmit = (values: SkillCreateFormValues) => {
    onSubmit({
      slug: values.slug.trim(),
      version: values.version.trim(),
      name: values.name?.trim() || undefined,
      description: values.description?.trim() || undefined,
      skill_md: values.skill_md.trim()
    });
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        version: "1.0.0",
        skill_md: "# My Skill\n\nDescribe when and how the agent should use this skill.\n"
      }}
      onFinish={handleSubmit}
    >
      <Card title="基础信息" className="ai-assets-editor-section">
        <div className="ai-assets-editor-grid">
          <Form.Item
            name="slug"
            label="Slug"
            rules={[{ required: true, message: "请输入 Slug" }]}
          >
            <Input placeholder="daily-summary" />
          </Form.Item>
          <Form.Item
            name="version"
            label="版本"
            rules={[{ required: true, message: "请输入版本" }]}
          >
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item name="name" label="显示名称（可选）">
            <Input placeholder="日报总结 Skill" />
          </Form.Item>
          <Form.Item name="description" label="描述（可选）" className="ai-assets-editor-grid__wide">
            <Input.TextArea rows={2} placeholder="这个 Skill 适合什么场景" />
          </Form.Item>
        </div>
      </Card>

      <Card title="SKILL.md" className="ai-assets-editor-section">
        <Form.Item
          name="skill_md"
          label="内容"
          rules={[{ required: true, message: "请输入 SKILL.md 内容" }]}
        >
          <Input.TextArea rows={16} placeholder="# My Skill" />
        </Form.Item>
      </Card>

      <FormSubmitButton submitText="创建 Skill" loading={submitting} onCancel={onCancel} />
    </Form>
  );
}
