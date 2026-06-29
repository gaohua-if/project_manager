import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Form, Result, Select, Spin } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import "../../aidashboard-pattern.css";
import { adminUpdateUser, fetchTeams, fetchUsers } from "../../api/client";
import { UserHero } from "../components/UserHero";
import { useAuth } from "@/shared/auth/authContext";
import { ROLE_LABELS, type UserRole } from "@/shared/auth/types";
import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { useFormLeaveConfirm } from "@/shared/hooks/useFormLeaveConfirm";
import { getApiErrorMessage, getApiFieldErrors } from "@/shared/request/apiError";
import { buildListReturnUrl } from "@/shared/utils/urlQuery";

interface EditFormValues {
  role: UserRole;
  team_id: string;
}

const ROLE_TONE_DOT: Record<UserRole, string> = {
  admin: "#dc2626",
  director: "#2563eb",
  pm: "#7c3aed",
  team_leader: "#d97706",
  employee: "#059669"
};

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "employee", label: ROLE_LABELS.employee },
  { value: "team_leader", label: ROLE_LABELS.team_leader },
  { value: "pm", label: ROLE_LABELS.pm },
  { value: "director", label: ROLE_LABELS.director },
  { value: "admin", label: ROLE_LABELS.admin }
];

function ResultPanel({
  status,
  title,
  subTitle,
  backTo
}: {
  status: "403" | "404";
  title: string;
  subTitle: string;
  backTo: string;
}) {
  return (
    <PagePanel
      title="编辑成员"
      className="aidashboard-form-page"
      backTo={backTo}
      breadcrumbs={[{ title: "组织", path: "/organization" }, { title: "编辑成员" }]}
    >
      <div className="org-result-wrap">
        <Result status={status} title={title} subTitle={subTitle} />
      </div>
    </PagePanel>
  );
}

export function OrganizationUserEditPage() {
  const { id = "" } = useParams<{ id: string }>();
  const targetUserId = Number(id);
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<EditFormValues>();
  const [formError, setFormError] = useState<string>();
  const backTo = buildListReturnUrl("/organization", location.search);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
    staleTime: 60_000
  });
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeams(),
    staleTime: 5 * 60_000
  });
  const editingUser = usersQuery.data?.find((u) => u.id === targetUserId);

  const updateMutation = useMutation({
    mutationFn: (values: EditFormValues) => {
      if (!editingUser) throw new Error("用户不存在");
      const payload: { role?: UserRole; team_id?: string; clear_team?: boolean } = {};
      if (values.role !== editingUser.role) payload.role = values.role;
      if (values.team_id !== (editingUser.team_id || "")) {
        if (values.team_id === "") payload.clear_team = true;
        else payload.team_id = values.team_id;
      }
      return adminUpdateUser(editingUser.id, payload);
    }
  });
  const submitting = updateMutation.isPending;
  const { markClean, markDirty, confirmLeave } = useFormLeaveConfirm({ form, submitting });
  const handleNavigate = (url: string) => confirmLeave(() => navigate(url));
  const handleCancel = () => handleNavigate(backTo);

  useEffect(() => {
    if (editingUser) {
      form.setFieldsValue({ role: editingUser.role, team_id: editingUser.team_id || "" });
      markClean();
    }
  }, [editingUser, form, markClean]);

  const handleSubmit = async (values: EditFormValues) => {
    setFormError(undefined);
    try {
      await updateMutation.mutateAsync(values);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
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
      setFormError(getApiErrorMessage(error, "保存失败，请稍后重试"));
    }
  };

  if (currentUser?.role !== "admin") {
    return (
      <ResultPanel
        status="403"
        title="暂无权限"
        subTitle="仅管理员可编辑用户角色和团队。"
        backTo={backTo}
      />
    );
  }

  if (usersQuery.isLoading || teamsQuery.isLoading) return <PageSkeleton rows={8} />;

  if (!editingUser) {
    return (
      <ResultPanel
        status="404"
        title="用户不存在"
        subTitle="该用户可能已被删除。"
        backTo={backTo}
      />
    );
  }

  if (editingUser.id === currentUser.id) {
    return (
      <ResultPanel
        status="403"
        title="不能编辑自己"
        subTitle="请使用其他管理员账号调整当前账号。"
        backTo={backTo}
      />
    );
  }

  return (
    <PagePanel
      title="编辑成员"
      description={editingUser.name}
      className="aidashboard-form-page"
      backTo={backTo}
      onBack={handleCancel}
      onNavigate={handleNavigate}
      breadcrumbs={[
        { title: "组织", path: "/organization" },
        { title: "编辑成员" },
        { title: editingUser.name }
      ]}
    >
      <UserHero user={editingUser} />
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
                <h2>成员权限</h2>
                <p>调整角色和团队会立即影响该成员可见的需求/任务范围。</p>
              </div>
              <Form.Item
                label="角色"
                name="role"
                rules={[{ required: true, message: "请选择角色" }]}
              >
                <Select
                  className="form-item-box"
                  options={ROLE_OPTIONS}
                  optionRender={(opt) => (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: ROLE_TONE_DOT[opt.data.value as UserRole]
                        }}
                      />
                      {opt.label}
                    </span>
                  )}
                />
              </Form.Item>
              <Form.Item label="团队" name="team_id">
                <Select
                  className="form-item-box"
                  options={[
                    { value: "", label: "无团队" },
                    ...(teamsQuery.data ?? []).map((t) => ({ value: t.id, label: t.name }))
                  ]}
                />
              </Form.Item>
            </section>
            <FormSubmitButton
              submitText="保存"
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
