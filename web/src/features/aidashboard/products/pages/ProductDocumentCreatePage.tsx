import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Form, Input, Select, Spin } from "antd";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import "../../aidashboard-pattern.css";
import { createDocument, fetchTasks } from "../../api/client";
import type { Task } from "../../api/types";
import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { useFormLeaveConfirm } from "@/shared/hooks/useFormLeaveConfirm";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/request/apiError";
import { buildCreateSuccessUrl } from "@/shared/utils/urlQuery";

interface DocFormValues {
  title: string;
  url: string;
  description?: string;
  task_id?: string;
}

export function ProductDocumentCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<DocFormValues>();
  const [formError, setFormError] = useState<string>();
  const backTo = buildCreateSuccessUrl("/products", location.search);

  const tasksQuery = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
    staleTime: 60_000
  });

  const createMutation = useMutation({
    mutationFn: (values: DocFormValues) =>
      createDocument({
        title: values.title.trim(),
        url: values.url.trim(),
        description: values.description?.trim() || undefined,
        task_id: values.task_id || undefined
      })
  });
  const submitting = createMutation.isPending;
  const { markClean, markDirty, confirmLeave } = useFormLeaveConfirm({ form, submitting });
  const handleNavigate = (url: string) => confirmLeave(() => navigate(url));
  const handleCancel = () => handleNavigate(backTo);

  const handleSubmit = async (values: DocFormValues) => {
    setFormError(undefined);
    try {
      await createMutation.mutateAsync(values);
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      markClean();
      navigate(backTo, { replace: true });
    } catch (error) {
      const fieldErrors = getApiFieldErrors(error);
      if (fieldErrors.length > 0) {
        form.setFields(
          fieldErrors.map((item) => ({ name: item.field, errors: [item.message] })) as Parameters<
            typeof form.setFields
          >[0]
        );
        return;
      }
      setFormError(getApiErrorMessage(error, "添加文档失败，请稍后重试"));
    }
  };

  return (
    <PagePanel
      title="添加文档"
      description="沉淀工作文档并按需关联到任务"
      className="aidashboard-form-page"
      backTo={backTo}
      onBack={handleCancel}
      onNavigate={handleNavigate}
      breadcrumbs={[{ title: "我的工作", path: "/products" }, { title: "添加文档" }]}
    >
      <FormPageWrap className="aidashboard-form-wrap" maxWidth="100%" density="cozy" card>
        <Spin spinning={submitting}>
          {formError ? (
            <Alert
              className="aidashboard-form__error"
              type="error"
              showIcon
              message={formError}
            />
          ) : null}
          <Form
            form={form}
            labelCol={{ flex: "104px" }}
            wrapperCol={{ flex: "1" }}
            labelAlign="left"
            onFinish={handleSubmit}
            onValuesChange={markDirty}
            onFieldsChange={markDirty}
          >
            <section className="aidashboard-form__section">
              <div className="aidashboard-form__section-head">
                <h2>文档信息</h2>
                <p>沉淀工作文档,关联任务后会出现在「我的工作」对应任务下。</p>
              </div>
              <Form.Item
                label="标题"
                name="title"
                rules={[{ required: true, message: "请输入标题" }]}
              >
                <Input className="form-item-box" placeholder="文档标题" />
              </Form.Item>
              <Form.Item
                label="URL"
                name="url"
                rules={[{ required: true, message: "请输入 URL" }]}
              >
                <Input className="form-item-box" placeholder="https://..." />
              </Form.Item>
              <Form.Item label="描述（可选）" name="description">
                <Input className="form-item-box" placeholder="文档说明" />
              </Form.Item>
              <Form.Item
                label="关联任务"
                name="task_id"
                extra={tasksQuery.isError ? "任务列表加载失败,可先不关联任务。" : undefined}
              >
                <Select
                  className="form-item-box"
                  allowClear
                  loading={tasksQuery.isLoading}
                  disabled={tasksQuery.isLoading || tasksQuery.isError}
                  placeholder={
                    tasksQuery.isError
                      ? "任务加载失败"
                      : tasksQuery.isLoading
                        ? "任务加载中..."
                        : "无关联任务"
                  }
                  options={(tasksQuery.data ?? []).map((t) => ({ value: t.id, label: t.title }))}
                />
              </Form.Item>
            </section>
            <FormSubmitButton
              submitText="添加"
              loading={submitting}
              onCancel={handleCancel}
              sticky
            />
          </Form>
        </Spin>
      </FormPageWrap>
    </PagePanel>
  );
}
