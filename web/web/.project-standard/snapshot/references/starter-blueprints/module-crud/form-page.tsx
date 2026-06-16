// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the pattern, not the mock data.
// Module CRUD does not provide a default standalone create route.
// Use this file only as an edit/configuration reference; use Table CRUD form variants for normal creation flows.

import { Alert, Form, Input, Result, Select, Spin } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { ParameterListField } from "@/shared/components/FormPatterns/ParameterListField";
import { TwoColumnFormLayout } from "@/shared/components/FormPatterns/TwoColumnFormLayout";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { useFormLeaveConfirm } from "@/shared/hooks/useFormLeaveConfirm";
import { buildCreateSuccessUrl, buildListReturnUrl } from "@/shared/utils/urlQuery";

import type { ModuleFormValues } from "./types";

export function ModuleFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [form] = Form.useForm<ModuleFormValues>();
  const [formError, setFormError] = useState<string>();
  const isEdit = Boolean(id);
  const backTo = buildListReturnUrl("/modules", location.search);

  // Replace these placeholders with feature query hooks.
  const detailQuery = {
    data: undefined as { data: ModuleFormValues } | undefined,
    isLoading: false,
    isError: false
  };
  const submitting = false;
  const { markClean, markDirty, confirmLeave } = useFormLeaveConfirm({ form, submitting });

  useEffect(() => {
    if (!isEdit) {
      form.setFieldsValue({ status: "draft", owner: "平台组", categoryId: "training" });
      markClean();
      return;
    }
    if (detailQuery.data?.data) {
      form.setFieldsValue(detailQuery.data.data);
      markClean();
    }
  }, [detailQuery.data, form, isEdit, markClean]);

  const handleSubmit = async (values: ModuleFormValues) => {
    void values;
    setFormError(undefined);
    markClean();
    navigate(id ? backTo : buildCreateSuccessUrl("/modules", location.search), { replace: true });
  };

  if (isEdit && detailQuery.isLoading) return <PageSkeleton rows={10} />;
  if (isEdit && detailQuery.isError)
    return <Result status="404" title="模块不存在" subTitle="当前模块不存在或已被删除" />;

  return (
    <PagePanel
      title={isEdit ? "编辑模块" : "创建模块"}
      description="复杂模块表单使用双栏布局"
      backTo={backTo}
      onBack={() => confirmLeave(() => navigate(backTo))}
      breadcrumbs={[
        { title: "模块管理", path: "/modules" },
        { title: isEdit ? "编辑模块" : "创建模块" }
      ]}
    >
      <FormPageWrap maxWidth="100%" density="cozy" card>
        <Spin spinning={submitting}>
          {formError && <Alert type="error" showIcon message={formError} />}
          <Form
            form={form}
            labelCol={{ flex: "132px" }}
            labelAlign="left"
            onFinish={handleSubmit}
            onValuesChange={markDirty}
            onFieldsChange={markDirty}
          >
            <TwoColumnFormLayout
              left={
                <>
                  <Form.Item
                    label="模块名称"
                    name="name"
                    rules={[{ required: true, message: "请输入模块名称" }]}
                  >
                    <Input placeholder="请输入模块名称" />
                  </Form.Item>
                  <Form.Item
                    label="分类"
                    name="categoryId"
                    rules={[{ required: true, message: "请选择分类" }]}
                  >
                    <Select
                      options={[
                        { label: "训练", value: "training" },
                        { label: "推理", value: "inference" }
                      ]}
                    />
                  </Form.Item>
                  <Form.Item
                    label="负责人"
                    name="owner"
                    rules={[{ required: true, message: "请选择负责人" }]}
                  >
                    <Select
                      options={["平台组", "算法组", "数据组"].map((value) => ({
                        label: value,
                        value
                      }))}
                    />
                  </Form.Item>
                  <Form.Item
                    label="镜像地址"
                    name="image"
                    rules={[{ required: true, message: "请输入镜像地址" }]}
                  >
                    <Input placeholder="registry.aihub.local/module:latest" />
                  </Form.Item>
                  <Form.Item
                    label="启动命令"
                    name="command"
                    rules={[{ required: true, message: "请输入启动命令" }]}
                  >
                    <Input.TextArea rows={4} placeholder="python main.py" />
                  </Form.Item>
                </>
              }
              right={
                <>
                  <ParameterListField name="envs" label="环境变量" kind="env" />
                  <ParameterListField name="inputs" label="输入参数" kind="input" />
                  <ParameterListField name="outputs" label="输出参数" kind="output" />
                </>
              }
            />
            <FormSubmitButton
              submitText={isEdit ? "保存模块" : "创建模块"}
              loading={submitting}
              onCancel={() => confirmLeave(() => navigate(backTo))}
            />
          </Form>
        </Spin>
      </FormPageWrap>
    </PagePanel>
  );
}
