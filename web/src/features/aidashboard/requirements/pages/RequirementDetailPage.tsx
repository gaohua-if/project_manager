import { RobotOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, Empty, Popconfirm, Result, Space, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import "../../aidashboard-pattern.css";
import { fetchACStatus, fetchRequirement, fetchTasks, regenerateAC } from "../../api/client";
import type { ACStatus, Requirement, Task } from "../../api/types";
import {
  ProgressBar,
  RequirementPriorityTag,
  RequirementStatusTag,
  TaskStatusTag
} from "../../dashboard/shared";
import { useAuth } from "@/shared/auth/authContext";
import { ROLE_LABELS, type UserRole } from "@/shared/auth/types";
import { KeyValueInfoList } from "@/shared/components/DetailPatterns/KeyValueInfoList";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { ResourceActions, ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";
import { HttpError } from "@/shared/request/types";
import { buildListReturnUrl } from "@/shared/utils/urlQuery";

const { Text } = Typography;

export function RequirementDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { user } = useAuth();
  const backTo = buildListReturnUrl("/requirements", location.search);

  const requirementQuery = useQuery<Requirement>({
    queryKey: ["requirement", id],
    queryFn: () => fetchRequirement(id),
    enabled: Boolean(id),
    staleTime: 30_000
  });
  const acStatusesQuery = useQuery<ACStatus[]>({
    queryKey: ["requirement", id, "ac"],
    queryFn: () => fetchACStatus(id),
    enabled: Boolean(id),
    staleTime: 30_000
  });
  const tasksQuery = useQuery<Task[]>({
    queryKey: ["tasks", { requirement_id: id }],
    queryFn: () => fetchTasks({ requirement_id: id }),
    enabled: Boolean(id),
    staleTime: 30_000
  });

  const req = requirementQuery.data;
  const acStatuses = acStatusesQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  const canRegenerate =
    user &&
    (user.role === "director" ||
      user.role === "pm" ||
      user.role === "team_leader" ||
      user.role === "admin");

  const regenMutation = useMutation({
    mutationFn: () => regenerateAC(id),
    onSuccess: () => {
      message.success("AC 已重新生成");
      void queryClient.invalidateQueries({ queryKey: ["requirement", id] });
      void queryClient.invalidateQueries({ queryKey: ["requirement", id, "ac"] });
    },
    onError: (err: unknown) => message.error(err instanceof Error ? err.message : "重新生成失败")
  });

  if (!id) return <Result status="404" title="需求不存在" subTitle="缺少有效的需求 ID。" />;
  if (requirementQuery.isLoading) return <PageSkeleton rows={8} />;

  if (requirementQuery.isError) {
    const error = requirementQuery.error;
    if (error instanceof HttpError && error.status === 404) {
      return (
        <Result
          status="404"
          title="需求不存在"
          subTitle="该需求可能已被删除，或你没有访问权限。"
          extra={<Button onClick={() => navigate(backTo)}>返回需求列表</Button>}
        />
      );
    }
    return (
      <Result
        status="error"
        title="需求加载失败"
        subTitle={error instanceof Error ? error.message : "请稍后重试"}
        extra={<Button onClick={() => void requirementQuery.refetch()}>重试</Button>}
      />
    );
  }

  if (!req) {
    return (
      <Result
        status="404"
        title="需求不存在"
        subTitle="服务返回了空的需求数据。"
        extra={<Button onClick={() => navigate(backTo)}>返回需求列表</Button>}
      />
    );
  }

  const completedACs = acStatuses.filter((a) => a.completed).length;
  const taskColumns: TableProps<Task>["columns"] = [
    {
      title: "任务",
      dataIndex: "title",
      render: (title: string, t) => <Link to={`/tasks/${t.id}`}>{title}</Link>
    },
    { title: "负责人", dataIndex: "assignee_name", render: (v?: string) => v || "-", width: 120 },
    {
      title: "AC",
      dataIndex: "acceptance_criteria_ids",
      render: (ids: number[]) => ids?.map((i) => `AC${i + 1}`).join(", ") || "-",
      width: 120
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (s: Task["status"]) => <TaskStatusTag status={s} />,
      width: 110
    },
    { title: "截止", dataIndex: "due_date", render: (v?: string) => v || "-", width: 120 },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <ResourceActions
          actions={[
            { key: "detail", label: "详情", onClick: () => navigate(`/tasks/${record.id}`) }
          ]}
        />
      )
    }
  ];

  return (
    <PagePanel
      title="需求详情"
      description={req.title}
      backTo={backTo}
      breadcrumbs={[
        { title: "需求", path: "/requirements" },
        { title: "需求详情" },
        { title: req.title }
      ]}
      actions={
        <Space>
          <Button onClick={() => void requirementQuery.refetch()}>刷新</Button>
          <Button type="primary" onClick={() => navigate(`/tasks/create?requirement_id=${id}`)}>
            添加任务
          </Button>
        </Space>
      }
    >
      <div className="aidashboard-detail">
        <section className="aidashboard-detail__hero">
          <div>
            <h1>{req.title}</h1>
            <p>{req.description}</p>
          </div>
          <div className="aidashboard-detail__hero-side">
            <Space size={8} wrap>
              <RequirementStatusTag status={req.status} />
              <RequirementPriorityTag priority={req.priority} />
            </Space>
            <div style={{ minWidth: 180 }}>
              <ProgressBar value={req.progress} />
            </div>
          </div>
        </section>

        <Card title="基础信息">
          <KeyValueInfoList
            tagColor="geekblue"
            items={[
              {
                key: "creator",
                label: "创建者",
                description: `${req.creator_name} (${ROLE_LABELS[req.creator_role as UserRole] ?? req.creator_role})`
              },
              { key: "teams", label: "参与团队", description: req.team_names.join(", ") || "-" },
              { key: "deadline", label: "截止日期", description: req.deadline || "未设定" },
              {
                key: "doc",
                label: "飞书文档",
                description: req.feishu_doc_url ? (
                  <a href={req.feishu_doc_url} target="_blank" rel="noreferrer">
                    打开文档 ↗
                  </a>
                ) : (
                  "-"
                )
              }
            ]}
          />
        </Card>

        <Card
          title={`验收标准 (${completedACs}/${acStatuses.length})`}
          loading={acStatusesQuery.isLoading}
          extra={
            canRegenerate ? (
              <Popconfirm
                title="重新生成验收标准？"
                description="这会覆盖当前的 AC，可能影响已关联的任务。"
                okText="确认生成"
                cancelText="取消"
                onConfirm={() => regenMutation.mutate()}
              >
                <Button icon={<RobotOutlined />} loading={regenMutation.isPending}>
                  重新生成 AC
                </Button>
              </Popconfirm>
            ) : null
          }
        >
          {acStatusesQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="验收标准加载失败"
              description={
                acStatusesQuery.error instanceof Error
                  ? acStatusesQuery.error.message
                  : "请稍后重试"
              }
              action={<Button onClick={() => void acStatusesQuery.refetch()}>重试</Button>}
            />
          ) : acStatuses.length === 0 ? (
            <Empty description="暂无验收标准" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {acStatuses.map((ac) => (
                <Space key={ac.index} align="start">
                  <Tag color={ac.completed ? "success" : "default"} style={{ marginTop: 2 }}>
                    {ac.completed ? "✓" : "○"}
                  </Tag>
                  <Space direction="vertical" size={0}>
                    <Text delete={ac.completed}>{ac.text}</Text>
                    {ac.linked_tasks?.length ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        任务：{ac.linked_tasks.join(", ")}
                      </Text>
                    ) : null}
                  </Space>
                </Space>
              ))}
            </Space>
          )}
        </Card>

        <Card title={`任务 (${tasks.length})`}>
          {tasksQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="任务加载失败"
              description={
                tasksQuery.error instanceof Error ? tasksQuery.error.message : "请稍后重试"
              }
              action={<Button onClick={() => void tasksQuery.refetch()}>重试</Button>}
            />
          ) : (
            <ResourceTable<Task>
              rowKey="id"
              columns={taskColumns}
              dataSource={tasks}
              loading={tasksQuery.isLoading}
              pagination={{ pageSize: 10, showSizeChanger: false }}
            />
          )}
        </Card>
      </div>
    </PagePanel>
  );
}
