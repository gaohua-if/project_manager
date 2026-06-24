import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, DatePicker, Form, Input, Result, Select, Spin } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { useFormLeaveConfirm } from "@/shared/hooks/useFormLeaveConfirm";
import { buildCreateSuccessUrl } from "@/shared/utils/urlQuery";

import "../../aidashboard-pattern.css";
import { requirementsBoardMockApi } from "../mock/requirementsBoardMockApi";
import type { MockRequirement, RequirementPriority } from "../mock/types";

interface CreateFormValues {
  title: string;
  description: string;
  priority: RequirementPriority;
  deadline?: dayjs.Dayjs;
  team_ids: string[];
  feishu_doc_url?: string;
  acceptance_criteria: string;
}

export function RequirementCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<CreateFormValues>();
  const [formError, setFormError] = useState<string>();
  const [createdRequirement, setCreatedRequirement] = useState<MockRequirement>();
  const backTo = buildCreateSuccessUrl("/requirements", location.search);

  const teamsQuery = useQuery({
    queryKey: ["requirements-board", "teams"],
    queryFn: () => requirementsBoardMockApi.listTeams(),
    staleTime: 5 * 60_000
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateFormValues) =>
      requirementsBoardMockApi.createRequirement({
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        deadline: values.deadline?.format("YYYY-MM-DD"),
        team_ids: values.team_ids,
        feishu_doc_url: values.feishu_doc_url?.trim() || undefined,
        acceptance_criteria: values.acceptance_criteria
          .split("\n")
          .map((item) => item.replace(/^\s*\d+[.、]\s*/, "").trim())
          .filter(Boolean)
      })
  });
  const submitting = createMutation.isPending;
  const { markClean, markDirty, confirmLeave } = useFormLeaveConfirm({ form, submitting });
  const handleNavigate = (url: string) => confirmLeave(() => navigate(url));
  const handleCancel = () => handleNavigate(backTo);

  useEffect(() => {
    form.setFieldsValue({ priority: "medium", acceptance_criteria: "" });
    markClean();
  }, [form, markClean]);

  const handleSubmit = async (values: CreateFormValues) => {
    setFormError(undefined);
    try {
      const created = await createMutation.mutateAsync(values);
      await queryClient.invalidateQueries({ queryKey: ["requirements-board"] });
      markClean();
      setCreatedRequirement(created);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "创建需求失败，请稍后重试");
    }
  };

  if (createdRequirement) {
    return (
      <PagePanel
        title="需求已创建"
        description="下一步将需求拆解为可执行任务"
        className="aidashboard-form-page"
        breadcrumbs={[
          { title: "业务" },
          { title: "需求看板", path: "/requirements" },
          { title: "需求已创建" }
        ]}
      >
        <FormPageWrap className="aidashboard-form-wrap" maxWidth="100%" density="cozy" card>
          <Result
            status="success"
            title="需求创建成功"
            subTitle={`“${createdRequirement.title}”已进入待开始阶段。继续拆分任务后，团队才能开始推进。`}
            extra={[
              <Button
                key="split"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() =>
                  navigate(
                    `/tasks/create?requirement_id=${encodeURIComponent(createdRequirement.id)}`
                  )
                }
              >
                继续拆分任务
              </Button>,
              <Button key="board" onClick={() => navigate(backTo)}>
                返回需求看板
              </Button>
            ]}
          />
        </FormPageWrap>
      </PagePanel>
    );
  }

  return (
    <PagePanel
      title="新建需求"
      description="定义业务目标、验收标准和参与团队"
      className="aidashboard-form-page"
      backTo={backTo}
      onBack={handleCancel}
      onNavigate={handleNavigate}
      breadcrumbs={[
        { title: "业务" },
        { title: "需求看板", path: "/requirements" },
        { title: "新建需求" }
      ]}
    >
      <FormPageWrap className="aidashboard-form-wrap" maxWidth="100%" density="cozy" card>
        <Spin spinning={submitting}>
          {formError ? (
            <Alert className="aidashboard-form__error" type="error" showIcon message={formError} />
          ) : null}
          {teamsQuery.isError ? (
            <Alert
              className="aidashboard-form__error"
              type="error"
              showIcon
              message="参与团队加载失败"
              description="团队数据是创建需求的必填信息，请重试后继续。"
              action={<Button onClick={() => void teamsQuery.refetch()}>重试</Button>}
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
                <p>说明需求背景、目标与交付范围。</p>
              </div>
              <div className="aidashboard-form__grid">
                <Form.Item
                  className="aidashboard-form__full-row"
                  label="标题"
                  name="title"
                  rules={[{ required: true, whitespace: true, message: "请输入标题" }]}
                >
                  <Input placeholder="例如：控制台日报任务进展上报" />
                </Form.Item>
                <Form.Item
                  className="aidashboard-form__full-row"
                  label="描述"
                  name="description"
                  rules={[{ required: true, whitespace: true, message: "请输入描述" }]}
                >
                  <Input.TextArea rows={5} placeholder="详细描述需求背景、目标和范围" />
                </Form.Item>
              </div>
            </section>

            <section className="aidashboard-form__section">
              <div className="aidashboard-form__section-head">
                <h2>验收标准</h2>
                <p>逐条定义可验证的完成条件，后续任务可以关联这些标准。</p>
              </div>
              <Form.Item
                label="验收标准"
                name="acceptance_criteria"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "请填写验收标准"
                  }
                ]}
              >
                <Input.TextArea
                  rows={7}
                  placeholder={"1. 用户可以完成日报生成并发送\n2. 已关联 Token 来源能正确进入任务证据\n3. 异常情况下有明确提示"}
                />
              </Form.Item>
            </section>

            <section className="aidashboard-form__section">
              <div className="aidashboard-form__section-head">
                <h2>交付信息</h2>
                <p>设定优先级、截止日期和参与团队。</p>
              </div>
              <div className="aidashboard-form__grid aidashboard-form__grid--simple">
                <Form.Item
                  label="优先级"
                  name="priority"
                  rules={[{ required: true, message: "请选择优先级" }]}
                >
                  <Select
                    options={[
                      { value: "low", label: "低" },
                      { value: "medium", label: "中" },
                      { value: "high", label: "高" },
                      { value: "urgent", label: "紧急" }
                    ]}
                  />
                </Form.Item>
                <Form.Item label="截止日期" name="deadline">
                  <DatePicker />
                </Form.Item>
                <Form.Item
                  label="飞书文档"
                  name="feishu_doc_url"
                  rules={[{ type: "url", message: "请输入有效的文档链接" }]}
                >
                  <Input placeholder="https://..." />
                </Form.Item>
              </div>
              <Form.Item
                label="参与团队"
                name="team_ids"
                rules={[{ required: true, message: "至少选择一个团队", type: "array", min: 1 }]}
              >
                <Select
                  mode="multiple"
                  loading={teamsQuery.isLoading}
                  disabled={teamsQuery.isLoading || teamsQuery.isError}
                  placeholder={teamsQuery.isError ? "团队加载失败" : "选择团队"}
                  options={(teamsQuery.data ?? []).map((team) => ({
                    value: team.id,
                    label: team.name
                  }))}
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
