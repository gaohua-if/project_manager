// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the pattern, not the mock data.

import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button } from "antd";
import type { TablePaginationConfig, TableProps } from "antd";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { confirmDangerAction } from "@/shared/components/ResourceTable/confirmDangerAction";
import { ResourceActions, ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";
import { StatusTag } from "@/shared/components/StatusTag/StatusTag";
import { TableLayout } from "@/shared/components/TableLayout/TableLayout";
import { formatDateTime } from "@/shared/utils/dateTime";
import { appendSearch, getNumberParam, setOrDeleteParam } from "@/shared/utils/urlQuery";

import type { ResourceListQuery, ResourceRecord, ResourceStatus } from "./types";
import "./list-pattern.css";

export function ResourceListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query: ResourceListQuery = {
    page_num: getNumberParam(searchParams, "page_num", 1),
    page_size: getNumberParam(searchParams, "page_size", 10),
    keyword: searchParams.get("keyword") ?? undefined,
    status: (searchParams.get("status") as ResourceStatus | null) ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    order_by: searchParams.get("order_by") ?? "updatedAt",
    order_type: (searchParams.get("order_type") as "asc" | "desc" | null) ?? "desc"
  };

  // Replace these placeholders with a TanStack Query hook from this feature module.
  const listQuery = {
    data: undefined as { data: { data: ResourceRecord[]; total: number } } | undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: () => undefined
  };
  const deleteMutation = {
    isPending: false,
    mutateAsync: async (id: string) => {
      void id;
    }
  };

  const updateQuery = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => setOrDeleteParam(params, key, value));
    setSearchParams(params);
  };

  const submitKeyword = (value: string) => {
    const keyword = value.trim();
    updateQuery({ keyword: keyword || undefined, page_num: 1 });
  };

  const getSortOrder = (field: string) =>
    query.order_by === field ? (query.order_type === "asc" ? "ascend" : "descend") : undefined;

  const openCreate = () => {
    navigate(appendSearch("/resources/create", searchParams));
  };

  const columns: TableProps<ResourceRecord>["columns"] = [
    {
      title: "资源名称",
      dataIndex: "name",
      width: 320,
      render: (name: string, record) => (
        <Link
          className="resource-list__name-link"
          to={appendSearch(`/resources/${record.id}`, searchParams)}
        >
          {name}
        </Link>
      )
    },
    { title: "负责人", dataIndex: "owner", width: 120 },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (status: ResourceStatus) => <StatusTag status={status} />
    },
    { title: "优先级", dataIndex: "priority", width: 110 },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      sorter: true,
      sortOrder: getSortOrder("updatedAt"),
      width: 180,
      render: (value: string) => formatDateTime(value)
    },
    {
      title: "操作",
      key: "actions",
      width: 170,
      render: (_, record) => (
        <ResourceActions
          actions={[
            {
              key: "detail",
              label: "详情",
              onClick: () => navigate(appendSearch(`/resources/${record.id}`, searchParams))
            },
            {
              key: "edit",
              label: "编辑",
              onClick: () => navigate(appendSearch(`/resources/${record.id}/edit`, searchParams))
            },
            {
              key: "copy",
              label: "复制",
              onClick: () => openCreate()
            },
            {
              key: "delete",
              label: "删除",
              danger: true,
              loading: deleteMutation.isPending,
              onClick: () =>
                confirmDangerAction({
                  title: "确认删除该资源？",
                  content: record.name,
                  okText: "删除",
                  onConfirm: () => deleteMutation.mutateAsync(record.id)
                })
            }
          ]}
        />
      )
    }
  ];

  const handleTableChange: TableProps<ResourceRecord>["onChange"] = (
    pagination: TablePaginationConfig,
    _filters,
    sorter
  ) => {
    const activeSorter = Array.isArray(sorter) ? sorter.find((item) => item.order) : sorter;
    updateQuery({
      page_num: pagination.current,
      page_size: pagination.pageSize,
      order_by: activeSorter?.order ? String(activeSorter.field) : undefined,
      order_type:
        activeSorter?.order === "ascend"
          ? "asc"
          : activeSorter?.order === "descend"
            ? "desc"
            : undefined
    });
  };

  return (
    <PagePanel
      title="资源管理"
      description="统一查看、筛选和维护资源状态"
      className="resource-list"
      breadcrumbs={[{ title: "Data" }, { title: "资源管理" }]}
      actions={
        <Button
          icon={<ReloadOutlined />}
          loading={listQuery.isFetching}
          onClick={() => listQuery.refetch()}
        >
          刷新
        </Button>
      }
    >
      <TableLayout
        operations={
          <Button
            className="resource-list__create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openCreate()}
          >
            Create resource
          </Button>
        }
        search={
          <TableLayout.SearchGroup>
            <TableLayout.SearchInput
              key={query.keyword ?? ""}
              itemSize="lg"
              itemGrow
              placeholder="搜索资源名称或负责人"
              defaultValue={query.keyword ?? ""}
              onSearch={submitKeyword}
            />
            <TableLayout.SelectFilter
              itemSize="md"
              placeholder="状态"
              value={query.status}
              onChange={(status) =>
                updateQuery({ status: status ? String(status) : undefined, page_num: 1 })
              }
              options={[
                { label: "运行中", value: "running" },
                { label: "已暂停", value: "paused" },
                { label: "异常", value: "failed" }
              ]}
            />
          </TableLayout.SearchGroup>
        }
      >
        {listQuery.isError && (
          <Alert
            type="error"
            showIcon
            message="列表加载失败"
            action={<Button onClick={() => listQuery.refetch()}>重试</Button>}
          />
        )}
        <ResourceTable<ResourceRecord>
          rowKey="id"
          columns={columns}
          dataSource={listQuery.data?.data.data ?? []}
          loading={listQuery.isLoading}
          onChange={handleTableChange}
          pagination={{
            current: query.page_num,
            pageSize: query.page_size,
            total: listQuery.data?.data.total ?? 0,
            showSizeChanger: true
          }}
        />
      </TableLayout>
    </PagePanel>
  );
}
