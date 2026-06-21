import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Checkbox,
  DatePicker,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Typography
} from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import "../../aidashboard-pattern.css";
import { createTask, fetchRequirements, fetchUsers } from "../../api/client";
import type { Requirement, TaskPriority } from "../../api/types";
import type { User } from "@/shared/auth/types";
import { useAuth } from "@/shared/auth/authContext";
import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { useFormLeaveConfirm } from "@/shared/hooks/useFormLeaveConfirm";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/request/apiError";
import { buildCreateSuccessUrl } from "@/shared/utils/urlQuery";

const { Text } = Typography;

interface CreateTaskFormValues {
  title: string;
  requirement_id: string;
  assignee_id: string;
  priority: TaskPriority;
  due_date?: dayjs.Dayjs;
  acceptance_criteria_ids: number[];
}

export function TaskCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<CreateTaskFormValues>();
  const [formError, setFormError] = useState<string>();
  const backTo = buildCreateSuccessUrl("/tasks", location.search);

  const requirementsQuery = useQuery<Requirement[]>({
    queryKey: ["requirements"],
    queryFn: () => fetchRequirements(),
    staleTime: 60_000
  });
  const usersQuery = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
    staleTime: 5 * 60_000
  });

  const requirements = requirementsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const teamEmployees = users.filter((u) => u.role === "employee" && u.team_id === user?.team_id);
  const selectedRequirementId = Form.useWatch("requirement_id", form);
  const selectedRequirement = requirements.find((r) => r.id === selectedRequirementId);

  const createMutation = useMutation({
    mutationFn: (values: CreateTaskFormValues) =>
      createTask({
        requirement_id: values.requirement_id,
        title: values.title.trim(),
        acceptance_criteria_ids: values.acceptance_criteria_ids ?? [],
        assignee_id: values.assignee_id,
        priority: values.priority,
        due_date: values.due_date ? values.due_date.format("YYYY-MM-DD") : undefined
      })
  });
  const submitting = createMutation.isPending;
  const { markClean, markDirty, confirmLeave } = useFormLeaveConfirm({ form, submitting });
  const handleNavigate = (url: string) => confirmLeave(() => navigate(url));
  const handleCancel = () => handleNavigate(backTo);

  useEffect(() => {
    form.setFieldsValue({ priority: "medium", acceptance_criteria_ids: [] });
    markClean();
  }, [form, markClean]);

  const handleSubmit = async (values: CreateTaskFormValues) => {
    setFormError(undefined);
    try {
      await createMutation.mutateAsync(values);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
      setFormError(getApiErrorMessage(error, "创建任务失败，请稍后重试"));
    }
  };

  return (
    <PagePanel
      title="创建任务"
      description="将需求拆解为可执行任务，并分配负责人和验收标准"
      className="aidashboard-form-page"
      backTo={backTo}
      onBack={handleCancel}
      onNavigate={handleNavigate}
      breadcrumbs={[{ title: "任务", path: "/tasks" }, { title: "创建任务" }]}
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
                <h2>任务信息</h2>
                <p>把需求拆解为可执行任务,并为每条任务关联负责人和验收标准。</p>
              </div>
              <div className="aidashboard-form__grid">
                <Form.Item
                  className="aidashboard-form__full-row"
                  label="任务标题"
                  name="title"
                  rules={[{ required: true, message: "请输入标题" }]}
                >
                  <Input className="form-item-box" placeholder="例如：实现 API 分页" />
                </Form.Item>
                <Form.Item
                  label="所属需求"
                  name="requirement_id"
                  rules={[{ required: true, message: "请选择需求" }]}
                >
                  <Select
                    className="form-item-box"
                    placeholder={requirementsQuery.isError ? "需求加载失败" : "选择需求"}
                    loading={requirementsQuery.isLoading}
                    disabled={requirementsQuery.isLoading || requirementsQuery.isError}
                    showSearch
                    optionFilterProp="label"
                    options={requirements.map((r) => ({ value: r.id, label: r.title }))}
                  />
                </Form.Item>
                <Form.Item
                  label="负责人"
                  name="assignee_id"
                  rules={[{ required: true, message: "请选择负责人" }]}
                >
                  <Select
                    className="form-item-box"
                    placeholder={usersQuery.isError ? "成员加载失败" : "选择工程师"}
                    loading={usersQuery.isLoading}
                    disabled={usersQuery.isLoading || usersQuery.isError}
                    options={teamEmployees.map((u) => ({
                      value: u.id,
                      label: `${u.name} (${u.employee_id})`
                    }))}
                  />
                </Form.Item>
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
                      { value: "high", label: "高" }
                    ]}
                  />
                </Form.Item>
                <Form.Item label="截止日期" name="due_date">
                  <DatePicker className="form-item-box" />
                </Form.Item>
              </div>
            </section>

            {selectedRequirement && selectedRequirement.acceptance_criteria.length > 0 ? (
              <section className="aidashboard-form__section">
                <div className="aidashboard-form__section-head">
                  <h2>关联 AC</h2>
                  <p>选中的 AC 完成后,需求进度会自动累加。</p>
                </div>
                <Form.Item label="关联 AC" name="acceptance_criteria_ids">
                  <Checkbox.Group style={{ width: "100%" }}>
                    <Space direction="vertical" wrap>
                      {selectedRequirement.acceptance_criteria.map((ac, i) => (
                        <Checkbox key={i} value={i}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            AC{i + 1}
                          </Text>{" "}
                          <Text style={{ fontSize: 12 }}>{ac}</Text>
                        </Checkbox>
                      ))}
                    </Space>
                  </Checkbox.Group>
                </Form.Item>
              </section>
            ) : null}

            <FormSubmitButton
              submitText="创建并分配"
              loading={submitting}
              disabled={
                requirementsQuery.isLoading ||
                usersQuery.isLoading ||
                requirementsQuery.isError ||
                usersQuery.isError
              }
              onCancel={handleCancel}
              sticky
            />
          </Form>
        </Spin>
      </FormPageWrap>
    </PagePanel>
  );
}
