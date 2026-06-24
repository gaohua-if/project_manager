import {
  CrownOutlined,
  EditOutlined,
  KeyOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Alert, Button, Empty } from "antd";
import type { TableProps } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import "../../aidashboard-pattern.css";
import { fetchTeams, fetchUsers } from "../../api/client";
import type { Team } from "../../api/types";
import {
  RequirementMetricCard,
  RequirementMetricGrid,
  type RequirementMetricTone
} from "../../requirements/components/RequirementMetricCard";
import { useAuth } from "@/shared/auth/authContext";
import { ROLE_LABELS, type User, type UserRole } from "@/shared/auth/types";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
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

  const users = usersQuery.data ?? [];
  const teams = teamsQuery.data ?? [];

  const roleCounts = useMemo(
    () =>
      ROLE_ORDER.map((role) => ({
        role,
        count: users.filter((u) => u.role === role).length
      })),
    [users]
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
        <span className="org-name-cell">
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
    <PagePanel
      title="组织"
      description={isAdmin ? "管理员视图：可调整任何用户的角色与团队" : "团队成员、活跃度统计"}
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
          <strong>团队</strong>
          <span>{teams.length} 个团队 · {users.length} 名成员</span>
        </div>
        {teamsLoading ? (
          <Empty description="加载中" />
        ) : teams.length === 0 ? (
          <Empty description="暂无团队" />
        ) : (
          <div className="org-team-grid">
            {teams.map((team) => {
              const members = users.filter((u) => u.team_id === team.id);
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

      <TableLayout>
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
  );
}
