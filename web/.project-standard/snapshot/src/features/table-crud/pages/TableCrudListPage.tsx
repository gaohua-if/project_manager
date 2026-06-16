import { DownOutlined, ExportOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Dropdown, Space } from "antd";
import type { TablePaginationConfig, TableProps } from "antd";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { confirmDangerAction } from "@/shared/components/ResourceTable/confirmDangerAction";
import { ResourceActions, ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";
import { StatusTag } from "@/shared/components/StatusTag/StatusTag";
import { TableLayout } from "@/shared/components/TableLayout/TableLayout";
import { formatDateTime } from "@/shared/utils/dateTime";
import { appendSearch, getNumberParam, setOrDeleteParam } from "@/shared/utils/urlQuery";

import type {
  TableResource,
  TableResourcePriority,
  TableResourceStatus
} from "../api/tableCrudTypes";
import { useDeleteTableResource, useTableResourceList } from "../hooks/useTableCrudQueries";
import "./TableCrud.css";

const priorityMeta: Record<TableResourcePriority, { label: string; tone: string }> = {
  high: { label: "高", tone: "high" },
  normal: { label: "正常", tone: "normal" },
  low: { label: "低", tone: "low" }
};

export function TableCrudListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = {
    page_num: getNumberParam(searchParams, "page_num", 1),
    page_size: getNumberParam(searchParams, "page_size", 10),
    keyword: searchParams.get("keyword") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    order_by: searchParams.get("order_by") ?? "updatedAt",
    order_type: searchParams.get("order_type") ?? "desc"
  };
  const listQuery = useTableResourceList(query);
  const deleteMutation = useDeleteTableResource();
  const pageData = listQuery.data?.data;

  const updateQuery = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => setOrDeleteParam(params, key, value));
    setSearchParams(params);
  };

  const submitKeyword = (value: string) => {
    const keyword = value.trim();
    updateQuery({ keyword: keyword || undefined, page_num: 1 });
  };

  const getSortOrder = (field: string) => {
    if (query.order_by !== field) return undefined;
    return query.order_type === "asc" ? "ascend" : "descend";
  };

  const openDetail = (record: TableResource) => {
    navigate(appendSearch(`/examples/table-crud/${record.id}`, searchParams));
  };

  const openCreate = (path = "/examples/table-crud/create") => {
    navigate(appendSearch(path, searchParams));
  };

  const exportCurrentPage = () => {
    const rows = pageData?.data ?? [];
    const header = ["资源名称", "状态", "区域", "标签", "更新时间"];
    const body = rows.map((item) => [
      item.name,
      item.status,
      item.region,
      item.tags[0] ?? "-",
      item.updatedAt
    ]);
    const csv = [header, ...body]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    link.download = "table-resources.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const columns: TableProps<TableResource>["columns"] = [
    {
      title: "资源名称",
      dataIndex: "name",
      width: 320,
      render: (name, record) => (
        <div className="table-crud-resource">
          <Link
            className="table-crud__name-link"
            to={appendSearch(`/examples/table-crud/${record.id}`, searchParams)}
          >
            {name}
          </Link>
          <span className="table-crud-resource__meta">
            {(record.tags ?? []).slice(0, 2).join(" / ") || "-"} ·{" "}
            {record.enabled ? "已启用" : "未启用"}
          </span>
        </div>
      )
    },
    { title: "负责人", dataIndex: "owner", width: 120 },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (status: TableResourceStatus) => <StatusTag status={status} />
    },
    {
      title: "优先级",
      dataIndex: "priority",
      width: 110,
      render: (priority: TableResourcePriority) => {
        const meta = priorityMeta[priority];
        return (
          <span className={`table-crud-priority table-crud-priority--${meta.tone}`}>
            {meta.label}
          </span>
        );
      }
    },
    { title: "区域", dataIndex: "region", width: 120 },
    {
      title: "配额",
      dataIndex: "quota",
      sorter: true,
      sortOrder: getSortOrder("quota"),
      width: 90
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      sorter: true,
      sortOrder: getSortOrder("updatedAt"),
      width: 190,
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
              onClick: () => openDetail(record)
            },
            {
              key: "edit",
              label: "编辑",
              onClick: () =>
                navigate(appendSearch(`/examples/table-crud/${record.id}/edit`, searchParams))
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
                  content: `删除后无法恢复：${record.name}`,
                  okText: "删除",
                  onConfirm: async () => {
                    await deleteMutation.mutateAsync(record.id);
                  }
                })
            }
          ]}
        />
      )
    }
  ];

  const handleTableChange: TableProps<TableResource>["onChange"] = (
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
      description="统一查看、筛选和维护平台资源状态"
      className="table-crud-list"
      breadcrumbs={[{ title: "Data" }, { title: "Table CRUD" }]}
      actions={
        <>
          <Button
            icon={<ReloadOutlined />}
            loading={listQuery.isFetching}
            onClick={() => listQuery.refetch()}
          >
            刷新
          </Button>
          <Button
            icon={<ExportOutlined />}
            disabled={!pageData?.data.length}
            onClick={exportCurrentPage}
          >
            导出
          </Button>
        </>
      }
    >
      <TableLayout
        operations={
          <>
            <Dropdown
              menu={{
                items: [
                  {
                    key: "simple",
                    label: "简单表单",
                    onClick: () => openCreate("/examples/table-crud/create/simple")
                  },
                  {
                    key: "standard",
                    label: "标准表单",
                    onClick: () => openCreate()
                  },
                  {
                    key: "steps",
                    label: "分步骤表单",
                    onClick: () => openCreate("/examples/table-crud/create/steps")
                  },
                  {
                    key: "advanced",
                    label: "大型表单",
                    onClick: () => openCreate("/examples/table-crud/create/advanced")
                  }
                ]
              }}
            >
              <Button
                className="table-crud-list__create"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openCreate()}
              >
                <Space size={6}>
                  新建资源
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
          </>
        }
        search={
          <TableLayout.SearchGroup>
            <TableLayout.SearchInput
              key={query.keyword ?? ""}
              itemSize="lg"
              itemGrow
              placeholder="搜索名称、负责人或描述"
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
                { label: "异常", value: "failed" },
                { label: "草稿", value: "draft" }
              ]}
            />
            <TableLayout.SelectFilter
              itemSize="md"
              placeholder="优先级"
              value={query.priority}
              onChange={(priority) =>
                updateQuery({ priority: priority ? String(priority) : undefined, page_num: 1 })
              }
              options={[
                { label: "高", value: "high" },
                { label: "正常", value: "normal" },
                { label: "低", value: "low" }
              ]}
            />
          </TableLayout.SearchGroup>
        }
      >
        {listQuery.isError && (
          <Alert
            className="table-crud__error"
            type="error"
            showIcon
            message="列表加载失败"
            action={<Button onClick={() => listQuery.refetch()}>重试</Button>}
          />
        )}
        <ResourceTable<TableResource>
          rowKey="id"
          columns={columns}
          dataSource={pageData?.data ?? []}
          loading={listQuery.isLoading}
          onChange={handleTableChange}
          pagination={{
            current: query.page_num,
            pageSize: query.page_size,
            total: pageData?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`
          }}
        />
      </TableLayout>
    </PagePanel>
  );
}
