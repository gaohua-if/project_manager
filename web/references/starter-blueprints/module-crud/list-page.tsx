// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the pattern, not the mock data.

import { AppstoreOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Pagination, Space, Tag } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { ModuleOrderBar } from "@/shared/components/PagePatterns/ModuleOrderBar";
import { TagSidebarLayout } from "@/shared/components/PagePatterns/TagSidebarLayout";
import { confirmDangerAction } from "@/shared/components/ResourceTable/confirmDangerAction";
import { ResourceActions } from "@/shared/components/ResourceTable/ResourceTable";
import { StatusTag } from "@/shared/components/StatusTag/StatusTag";
import { TableLayout } from "@/shared/components/TableLayout/TableLayout";
import { formatDateTime } from "@/shared/utils/dateTime";
import { getTagColor } from "@/shared/utils/tagColor";
import { appendSearch, getNumberParam, setOrDeleteParam } from "@/shared/utils/urlQuery";

import type { ModuleListQuery, ModuleOrderType, ModuleRecord } from "./types";

export function ModuleListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query: ModuleListQuery = {
    page_num: getNumberParam(searchParams, "page_num", 1),
    page_size: getNumberParam(searchParams, "page_size", 12),
    keyword: searchParams.get("keyword") ?? undefined,
    category_id: searchParams.get("category_id") ?? undefined,
    owner: searchParams.get("owner") ?? undefined,
    order_by: searchParams.get("order_by") ?? "used_cnt",
    order_type: (searchParams.get("order_type") as ModuleOrderType | null) ?? "desc"
  };

  // Replace these placeholders with feature query hooks.
  const categoriesQuery = {
    data: { data: [] as Array<{ id: string; label: string; count?: number; color?: string }> }
  };
  const listQuery = {
    data: undefined as { data: { data: ModuleRecord[]; total: number } } | undefined,
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

  const categories = categoriesQuery.data.data;
  const sidebarItems = [
    {
      key: "all",
      label: "全部模块",
      count: categories.reduce((total, item) => total + (item.count ?? 0), 0),
      color: "var(--aihub-color-primary)"
    },
    ...categories.map((item) => ({
      key: item.id,
      label: item.label,
      count: item.count,
      color: item.color
    }))
  ];

  const handleDelete = (record: ModuleRecord) => {
    confirmDangerAction({
      title: "确认删除该模块？",
      content: record.name,
      okText: "删除",
      onConfirm: () => deleteMutation.mutateAsync(record.id)
    });
  };

  return (
    <PagePanel
      title="模块管理"
      description="Category-first resource management"
      breadcrumbs={[{ title: "Data" }, { title: "模块管理" }]}
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
      <TagSidebarLayout
        items={sidebarItems}
        activeKey={query.category_id ?? "all"}
        onChange={(key) =>
          updateQuery({ category_id: key === "all" ? undefined : key, page_num: 1 })
        }
      >
        <TableLayout
          search={
            <TableLayout.SearchGroup>
              <ModuleOrderBar
                orderBy={query.order_by ?? "used_cnt"}
                orderType={query.order_type ?? "desc"}
                onChange={(next) =>
                  updateQuery({ order_by: next.orderBy, order_type: next.orderType, page_num: 1 })
                }
              />
              <TableLayout.SelectFilter
                itemSize="md"
                placeholder="负责人"
                value={query.owner}
                onChange={(owner) =>
                  updateQuery({ owner: owner ? String(owner) : undefined, page_num: 1 })
                }
                options={["平台组", "算法组", "数据组"].map((value) => ({ label: value, value }))}
              />
              <TableLayout.SearchInput
                key={query.keyword ?? ""}
                itemSize="lg"
                itemGrow
                placeholder="搜索模块名称或描述"
                defaultValue={query.keyword ?? ""}
                onSearch={submitKeyword}
              />
            </TableLayout.SearchGroup>
          }
        >
          {listQuery.isError && <Alert type="error" showIcon message="模块列表加载失败" />}
          {(listQuery.data?.data.data.length ?? 0) === 0 && !listQuery.isLoading ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无模块" />
          ) : (
            <>
              <div className="module-grid-reference">
                {(listQuery.data?.data.data ?? []).map((item) => (
                  <Card
                    key={item.id}
                    size="small"
                    title={
                      <Space>
                        <AppstoreOutlined />
                        {item.name}
                      </Space>
                    }
                  >
                    <p>{item.description}</p>
                    <p>更新时间：{formatDateTime(item.updated_at)}</p>
                    <Space wrap size={6}>
                      <StatusTag status={item.status} />
                      {item.tags.map((tag, index) => (
                        <Tag key={tag} color={getTagColor(tag, index)}>
                          {tag}
                        </Tag>
                      ))}
                    </Space>
                    <ResourceActions
                      actions={[
                        {
                          key: "detail",
                          label: "详情",
                          onClick: () => navigate(appendSearch(`/modules/${item.id}`, searchParams))
                        },
                        {
                          key: "edit",
                          label: "编辑",
                          onClick: () =>
                            navigate(appendSearch(`/modules/${item.id}/edit`, searchParams))
                        },
                        {
                          key: "delete",
                          label: "删除",
                          danger: true,
                          loading: deleteMutation.isPending,
                          onClick: () => handleDelete(item)
                        }
                      ]}
                    />
                  </Card>
                ))}
              </div>
              <Pagination
                current={query.page_num}
                pageSize={query.page_size}
                total={listQuery.data?.data.total ?? 0}
                showSizeChanger
                onChange={(page_num, page_size) => updateQuery({ page_num, page_size })}
              />
            </>
          )}
        </TableLayout>
      </TagSidebarLayout>
    </PagePanel>
  );
}
