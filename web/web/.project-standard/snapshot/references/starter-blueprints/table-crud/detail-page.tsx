// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the pattern, not the mock data.

import { Button, Descriptions, Result, Space } from "antd";
import { useParams } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { StatusTag } from "@/shared/components/StatusTag/StatusTag";
import { formatDateTime } from "@/shared/utils/dateTime";
import type { ResourceRecord } from "./types";

export function ResourceDetailPage() {
  const { id } = useParams();

  if (!id) return <Result status="404" title="资源不存在" subTitle="当前资源不存在或已被删除" />;

  // Replace this placeholder with a feature detail query hook.
  const detailQuery = {
    data: undefined as { data: ResourceRecord } | undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: () => undefined
  };

  if (detailQuery.isLoading) return <PageSkeleton rows={8} />;
  if (detailQuery.isError || !detailQuery.data?.data)
    return <Result status="404" title="资源不存在" subTitle="当前资源不存在或已被删除" />;

  const data = detailQuery.data.data;

  return (
    <PagePanel
      title={data.name}
      showNav={false}
      breadcrumbs={[
        { title: "资源管理", path: "/resources" },
        { title: "资源详情" },
        { title: data.name }
      ]}
    >
      <section className="resource-detail">
        <div className="resource-detail__hero">
          <div>
            <span className="resource-detail__eyebrow">RESOURCE</span>
            <h1>{data.name}</h1>
            <p>{data.id}</p>
          </div>
          <div className="resource-detail__hero-side">
            <div className="resource-detail__status">
              <StatusTag status={data.status} />
            </div>
            <Space wrap>
              <Button loading={detailQuery.isFetching} onClick={() => detailQuery.refetch()}>
                刷新
              </Button>
            </Space>
          </div>
        </div>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="资源 ID">{data.id}</Descriptions.Item>
          <Descriptions.Item label="资源名称">{data.name}</Descriptions.Item>
          <Descriptions.Item label="负责人">{data.owner}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <StatusTag status={data.status} />
          </Descriptions.Item>
          <Descriptions.Item label="优先级">{data.priority}</Descriptions.Item>
          <Descriptions.Item label="区域">{data.region}</Descriptions.Item>
          <Descriptions.Item label="更新时间" span={2}>
            {formatDateTime(data.updatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {data.description || "-"}
          </Descriptions.Item>
        </Descriptions>
      </section>
    </PagePanel>
  );
}
