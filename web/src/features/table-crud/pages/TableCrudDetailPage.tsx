import { Alert, Button, Result, Space, Tag } from "antd";
import { useParams } from "react-router-dom";

import { KeyValueInfoList } from "@/shared/components/DetailPatterns/KeyValueInfoList";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { StatusTag } from "@/shared/components/StatusTag/StatusTag";
import { formatDateTime } from "@/shared/utils/dateTime";
import { getTagColor } from "@/shared/utils/tagColor";

import { useTableResourceDetail } from "../hooks/useTableCrudQueries";
import "./TableCrud.css";

export function TableCrudDetailPage() {
  const { id } = useParams();
  const detailQuery = useTableResourceDetail(id);

  if (detailQuery.isLoading) return <PageSkeleton rows={8} />;
  if (detailQuery.isError || !detailQuery.data?.data) {
    return <Result status="404" title="资源不存在" subTitle="当前资源不存在或已被删除" />;
  }

  const data = detailQuery.data.data;
  const priorityText = { high: "高", normal: "正常", low: "低" }[data.priority];
  const statusContext = getStatusContext(data.status, data.enabled);

  return (
    <PagePanel
      title={data.name}
      className="table-crud-detail-page"
      showNav={false}
      breadcrumbs={[
        { title: "Table CRUD", path: "/examples/table-crud" },
        { title: "Table 资源详情" },
        { title: data.name }
      ]}
    >
      <section className="table-crud-detail">
        <div className="table-crud-detail__hero">
          <div className="table-crud-detail__identity">
            <span className="table-crud-detail__eyebrow">RESOURCE</span>
            <h1>{data.name}</h1>
            <p className="table-crud-detail__id">{data.id}</p>
          </div>
          <div className="table-crud-detail__hero-side">
            <div className="table-crud-detail__status">
              <StatusTag status={data.status} />
              <span className="table-crud-detail__enabled">
                {data.enabled ? "已启用" : "未启用"}
              </span>
            </div>
            <Space className="table-crud-detail__actions" wrap>
              <Button loading={detailQuery.isFetching} onClick={() => detailQuery.refetch()}>
                刷新
              </Button>
            </Space>
          </div>
        </div>

        <Alert
          className="table-crud-detail__notice"
          type={statusContext.type}
          showIcon
          message={statusContext.title}
          description={statusContext.description}
        />

        <div className="table-crud-detail__layout">
          <section className="table-crud-detail__section table-crud-detail__section--main">
            <h2>基础信息</h2>
            <div className="table-crud-detail__fields">
              <InfoItem label="资源 ID" value={data.id} />
              <InfoItem label="负责人" value={data.owner} />
              <InfoItem label="区域" value={data.region} />
              <InfoItem label="优先级" value={priorityText} />
              <InfoItem label="创建时间" value={formatDateTime(data.createdAt)} />
              <InfoItem label="更新时间" value={formatDateTime(data.updatedAt)} />
            </div>
          </section>

          <aside className="table-crud-detail__section table-crud-detail__aside">
            <h2>运行摘要</h2>
            <div className="table-crud-detail__metric">
              <span>配额</span>
              <strong>{data.quota}</strong>
            </div>
            <div className="table-crud-detail__tags">
              {data.tags.length > 0 ? (
                data.tags.map((tag, index) => (
                  <Tag key={tag} color={getTagColor(tag, index)}>
                    {tag}
                  </Tag>
                ))
              ) : (
                <span className="table-crud-detail__empty">暂无标签</span>
              )}
            </div>
          </aside>
        </div>

        <section className="table-crud-detail__section">
          <KeyValueInfoList
            title="环境变量"
            emptyText="暂无环境变量"
            tagColor="blue"
            items={(data.envs ?? []).map((item) => ({
              key: item.key,
              label: item.key,
              required: !item.is_optional,
              description: item.description
            }))}
          />
        </section>

        <section className="table-crud-detail__section">
          <h2>资源描述</h2>
          <p className="table-crud-detail__description">{data.description || "暂无描述"}</p>
        </section>
      </section>
    </PagePanel>
  );
}

function InfoItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="table-crud-detail__field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getStatusContext(
  status: "running" | "paused" | "failed" | "draft",
  enabled: boolean
): {
  type: "success" | "info" | "warning" | "error";
  title: string;
  description: string;
} {
  if (!enabled) {
    return {
      type: "warning",
      title: "资源当前未启用",
      description: "资源配置已保留，但不会参与运行调度；启用后才会进入可用状态。"
    };
  }

  const map = {
    running: {
      type: "success" as const,
      title: "资源运行正常",
      description: "当前资源处于可用状态，可以继续查看配置或进入编辑页调整运行参数。"
    },
    paused: {
      type: "info" as const,
      title: "资源已暂停",
      description: "资源暂不参与调度，恢复前建议确认配额、区域和环境变量声明是否仍然有效。"
    },
    failed: {
      type: "error" as const,
      title: "资源存在异常",
      description: "建议优先检查负责人、运行区域、配额和环境变量声明，必要时进入编辑页修正配置。"
    },
    draft: {
      type: "warning" as const,
      title: "资源仍是草稿",
      description: "草稿资源尚未正式生效，补齐必填配置并启用后再投入运行。"
    }
  };

  return map[status];
}
