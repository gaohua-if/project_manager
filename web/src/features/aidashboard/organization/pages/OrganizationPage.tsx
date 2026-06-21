import { EditOutlined, KeyOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Row, Space, Statistic, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import "../../aidashboard-pattern.css";
import { fetchTeams, fetchUsers } from "../../api/client";
import type { Team } from "../../api/types";
import { useAuth } from "@/shared/auth/authContext";
import { ROLE_LABELS, type User, type UserRole } from "@/shared/auth/types";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { ResourceActions, ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";
import { TableLayout } from "@/shared/components/TableLayout/TableLayout";

const { Text } = Typography;

const ROLE_ORDER: UserRole[] = ["admin", "director", "pm", "team_leader", "employee"];

const ROLE_CARD_TONE: Record<UserRole, string> = {
  admin: "#ff4d4f",
  director: "#1677ff",
  pm: "#722ed1",
  team_leader: "#faad14",
  employee: "#52c41a"
};

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
  const roleCounts = ROLE_ORDER.map((role) => ({
    role,
    count: users.filter((u) => u.role === role).length
  }));

  const columns: TableProps<User>["columns"] = [
    {
      title: "工号",
      dataIndex: "employee_id",
      width: 140,
      render: (v: string) => <Text code>{v}</Text>
    },
    { title: "姓名", dataIndex: "name", render: (v: string) => <Text strong>{v}</Text> },
    { title: "邮箱", dataIndex: "email", render: (v: string) => <Text type="secondary">{v}</Text> },
    {
      title: "角色",
      dataIndex: "role",
      width: 120,
      render: (r: UserRole) => <Tag color={ROLE_CARD_TONE[r]}>{ROLE_LABELS[r]}</Tag>
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
      <PagePanel title="组织" description="组织成员和团队信息">
        <Card>
          <Empty description="仅管理员、总监、PM 和团队负责人可查看组织信息。" />
        </Card>
      </PagePanel>
    );
  }

  return (
    <PagePanel
      title="组织"
      description={isAdmin ? "管理员视图：可调整任何用户的角色与团队。" : "团队成员、活跃度统计"}
      className="aidashboard-list"
      breadcrumbs={[{ title: "组织" }]}
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
      <Row gutter={[12, 12]}>
        {roleCounts.map(({ role, count }) => (
          <Col xs={12} md={8} lg={4} key={role}>
            <Card size="small" bodyStyle={{ padding: 16 }}>
              <Statistic
                title={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {ROLE_LABELS[role]}
                  </Text>
                }
                value={count}
                valueStyle={{ color: ROLE_CARD_TONE[role], fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="团队" size="small" loading={teamsQuery.isLoading || usersQuery.isLoading}>
        <Row gutter={[12, 12]}>
          {teams.map((team) => {
            const leaders = users.filter((u) => u.team_id === team.id && u.role === "team_leader");
            const engineers = users.filter((u) => u.team_id === team.id && u.role === "employee");
            return (
              <Col xs={24} md={12} lg={8} key={team.id}>
                <Card size="small" hoverable>
                  <Space direction="vertical" size={4} style={{ width: "100%" }}>
                    <Space style={{ width: "100%", justifyContent: "space-between" }}>
                      <Text strong>{team.name}</Text>
                      <Tag color="blue">{engineers.length} 名工程师</Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      TL: {leaders.length > 0 ? leaders.map((l) => l.name).join(", ") : "未分配"}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      工程师:{" "}
                      {engineers.length > 0 ? engineers.map((e) => e.name).join(", ") : "暂无"}
                    </Text>
                  </Space>
                </Card>
              </Col>
            );
          })}
          {teams.length === 0 ? (
            <Col span={24}>
              <Empty description="暂无团队" />
            </Col>
          ) : null}
        </Row>
      </Card>

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
