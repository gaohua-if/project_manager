import { AppstoreOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Pagination, Space, Tag } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { confirmDangerAction } from "@/shared/components/ResourceTable/confirmDangerAction";
import { StatusTag } from "@/shared/components/StatusTag/StatusTag";
import { ModuleOrderBar } from "@/shared/components/PagePatterns/ModuleOrderBar";
import type { ModuleOrderType } from "@/shared/components/PagePatterns/ModuleOrderBar";
import { TagSidebarLayout } from "@/shared/components/PagePatterns/TagSidebarLayout";
import { TableLayout } from "@/shared/components/TableLayout/TableLayout";
import { formatDateTime } from "@/shared/utils/dateTime";
import { getTagColor } from "@/shared/utils/tagColor";
import { appendSearch, getNumberParam, setOrDeleteParam } from "@/shared/utils/urlQuery";

import type { ModuleResource } from "../api/moduleCrudTypes";
import { useDeleteModule, useModuleCategories, useModuleList } from "../hooks/useModuleCrudQueries";
import "./ModuleCrud.css";

export function ModuleCrudListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const categoriesQuery = useModuleCategories();
  const query = {
    page_num: getNumberParam(searchParams, "page_num", 1),
    page_size: getNumberParam(searchParams, "page_size", 12),
    keyword: searchParams.get("keyword") ?? undefined,
    category_id: searchParams.get("category_id") ?? undefined,
    user_id: searchParams.get("user_id") ?? undefined,
    order_by: searchParams.get("order_by") ?? "used_cnt",
    order_type: (searchParams.get("order_type") ?? "desc") as ModuleOrderType
  };
  const listQuery = useModuleList(query);
  const deleteMutation = useDeleteModule();
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

  const clearFilters = () => {
    updateQuery({
      keyword: undefined,
      category_id: undefined,
      user_id: undefined,
      page_num: 1
    });
  };

  const categories = categoriesQuery.data?.data ?? [];
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

  const handleDelete = (record: ModuleResource) => {
    confirmDangerAction({
      title: "确认删除该模块？",
      content: `删除后无法恢复：${record.name}`,
      okText: "删除",
      onConfirm: async () => {
        await deleteMutation.mutateAsync(record.id);
        if ((pageData?.data.length ?? 0) === 1 && query.page_num > 1) {
          updateQuery({ page_num: query.page_num - 1 });
        }
      }
    });
  };

  return (
    <PagePanel
      title="Module CRUD 样板"
      description="Tag 侧栏 + 模块卡片 + 胶囊排序的分类浏览管理页"
      breadcrumbs={[{ title: "Data" }, { title: "Module CRUD" }]}
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
                orderBy={query.order_by}
                orderType={query.order_type}
                onChange={(next) =>
                  updateQuery({ order_by: next.orderBy, order_type: next.orderType, page_num: 1 })
                }
              />
              <TableLayout.SelectFilter
                itemSize="md"
                placeholder="创建人"
                value={query.user_id}
                onChange={(user_id) =>
                  updateQuery({ user_id: user_id ? String(user_id) : undefined, page_num: 1 })
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
          loading={listQuery.isLoading}
        >
          {listQuery.isError && (
            <Alert
              className="module-crud__error"
              type="error"
              showIcon
              message="模块列表加载失败"
            />
          )}
          {(pageData?.data.length ?? 0) === 0 && !listQuery.isLoading ? (
            <Empty
              className="module-crud__empty"
              description="暂无模块"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button onClick={clearFilters}>清空筛选</Button>
            </Empty>
          ) : (
            <>
              <div
                className={
                  listQuery.isFetching && !listQuery.isLoading
                    ? "module-crud__card-grid is-refetching"
                    : "module-crud__card-grid"
                }
              >
                {(pageData?.data ?? []).map((item) => (
                  <Card
                    key={item.id}
                    className="module-crud__card"
                    size="small"
                    title={
                      <Space>
                        <AppstoreOutlined />
                        {item.name}
                      </Space>
                    }
                    extra={
                      <Button
                        type="link"
                        onClick={() =>
                          navigate(appendSearch(`/examples/module-crud/${item.id}`, searchParams))
                        }
                      >
                        详情
                      </Button>
                    }
                    actions={[
                      <Button
                        key="edit"
                        type="link"
                        onClick={() =>
                          navigate(
                            appendSearch(`/examples/module-crud/${item.id}/edit`, searchParams)
                          )
                        }
                      >
                        编辑
                      </Button>,
                      <Button
                        key="delete"
                        type="link"
                        danger
                        loading={deleteMutation.isPending}
                        onClick={() => handleDelete(item)}
                      >
                        删除
                      </Button>
                    ]}
                  >
                    <div className="module-crud__desc">{item.description}</div>
                    <div className="module-crud__meta">
                      <span>运行 {item.ran_cnt}</span>
                      <span>引用 {item.used_cnt}</span>
                      <span>{formatDateTime(item.updated_at)}</span>
                    </div>
                    <Space wrap size={6}>
                      <StatusTag status={item.status} />
                      {item.tags.map((tag, index) => (
                        <Tag key={tag} color={getTagColor(tag, index)}>
                          {tag}
                        </Tag>
                      ))}
                    </Space>
                  </Card>
                ))}
              </div>
              <div className="module-crud__pagination">
                <Pagination
                  current={query.page_num}
                  pageSize={query.page_size}
                  total={pageData?.total ?? 0}
                  showSizeChanger
                  showTotal={(total) => `共 ${total} 条`}
                  onChange={(page_num, page_size) => updateQuery({ page_num, page_size })}
                />
              </div>
            </>
          )}
        </TableLayout>
      </TagSidebarLayout>
    </PagePanel>
  );
}
