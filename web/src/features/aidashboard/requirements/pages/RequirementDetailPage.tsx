import { PlusOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Card, Empty, Result, Space, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { KeyValueInfoList } from "@/shared/components/DetailPatterns/KeyValueInfoList";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { ResourceActions, ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";
import { buildListReturnUrl } from "@/shared/utils/urlQuery";

import "../../aidashboard-pattern.css";
import { TaskPriorityTag, TaskStatusTag } from "../../dashboard/shared";
import { requirementsBoardApi } from "../api/requirementsBoardApi";
import type {
  MockTask,
  MockTokenSource,
  RequirementPriority,
  RequirementStage
} from "../types";

const { Text } = Typography;

const stageMeta: Record<RequirementStage, { label: string; color: string }> = {
  todo: { label: "待开始", color: "default" },
  review: { label: "评审", color: "purple" },
  active: { label: "进行中", color: "processing" },
  completed: { label: "完成", color: "success" },
  cancelled: { label: "已取消", color: "default" }
};

const priorityMeta: Record<RequirementPriority, { label: string; color: string }> = {
  low: { label: "低", color: "default" },
  medium: { label: "中", color: "gold" },
  high: { label: "高", color: "orange" },
  urgent: { label: "紧急", color: "red" }
};

export function RequirementDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = buildListReturnUrl("/requirements", location.search);

  const requirementQuery = useQuery({
    queryKey: ["requirements-board", "requirement", id],
    queryFn: () => requirementsBoardApi.getRequirement(id),
    enabled: Boolean(id)
  });
  const tasksQuery = useQuery({
    queryKey: ["requirements-board", "tasks", id],
    queryFn: () => requirementsBoardApi.listTasks(id),
    enabled: Boolean(id)
  });
  const tokenSourcesQuery = useQuery({
    queryKey: ["requirements-board", "token-sources"],
    queryFn: () => requirementsBoardApi.listTokenSources(),
    staleTime: 60_000
  });
  const tokenSourceMap = useMemo(
    () =>
      new Map(
        (tokenSourcesQuery.data ?? []).map((source: MockTokenSource) => [source.id, source])
      ),
    [tokenSourcesQuery.data]
  );

  if (!id) return <Result status="404" title="需求不存在" subTitle="缺少有效的需求 ID。" />;
  if (requirementQuery.isLoading) return <PageSkeleton rows={8} />;
  if (requirementQuery.isError || !requirementQuery.data) {
    return (
      <Result
        status="404"
        title="需求不存在"
        subTitle={
          requirementQuery.error instanceof Error
            ? requirementQuery.error.message
            : "未找到该需求或当前用户无权查看。"
        }
        extra={<Button onClick={() => navigate(backTo)}>返回需求看板</Button>}
      />
    );
  }

  const requirement = requirementQuery.data;
  const tasks = tasksQuery.data ?? [];
  const taskColumns: TableProps<MockTask>["columns"] = [
    {
      title: "任务",
      dataIndex: "title",
      render: (title: string, task) => <Link to={`/tasks/${task.id}`}>{title}</Link>
    },
    {
      title: "负责人",
      dataIndex: "assignee_name",
      render: (value?: string) => value || "-",
      width: 120
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (status: MockTask["status"]) => <TaskStatusTag status={status} />,
      width: 110
    },
    {
      title: "优先级",
      dataIndex: "priority",
      render: (priority: MockTask["priority"]) => <TaskPriorityTag priority={priority} />,
      width: 100
    },
    { title: "进度", dataIndex: "progress", render: (value: number) => `${value}%`, width: 90 },
    {
      title: "依赖",
      dataIndex: "dependencies",
      render: (dependencies: MockTask["dependencies"]) => dependencies.length || "-",
      width: 80
    },
    {
      title: "Token 来源",
      render: (_, task) => {
        const tokens = task.token_source_ids.reduce(
          (total, sourceId) => total + (tokenSourceMap.get(sourceId)?.token ?? 0),
          0
        );
        return tokens > 0 ? `${tokens.toLocaleString()} Token` : "-";
      },
      width: 160
    },
    {
      title: "操作",
      key: "actions",
      width: 90,
      render: (_, task) => (
        <ResourceActions
          actions={[{ key: "detail", label: "详情", onClick: () => navigate(`/tasks/${task.id}`) }]}
        />
      )
    }
  ];

  return (
    <PagePanel
      title="需求详情"
      description={requirement.title}
      backTo={backTo}
      breadcrumbs={[
        { title: "业务" },
        { title: "需求看板", path: "/requirements" },
        { title: requirement.title }
      ]}
      actions={
        <Button type="primary" onClick={() => navigate(`/tasks/create?requirement_id=${id}`)}>
          添加任务
        </Button>
      }
    >
      <div className="aidashboard-detail">
        <section className="aidashboard-detail__hero">
          <div>
            <h1>{requirement.title}</h1>
            <p>{requirement.description}</p>
          </div>
          <Space wrap>
            <Tag color={stageMeta[requirement.status].color}>
              {stageMeta[requirement.status].label}
            </Tag>
            <Tag color={priorityMeta[requirement.priority].color}>
              {priorityMeta[requirement.priority].label}
            </Tag>
            {tasks.length ? (
              <Tag color="blue">聚合进度 {requirement.progress}%</Tag>
            ) : (
              <Tag>未拆分任务</Tag>
            )}
          </Space>
        </section>

        <Card title="基础信息">
          <KeyValueInfoList
            tagColor="geekblue"
            items={[
              { key: "creator", label: "创建者", description: requirement.creator_name },
              {
                key: "teams",
                label: "参与团队",
                description: requirement.team_names.join("、") || "-"
              },
              { key: "deadline", label: "截止日期", description: requirement.deadline || "未设定" },
              {
                key: "doc",
                label: "飞书文档",
                description: requirement.feishu_doc_url ? (
                  <a href={requirement.feishu_doc_url} target="_blank" rel="noreferrer">
                    打开文档 ↗
                  </a>
                ) : (
                  "-"
                )
              }
            ]}
          />
        </Card>

        <Card title={`需求验收标准 (${requirement.acceptance_criteria.length})`}>
          {requirement.acceptance_criteria.length ? (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {requirement.acceptance_criteria.map((criterion, index) => (
                <Space key={criterion} align="start">
                  <Tag color="blue">标准 {index + 1}</Tag>
                  <Text>{criterion}</Text>
                </Space>
              ))}
            </Space>
          ) : (
            <Empty description="暂无需求验收标准" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>

        <Card title={`执行拆解 (${tasks.length})`}>
          {tasksQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="任务加载失败"
              action={<Button onClick={() => void tasksQuery.refetch()}>重试</Button>}
            />
          ) : !tasks.length && !tasksQuery.isLoading ? (
            <Empty
              description="该需求尚未拆分任务，拆分任务后可聚合进度、依赖阻塞和 Token。"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate(`/tasks/create?requirement_id=${id}`)}
              >
                添加第一个任务
              </Button>
            </Empty>
          ) : (
            <ResourceTable<MockTask>
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
