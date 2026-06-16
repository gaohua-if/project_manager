import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography
} from "antd";
import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { useState } from "react";

import {
  adminResetPassword,
  adminUpdateUser,
  fetchTeams,
  fetchUsers
} from "../../api/client";
import type { Team } from "../../api/types";
import { ROLE_LABELS, type User, type UserRole } from "@/shared/auth/types";
import { useAuth } from "@/shared/auth/authContext";

const { Title, Text } = Typography;

const ROLE_ORDER: UserRole[] = ["admin", "director", "pm", "team_leader", "employee"];

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "employee", label: "工程师" },
  { value: "team_leader", label: "团队负责人" },
  { value: "pm", label: "产品经理" },
  { value: "director", label: "部门总监" },
  { value: "admin", label: "管理员" }
];

const ROLE_CARD_TONE: Record<UserRole, string> = {
  admin: "#ff4d4f",
  director: "#1677ff",
  pm: "#722ed1",
  team_leader: "#faad14",
  employee: "#52c41a"
};

interface EditFormValues {
  role: UserRole;
  team_id: string;
}

interface PasswordFormValues {
  password: string;
  confirm: string;
}

export function OrganizationPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [editForm] = Form.useForm<EditFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();

  const isAdmin = currentUser?.role === "admin";
  const canView = Boolean(
    currentUser &&
      (isAdmin ||
        currentUser.role === "director" ||
        currentUser.role === "pm" ||
        currentUser.role === "team_leader")
  );

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
    enabled: canView,
    staleTime: 60_000
  });
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["teams"],
    queryFn: () => fetchTeams(),
    enabled: canView,
    staleTime: 5 * 60_000
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: EditFormValues }) => {
      const roleChanged = values.role !== editingUser?.role;
      const teamChanged = values.team_id !== (editingUser?.team_id || "");
      const payload: { role?: UserRole; team_id?: string; clear_team?: boolean } = {};
      if (roleChanged) payload.role = values.role;
      if (teamChanged) {
        if (values.team_id === "") payload.clear_team = true;
        else payload.team_id = values.team_id;
      }
      return adminUpdateUser(id, payload);
    },
    onSuccess: () => {
      message.success("已保存");
      setEditingUser(null);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "保存失败")
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      adminResetPassword(id, password),
    onSuccess: () => {
      message.success("密码已重置");
      setResettingUser(null);
      passwordForm.resetFields();
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "重置失败")
  });

  const roleCounts = ROLE_ORDER.map((role) => ({
    role,
    count: users.filter((u) => u.role === role).length
  }));

  if (!canView) {
    return (
      <Card>
        <Empty description="仅管理员、总监、PM 和团队负责人可查看组织信息。" />
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>组织</Title>
        <Text type="secondary">
          {isAdmin ? "管理员视图：可调整任何用户的角色与团队。" : "团队成员、活跃度统计"}
        </Text>
      </div>

      <Row gutter={[12, 12]}>
        {roleCounts.map(({ role, count }) => (
          <Col xs={12} md={8} lg={4} key={role}>
            <Card size="small" bodyStyle={{ padding: 16 }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>{ROLE_LABELS[role]}</Text>}
                value={count}
                valueStyle={{ color: ROLE_CARD_TONE[role], fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="团队" size="small">
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
                      工程师: {engineers.length > 0 ? engineers.map((e) => e.name).join(", ") : "暂无"}
                    </Text>
                  </Space>
                </Card>
              </Col>
            );
          })}
          {teams.length === 0 ? <Col span={24}><Empty description="暂无团队" /></Col> : null}
        </Row>
      </Card>

      <Card
        title={`成员 (${users.length})`}
        size="small"
        extra={isAdmin ? <Text type="secondary" style={{ fontSize: 12 }}>管理员可编辑角色 / 团队 / 重置密码</Text> : null}
      >
        <Table<User>
          rowKey="id"
          dataSource={users}
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          columns={[
            {
              title: "工号",
              dataIndex: "employee_id",
              width: 140,
              render: (v: string) => <Text code>{v}</Text>
            },
            {
              title: "姓名",
              dataIndex: "name",
              render: (v: string) => <Text strong>{v}</Text>
            },
            {
              title: "邮箱",
              dataIndex: "email",
              render: (v: string) => <Text type="secondary">{v}</Text>
            },
            {
              title: "角色",
              dataIndex: "role",
              width: 110,
              render: (r: UserRole) => <Tag color={ROLE_CARD_TONE[r]}>{ROLE_LABELS[r]}</Tag>
            },
            {
              title: "团队",
              dataIndex: "team_name",
              width: 140,
              render: (v?: string) => v || "-"
            },
            ...(isAdmin
              ? [
                  {
                    title: "操作",
                    key: "actions",
                    width: 180,
                    render: (_: unknown, u: User) => (
                      <Space>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          disabled={u.id === currentUser?.id}
                          onClick={() => {
                            setEditingUser(u);
                            editForm.setFieldsValue({
                              role: u.role,
                              team_id: u.team_id || ""
                            });
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={() => {
                            setResettingUser(u);
                            passwordForm.resetFields();
                          }}
                        >
                          重置密码
                        </Button>
                      </Space>
                    )
                  }
                ]
              : [])
          ]}
          locale={{ emptyText: <Empty description="暂无用户" /> }}
        />
      </Card>

      <Modal
        title={`编辑 ${editingUser?.name || ""}`}
        open={Boolean(editingUser)}
        onCancel={() => setEditingUser(null)}
        onOk={() => editForm.submit()}
        okText="保存"
        cancelText="取消"
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (editingUser) updateMutation.mutate({ id: editingUser.id, values });
          }}
        >
          <Form.Item label="角色" name="role">
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item label="团队" name="team_id">
            <Select
              options={[
                { value: "", label: "无团队" },
                ...teams.map((t) => ({ value: t.id, label: t.name }))
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置 ${resettingUser?.name || ""} 的密码`}
        open={Boolean(resettingUser)}
        onCancel={() => setResettingUser(null)}
        onOk={() => passwordForm.submit()}
        okText="确认重置"
        cancelText="取消"
        confirmLoading={resetMutation.isPending}
        destroyOnHidden
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={(values) => {
            if (resettingUser) resetMutation.mutate({ id: resettingUser.id, password: values.password });
          }}
        >
          <Form.Item
            label="新密码"
            name="password"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 8, message: "密码至少 8 位" }
            ]}
          >
            <Input.Password placeholder="至少 8 位" />
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
            <Input.Password placeholder="再次输入" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
