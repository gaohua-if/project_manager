// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the usage pattern, not the mock labels.

import { PlusOutlined } from "@ant-design/icons";
import { Alert, Button } from "antd";
import type { TableProps } from "antd";

import { confirmDangerAction } from "@/shared/components/ResourceTable/confirmDangerAction";
import { ResourceActions, ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";
import { StatusTag } from "@/shared/components/StatusTag/StatusTag";
import { TableLayout } from "@/shared/components/TableLayout/TableLayout";
import { formatDateTime } from "@/shared/utils/dateTime";

interface RowRecord {
  id: string;
  name: string;
  owner: string;
  status: "running" | "paused" | "failed";
  updated_at: string;
}

const rows: RowRecord[] = [];

export function TableControlsReference() {
  const columns: TableProps<RowRecord>["columns"] = [
    {
      title: "资源名称",
      dataIndex: "name",
      render: (name: string) => <a>{name}</a>
    },
    { title: "负责人", dataIndex: "owner", width: 120 },
    {
      title: "状态",
      dataIndex: "status",
      width: 120,
      render: (status: RowRecord["status"]) => <StatusTag status={status} />
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      width: 180,
      render: (value?: string) => (value ? formatDateTime(value) : "-")
    },
    {
      title: "操作",
      key: "actions",
      width: 170,
      render: (_, record) => (
        <ResourceActions
          actions={[
            { key: "detail", label: "详情", onClick: () => undefined },
            { key: "edit", label: "编辑", onClick: () => undefined },
            {
              key: "delete",
              label: "删除",
              danger: true,
              onClick: () =>
                confirmDangerAction({
                  title: "确认删除该资源？",
                  content: record.name,
                  okText: "删除",
                  onConfirm: async () => undefined
                })
            }
          ]}
        />
      )
    }
  ];

  return (
    <TableLayout
      operations={
        <Button type="primary" icon={<PlusOutlined />}>
          新建资源
        </Button>
      }
      search={
        <TableLayout.SearchGroup>
          <TableLayout.SearchInput allowClear itemSize="lg" itemGrow placeholder="搜索资源名称" />
          <TableLayout.SelectFilter
            allowClear
            placeholder="状态"
            options={[
              { label: "运行中", value: "running" },
              { label: "已暂停", value: "paused" },
              { label: "异常", value: "failed" }
            ]}
          />
          <TableLayout.DateRangeFilter format="YYYY-MM-DD" />
        </TableLayout.SearchGroup>
      }
    >
      <Alert type="error" showIcon message="列表加载失败" />
      <ResourceTable<RowRecord> rowKey="id" columns={columns} dataSource={rows} />
    </TableLayout>
  );
}
