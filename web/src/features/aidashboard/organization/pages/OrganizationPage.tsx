import {
  CrownOutlined,
  EditOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Alert, Button, Empty, Form, Input, Modal, Select, message } from "antd";
import type { TableProps } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import "../../aidashboard-pattern.css";
import {
  adminCreateTeam,
  adminCreateUser,
  adminUpdateUserStatus,
  fetchTeams,
  fetchUsers
} from "../../api/client";
import type { Team } from "../../api/types";
import {
  RequirementMetricCard,
  RequirementMetricGrid,
  type RequirementMetricTone
} from "../../requirements/components/RequirementMetricCard";
import { useAuth } from "@/shared/auth/authContext";
import { ROLE_LABELS, type User, type UserRole } from "@/shared/auth/types";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { getApiErrorMessage } from "@/shared/request/apiError";
import { ResourceActions, ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";
import { TableLayout } from "@/shared/components/TableLayout/TableLayout";

import "./OrganizationPage.css";

const ROLE_ORDER: UserRole[] = ["admin", "director", "pm", "team_leader", "employee"];

const ROLE_TONE: Record<UserRole, RequirementMetricTone> = {
  admin: "danger",
  director: "primary",
  pm: "info",
  team_leader: "warning",
  employee: "success"
};

const ROLE_ICON: Record<UserRole, JSX.Element> = {
  admin: <SafetyCertificateOutlined />,
  director: <CrownOutlined />,
  pm: <SolutionOutlined />,
  team_leader: <TeamOutlined />,
  employee: <UserOutlined />
};

const ROLE_DESCRIPTION: Record<UserRole, string> = {
  admin: "可调整任何用户的角色与团队",
  director: "可统揽全公司视图与全团队数据",
  pm: "推动需求，组织团队协作",
  team_leader: "对接团队成员的执行与交付",
  employee: "在所属团队内推进任务"
};

const ROLE_OPTIONS = ROLE_ORDER.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

interface CreateUserFormValues {
  employee_id: string;
  name: string;
  email: string;
  role: UserRole;
  team_id?: string;
  password: string;
}

interface CreateTeamFormValues {
  name: string;
}

const EMPTY_USERS: User[] = [];
const EMPTY_TEAMS: Team[] = [];

function initials(name: string) {
  if (!name) return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.length > 2 ? trimmed.slice(0, 2) : trimmed[0];
}

function avatarToneClass(role: UserRole) {
  if (role === "pm") return "is-pm";
  if (role === "team_leader") return "is-tl";
  return "is-employee";
}

export function OrganizationPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createUserError, setCreateUserError] = useState<string>();
  const [createTeamError, setCreateTeamError] = useState<string>();
  const [createUserForm] = Form.useForm<CreateUserFormValues>();
  const [createTeamForm] = Form.useForm<CreateTeamFormValues>();
  const isAdmin = currentUser?.role === "admin";
  const canView = Boolean(
    currentUser &&
      (isAdmin ||
        currentUser.role === "director" ||
        currentUser.role === "pm" ||
        currentUser.role === "team_leader")
  );

  const usersQuery = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
    enabled: canView,
    staleTime: 60_000
  });
  const teamsQuery = useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: () => fetchTeams(),
    enabled: canView,
    staleTime: 5 * 60_000
  });

  const users = usersQuery.data ?? EMPTY_USERS;
  const activeUsers = users.filter((u) => u.status !== "deactivated");
  const teams = teamsQuery.data ?? EMPTY_TEAMS;

  const createUserMutation = useMutation({
    mutationFn: (values: CreateUserFormValues) =>
      adminCreateUser({
        employee_id: values.employee_id.trim(),
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        role: values.role,
        team_id: values.team_id || undefined
      }),
    onSuccess: async () => {
      setCreateUserOpen(false);
      setCreateUserError(undefined);
      createUserForm.resetFields();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["teams"] })
      ]);
    },
    onError: (error) => setCreateUserError(getApiErrorMessage(error, "添加账号失败，请稍后重试"))
  });

  const createTeamMutation = useMutation({
    mutationFn: (values: CreateTeamFormValues) => adminCreateTeam({ name: values.name.trim() }),
    onSuccess: async () => {
      setCreateTeamOpen(false);
      setCreateTeamError(undefined);
      createTeamForm.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (error) => setCreateTeamError(getApiErrorMessage(error, "添加团队失败，请稍后重试"))
  });

  const updateUserStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "deactivated" }) =>
      adminUpdateUserStatus(id, status),
    onSuccess: async (_, variables) => {
      message.success(variables.status === "deactivated" ? "账号已停用" : "账号已启用");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => message.error(getApiErrorMessage(error, "账号状态更新失败，请稍后重试"))
  });

  const handleUpdateUserStatus = (target: User) => {
    const currentStatus = target.status ?? "active";
    const nextStatus = currentStatus === "deactivated" ? "active" : "deactivated";
    Modal.confirm({
      title: nextStatus === "deactivated" ? "停用账号" : "启用账号",
      content:
        nextStatus === "deactivated"
          ? `停用后，${target.name} 将不能登录，历史数据会保留。`
          : `启用后，${target.name} 可以重新登录。`,
      okText: nextStatus === "deactivated" ? "停用" : "启用",
      okButtonProps: { danger: nextStatus === "deactivated" },
      cancelText: "取消",
      onOk: () => updateUserStatusMutation.mutateAsync({ id: target.id, status: nextStatus })
    });
  };

  const roleCounts = useMemo(
    () =>
      ROLE_ORDER.map((role) => ({
        role,
        count: activeUsers.filter((u) => u.role === role).length
      })),
    [activeUsers]
  );

  const columns: TableProps<User>["columns"] = [
    {
      title: "工号",
      dataIndex: "employee_id",
      width: 140,
      render: (v: string) => <span className="org-employee-id">{v}</span>
    },
    {
      title: "姓名",
      dataIndex: "name",
      render: (_: string, record: User) => (
        <span className={`org-name-cell${record.status === "deactivated" ? " is-deactivated" : ""}`}>
          <span className={`org-name-cell__dot is-${record.role}`} aria-hidden="true" />
          <strong>{record.name}</strong>
        </span>
      )
    },
    {
      title: "邮箱",
      dataIndex: "email",
      render: (v: string) => <span style={{ color: "#7a879a" }}>{v || "-"}</span>
    },
    {
      title: "角色",
      dataIndex: "role",
      width: 120,
      render: (r: UserRole) => <span className={`org-role-tag is-${r}`}>{ROLE_LABELS[r]}</span>
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (status: User["status"]) => (
        <span className={`org-status-tag is-${status ?? "active"}`}>
          {status === "deactivated" ? "已停用" : "启用"}
        </span>
      )
    },
    { title: "团队", dataIndex: "team_name", width: 140, render: (v?: string) => v || "-" },
    ...(isAdmin
      ? [
          {
            title: "操作",
            key: "actions",
            width: 190,
            render: (_: unknown, u: User) => (
              <ResourceActions
                actions={[
                  {
                    key: "edit",
                    label: "编辑",
                    icon: <EditOutlined />,
                    disabled: u.id === currentUser?.id,
                    onClick: () => navigate(`/organization/users/${u.id}/edit`)
                  },
                  {
                    key: "reset",
                    label: "重置密码",
                    icon: <KeyOutlined />,
                    onClick: () => navigate(`/organization/users/${u.id}/reset-password`)
                  },
                  {
                    key: "status",
                    label: u.status === "deactivated" ? "启用" : "停用",
                    danger: u.status !== "deactivated",
                    disabled: u.id === currentUser?.id || updateUserStatusMutation.isPending,
                    onClick: () => handleUpdateUserStatus(u)
                  }
                ]}
              />
            )
          }
        ]
      : [])
  ];

  if (!canView) {
    return (
      <PagePanel title="组织" description="组织成员和团队信息" className="org-page" showNav={false}>
        <div className="org-empty-frame">
          <Empty description="仅管理员、总监、PM 和团队负责人可查看组织信息。" />
        </div>
      </PagePanel>
    );
  }

  const teamsLoading = teamsQuery.isLoading || usersQuery.isLoading;

  return (
    <>
      <PagePanel
        title="组织"
        description={isAdmin ? "管理员视图：可调整角色、团队、密码与账号状态" : "团队成员、活跃度统计"}
        className="org-page aidashboard-list"
        breadcrumbs={[{ title: "组织" }]}
        showNav={false}
        actions={
        <Button
          icon={<ReloadOutlined />}
          loading={usersQuery.isFetching || teamsQuery.isFetching}
          onClick={() => {
            void usersQuery.refetch();
            void teamsQuery.refetch();
          }}
        >
          刷新
        </Button>
      }
    >
      <RequirementMetricGrid>
        {roleCounts.map(({ role, count }) => (
          <RequirementMetricCard
            key={role}
            tone={ROLE_TONE[role]}
            icon={ROLE_ICON[role]}
            loading={usersQuery.isLoading}
            metric={{
              key: role,
              title: ROLE_LABELS[role],
              value: count,
              description: ROLE_DESCRIPTION[role]
            }}
          />
        ))}
      </RequirementMetricGrid>

      <section className="org-team-section">
        <div className="org-team-section__head">
          <div className="org-section-title">
            <strong>团队</strong>
            <span>{teams.length} 个团队 · {activeUsers.length} 名启用成员</span>
          </div>
          {isAdmin ? (
            <Button size="small" icon={<PlusOutlined />} onClick={() => setCreateTeamOpen(true)}>
              添加团队
            </Button>
          ) : null}
        </div>
        {teamsLoading ? (
          <Empty description="加载中" />
        ) : teams.length === 0 ? (
          <Empty description="暂无团队" />
        ) : (
          <div className="org-team-grid">
            {teams.map((team) => {
              const members = users.filter((u) => u.team_id === team.id && u.status !== "deactivated");
              const leaders = members.filter((u) => u.role === "team_leader");
              const engineers = members.filter((u) => u.role === "employee");
              const visibleMembers = members.slice(0, 5);
              const hidden = members.length - visibleMembers.length;
              return (
                <article className="org-team-card" key={team.id}>
                  <header className="org-team-card__head">
                    <span className="org-team-card__name">{team.name}</span>
                    <span className="org-team-card__count">
                      <strong>{members.length}</strong> 成员
                    </span>
                  </header>
                  <div className="org-team-card__row">
                    <span className="org-team-card__row-label">TL</span>
                    {leaders.length ? (
                      <span>{leaders.map((l) => l.name).join("、")}</span>
                    ) : (
                      <span className="org-team-card__empty">未分配</span>
                    )}
                  </div>
                  <div className="org-team-card__row">
                    <span className="org-team-card__row-label">人员</span>
                    {members.length ? (
                      <span className="org-team-card__avatars">
                        {visibleMembers.map((m) => (
                          <span
                            key={m.id}
                            className={`org-team-card__avatar ${avatarToneClass(m.role)}`}
                            title={`${m.name}（${ROLE_LABELS[m.role]}）`}
                          >
                            {initials(m.name)}
                          </span>
                        ))}
                        {hidden > 0 ? <span className="org-team-card__more">+{hidden}</span> : null}
                      </span>
                    ) : (
                      <span className="org-team-card__empty">暂无成员</span>
                    )}
                  </div>
                  <div className="org-team-card__row">
                    <span className="org-team-card__row-label">工程师</span>
                    <span>{engineers.length} 人</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <TableLayout
        operations={
          isAdmin ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateUserOpen(true)}>
              添加账号
            </Button>
          ) : undefined
        }
      >
        {usersQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="成员列表加载失败"
            description={
              usersQuery.error instanceof Error ? usersQuery.error.message : "请稍后重试"
            }
            action={<Button onClick={() => void usersQuery.refetch()}>重试</Button>}
          />
        ) : null}
        <ResourceTable<User>
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={usersQuery.isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
        />
      </TableLayout>
    </PagePanel>

      <Modal
        title="添加账号"
        open={createUserOpen}
        confirmLoading={createUserMutation.isPending}
        okText="创建"
        cancelText="取消"
        onCancel={() => {
          setCreateUserOpen(false);
          setCreateUserError(undefined);
          createUserForm.resetFields();
        }}
        onOk={() => createUserForm.submit()}
        destroyOnHidden
      >
        {createUserError ? (
          <Alert type="error" showIcon message={createUserError} className="org-modal-alert" />
        ) : null}
        <Form
          form={createUserForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ role: "employee", team_id: "" }}
          onFinish={(values) => void createUserMutation.mutateAsync(values)}
          onValuesChange={() => setCreateUserError(undefined)}
        >
          <Form.Item
            label="工号 / 登录账号"
            name="employee_id"
            rules={[{ required: true, message: "请输入工号" }]}
          >
            <Input autoComplete="username" placeholder="例如 zhangsan" />
          </Form.Item>
          <Form.Item label="姓名" name="name" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: "请输入邮箱" },
              { type: "email", message: "邮箱格式不正确" }
            ]}
          >
            <Input autoComplete="email" placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true, message: "请选择角色" }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item label="所属团队" name="team_id">
            <Select
              options={[
                { value: "", label: "无团队" },
                ...teams.map((team) => ({ value: team.id, label: team.name }))
              ]}
            />
          </Form.Item>
          <Form.Item
            label="初始密码"
            name="password"
            rules={[
              { required: true, message: "请输入初始密码" },
              { min: 8, message: "密码至少 8 位" }
            ]}
          >
            <Input.Password autoComplete="new-password" placeholder="至少 8 位" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="添加团队"
        open={createTeamOpen}
        confirmLoading={createTeamMutation.isPending}
        okText="创建"
        cancelText="取消"
        onCancel={() => {
          setCreateTeamOpen(false);
          setCreateTeamError(undefined);
          createTeamForm.resetFields();
        }}
        onOk={() => createTeamForm.submit()}
        destroyOnHidden
      >
        {createTeamError ? (
          <Alert type="error" showIcon message={createTeamError} className="org-modal-alert" />
        ) : null}
        <Form
          form={createTeamForm}
          layout="vertical"
          requiredMark={false}
          onFinish={(values) => void createTeamMutation.mutateAsync(values)}
          onValuesChange={() => setCreateTeamError(undefined)}
        >
          <Form.Item label="团队名称" name="name" rules={[{ required: true, message: "请输入团队名称" }]}>
            <Input placeholder="请输入团队名称" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
