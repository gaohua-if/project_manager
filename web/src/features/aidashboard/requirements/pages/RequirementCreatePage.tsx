import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, DatePicker, Form, Input, Select, Spin } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import "../../aidashboard-pattern.css";
import { createRequirement, fetchTeams } from "../../api/client";
import type { RequirementPriority } from "../../api/types";
import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { useFormLeaveConfirm } from "@/shared/hooks/useFormLeaveConfirm";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/request/apiError";
import { buildCreateSuccessUrl } from "@/shared/utils/urlQuery";

interface CreateFormValues {
  title: string;
  description: string;
  priority: RequirementPriority;
  deadline?: dayjs.Dayjs;
  team_ids: string[];
  feishu_doc_url?: string;
}

export function RequirementCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<CreateFormValues>();
  const [formError, setFormError] = useState<string>();
  const backTo = buildCreateSuccessUrl("/requirements", location.search);

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeams(),
    staleTime: 5 * 60_000
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateFormValues) =>
      createRequirement({
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        deadline: values.deadline ? values.deadline.format("YYYY-MM-DD") : undefined,
        team_ids: values.team_ids,
        feishu_doc_url: values.feishu_doc_url?.trim() || undefined
      })
  });
  const submitting = createMutation.isPending;
  const { markClean, markDirty, confirmLeave } = useFormLeaveConfirm({ form, submitting });
  const handleNavigate = (url: string) => confirmLeave(() => navigate(url));
  const handleCancel = () => handleNavigate(backTo);

  useEffect(() => {
    form.setFieldsValue({ priority: "medium" });
    markClean();
  }, [form, markClean]);

  const handleSubmit = async (values: CreateFormValues) => {
    setFormError(undefined);
    try {
      await createMutation.mutateAsync(values);
      void queryClient.invalidateQueries({ queryKey: ["requirements"] });
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
      setFormError(getApiErrorMessage(error, "创建需求失败，请稍后重试"));
    }
  };

  return (
    <PagePanel
      title="新建需求"
      description="按业务目标录入需求、参与团队和验收标准生成线索"
      className="aidashboard-form-page"
      backTo={backTo}
      onBack={handleCancel}
      onNavigate={handleNavigate}
      breadcrumbs={[{ title: "需求", path: "/requirements" }, { title: "新建需求" }]}
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
                <h2>基础信息</h2>
                <p>录入需求标题与目标描述,用于后续生成验收标准。</p>
              </div>
              <div className="aidashboard-form__grid">
                <Form.Item
                  className="aidashboard-form__full-row"
                  label="标题"
                  name="title"
                  rules={[{ required: true, message: "请输入标题" }]}
                >
                  <Input className="form-item-box" placeholder="例如：REQ-001 AI 平台 v3.0" />
                </Form.Item>
                <Form.Item
                  className="aidashboard-form__full-row"
                  label="描述"
                  name="description"
                  rules={[{ required: true, message: "请输入描述" }]}
                >
                  <Input.TextArea rows={5} placeholder="详细描述需求背景、目标和范围" />
                </Form.Item>
              </div>
            </section>

            <section className="aidashboard-form__section">
              <div className="aidashboard-form__section-head">
                <h2>交付信息</h2>
                <p>设定优先级和交付节奏,影响 dashboard 紧急 deadline 预警。</p>
              </div>
              <div className="aidashboard-form__grid aidashboard-form__grid--simple">
                <Form.Item
                  label="优先级"
                  name="priority"
                  rules={[{ required: true, message: "请选择优先级" }]}
                >
                  <Select
                    className="form-item-box"
                    options={[
                      { value: "low", label: "低" },
                      { value: "medium", label: "中" },
                      { value: "high", label: "高" },
                      { value: "urgent", label: "紧急" }
                    ]}
                  />
                </Form.Item>
                <Form.Item label="截止日期" name="deadline">
                  <DatePicker className="form-item-box" />
                </Form.Item>
                <Form.Item label="飞书文档" name="feishu_doc_url">
                  <Input className="form-item-box" placeholder="https://..." />
                </Form.Item>
              </div>
            </section>

            <section className="aidashboard-form__section">
              <div className="aidashboard-form__section-head">
                <h2>参与团队</h2>
                <p>跨团队需求会在总监 dashboard 中显示"跨团队进行中"。</p>
              </div>
              <Form.Item
                label="参与团队"
                name="team_ids"
                rules={[{ required: true, message: "至少选择一个团队", type: "array", min: 1 }]}
                extra={teamsQuery.isError ? "团队列表加载失败,请重试或刷新。" : undefined}
              >
                <Select
                  className="form-item-box"
                  mode="multiple"
                  loading={teamsQuery.isLoading}
                  disabled={teamsQuery.isLoading || teamsQuery.isError}
                  placeholder={teamsQuery.isError ? "团队加载失败" : "选择团队"}
                  options={(teamsQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))}
                />
              </Form.Item>
            </section>

            <FormSubmitButton
              submitText="创建需求"
              loading={submitting}
              disabled={teamsQuery.isLoading || teamsQuery.isError}
              onCancel={handleCancel}
              sticky
            />
          </Form>
        </Spin>
      </FormPageWrap>
    </PagePanel>
  );
}
