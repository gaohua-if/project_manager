// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the usage pattern, not the mock labels.

import { Form, Input } from "antd";

import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { ParameterListField } from "@/shared/components/FormPatterns/ParameterListField";
import { TwoColumnFormLayout } from "@/shared/components/FormPatterns/TwoColumnFormLayout";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";

interface FormValues {
  name: string;
  description?: string;
}

export function FormPatternsReference() {
  const [form] = Form.useForm<FormValues>();

  return (
    <PagePanel title="新建资源" backTo="/resources">
      <FormPageWrap>
        <Form form={form} layout="vertical">
          <TwoColumnFormLayout
            left={
              <>
                <Form.Item name="name" label="资源名称" rules={[{ required: true, message: "请输入资源名称" }]}>
                  <Input placeholder="请输入资源名称" />
                </Form.Item>
                <Form.Item name="description" label="描述">
                  <Input.TextArea rows={4} placeholder="请输入描述" />
                </Form.Item>
              </>
            }
            right={
              <>
                <ParameterListField name="env" label="环境变量" kind="env" />
                <ParameterListField name="inputs" label="输入参数" kind="input" />
                <ParameterListField name="outputs" label="输出参数" kind="output" />
              </>
            }
          />
          <FormSubmitButton loading={false} onCancel={() => undefined} />
        </Form>
      </FormPageWrap>
    </PagePanel>
  );
}
