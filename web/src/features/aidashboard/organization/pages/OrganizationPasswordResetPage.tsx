import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Form, Input, Result, Spin } from "antd";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import "../../aidashboard-pattern.css";
import { adminResetPassword, fetchUsers } from "../../api/client";
import { useAuth } from "@/shared/auth/authContext";
import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { useFormLeaveConfirm } from "@/shared/hooks/useFormLeaveConfirm";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/request/apiError";
import { buildListReturnUrl } from "@/shared/utils/urlQuery";

interface PasswordFormValues {
  password: string;
  confirm: string;
}

export function OrganizationPasswordResetPage() {
  const { id = "" } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm<PasswordFormValues>();
  const [formError, setFormError] = useState<string>();
  const backTo = buildListReturnUrl("/organization", location.search);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
    staleTime: 60_000
  });
  const targetUser = usersQuery.data?.find((u) => u.id === id);

  const resetMutation = useMutation({
    mutationFn: (values: PasswordFormValues) => adminResetPassword(id, values.password)
  });
  const submitting = resetMutation.isPending;
  const { markClean, markDirty, confirmLeave } = useFormLeaveConfirm({ form, submitting });
  const handleNavigate = (url: string) => confirmLeave(() => navigate(url));
  const handleCancel = () => handleNavigate(backTo);

  const handleSubmit = async (values: PasswordFormValues) => {
    setFormError(undefined);
    try {
      await resetMutation.mutateAsync(values);
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
      setFormError(getApiErrorMessage(error, "重置失败，请稍后重试"));
    }
  };

  if (currentUser?.role !== "admin") {
    return <Result status="403" title="暂无权限" subTitle="仅管理员可重置成员密码。" />;
  }

  if (usersQuery.isLoading) return <PageSkeleton rows={8} />;

  if (!targetUser)
    return <Result status="404" title="用户不存在" subTitle="该用户可能已被删除。" />;

  return (
    <PagePanel
      title="重置密码"
      description={targetUser.name}
      className="aidashboard-form-page"
      backTo={backTo}
      onBack={handleCancel}
      onNavigate={handleNavigate}
      breadcrumbs={[
        { title: "组织", path: "/organization" },
        { title: "重置密码" },
        { title: targetUser.name }
      ]}
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
                <h2>新密码</h2>
                <p>密码至少 8 位,重置成功后立即生效,成员需用新密码登录。</p>
              </div>
              <Form.Item
                label="新密码"
                name="password"
                rules={[
                  { required: true, message: "请输入新密码" },
                  { min: 8, message: "密码至少 8 位" }
                ]}
              >
                <Input.Password className="form-item-box" placeholder="至少 8 位" />
              </Form.Item>
              <Form.Item
                label="确认密码"
                name="confirm"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "请再次输入密码" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) return Promise.resolve();
                      return Promise.reject(new Error("两次输入的密码不一致"));
                    }
                  })
                ]}
              >
                <Input.Password className="form-item-box" placeholder="再次输入" />
              </Form.Item>
            </section>
            <FormSubmitButton
              submitText="确认重置"
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
