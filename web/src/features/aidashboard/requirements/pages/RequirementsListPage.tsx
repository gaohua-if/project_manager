import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Select } from "antd";
import type { TableProps } from "antd";
import { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchRequirements } from "../../api/client";
import type { Requirement, RequirementPriority, RequirementStatus } from "../../api/types";
import "../../aidashboard-pattern.css";
import { ProgressBar, RequirementPriorityTag, RequirementStatusTag } from "../../dashboard/shared";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { ResourceActions, ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";
import { TableLayout } from "@/shared/components/TableLayout/TableLayout";
import { appendSearch } from "@/shared/utils/urlQuery";

const PRIORITY_OPTIONS: Array<{ value: RequirementPriority; label: string }> = [
  { value: "urgent", label: "紧急" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" }
];

const STATUS_OPTIONS: Array<{ value: RequirementStatus; label: string }> = [
  { value: "active", label: "进行中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" }
];

export function RequirementsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get("keyword") ?? "";
  const priority = (searchParams.get("priority") as RequirementPriority | null) ?? undefined;
  const status = (searchParams.get("status") as RequirementStatus | null) ?? undefined;

  const updateParam = (key: string, value: string | undefined) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  };

  const requirementsQuery = useQuery<Requirement[]>({
    queryKey: ["requirements"],
    queryFn: () => fetchRequirements(),
    staleTime: 60_000
  });
  const filteredRequirements = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const requirements = requirementsQuery.data ?? [];
    return requirements.filter((item) => {
      const keywordMatched =
        !kw ||
        item.title.toLowerCase().includes(kw) ||
        item.creator_name.toLowerCase().includes(kw) ||
        item.team_names.join(" ").toLowerCase().includes(kw);
      const priorityMatched = !priority || item.priority === priority;
      const statusMatched = !status || item.status === status;
      return keywordMatched && priorityMatched && statusMatched;
    });
  }, [keyword, priority, requirementsQuery.data, status]);

  const columns: TableProps<Requirement>["columns"] = [
    {
      title: "需求",
      dataIndex: "title",
      render: (title: string, r) => (
        <div className="aidashboard-list__name-link">
          <Link to={appendSearch(`/requirements/${r.id}`, searchParams)}>{title}</Link>
          {r.feishu_doc_url ? (
            <div>
              <a href={r.feishu_doc_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                飞书文档 ↗
              </a>
            </div>
          ) : null}
        </div>
      )
    },
    { title: "创建者", dataIndex: "creator_name", width: 120 },
    { title: "团队", dataIndex: "team_names", render: (v: string[]) => v.join(", "), width: 180 },
    {
      title: "AC",
      dataIndex: "acceptance_criteria",
      render: (v: string[]) => v?.length || 0,
      width: 80
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (s: RequirementStatus) => <RequirementStatusTag status={s} />,
      width: 110
    },
    {
      title: "进度",
      dataIndex: "progress",
      render: (v: number) => <ProgressBar value={v} />,
      width: 180
    },
    {
      title: "优先级",
      dataIndex: "priority",
      render: (p: RequirementPriority) => <RequirementPriorityTag priority={p} />,
      width: 100
    },
    { title: "截止日期", dataIndex: "deadline", render: (v?: string) => v || "-", width: 130 },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <ResourceActions
          actions={[
            {
              key: "detail",
              label: "详情",
              onClick: () =>
                navigate(appendSearch(`/requirements/${record.id}`, searchParams))
            }
          ]}
        />
      )
    }
  ];

  return (
    <PagePanel
      title="需求"
      className="aidashboard-list"
      description="管理需求、参与团队和验收标准进度"
      breadcrumbs={[{ title: "需求" }]}
      actions={
        <Button
          icon={<ReloadOutlined />}
          loading={requirementsQuery.isFetching}
          onClick={() => void requirementsQuery.refetch()}
        >
          刷新
        </Button>
      }
    >
      <TableLayout
        operations={
          <Button
            className="aidashboard-list__create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate(appendSearch("/requirements/create", searchParams))}
          >
            新建需求
          </Button>
        }
        search={
          <TableLayout.SearchGroup>
            <TableLayout.SearchInput
              itemSize="lg"
              itemGrow
              placeholder="搜索需求 / 创建者 / 团队"
              onSearch={(value) => updateParam("keyword", value)}
              defaultValue={keyword}
            />
            <TableLayout.SelectItem size="md">
              <Select
                allowClear
                placeholder="状态"
                value={status}
                onChange={(next) => updateParam("status", next)}
                options={STATUS_OPTIONS}
                style={{ width: "100%" }}
              />
            </TableLayout.SelectItem>
            <TableLayout.SelectItem size="md">
              <Select
                allowClear
                placeholder="优先级"
                value={priority}
                onChange={(next) => updateParam("priority", next)}
                options={PRIORITY_OPTIONS}
                style={{ width: "100%" }}
              />
            </TableLayout.SelectItem>
          </TableLayout.SearchGroup>
        }
      >
        {requirementsQuery.isError ? (
          <Alert
            type="error"
            showIcon
            message="需求列表加载失败"
            description={
              requirementsQuery.error instanceof Error
                ? requirementsQuery.error.message
                : "请稍后重试"
            }
            action={<Button onClick={() => void requirementsQuery.refetch()}>重试</Button>}
          />
        ) : null}
        <ResourceTable<Requirement>
          rowKey="id"
          columns={columns}
          dataSource={filteredRequirements}
          loading={requirementsQuery.isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </TableLayout>
    </PagePanel>
  );
}
