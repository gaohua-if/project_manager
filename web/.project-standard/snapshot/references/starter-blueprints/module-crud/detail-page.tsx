// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the pattern, not the mock data.

import { Button, Card, Descriptions, Result, Space, Tag } from "antd";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { KeyValueInfoList } from "@/shared/components/DetailPatterns/KeyValueInfoList";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { StatusTag } from "@/shared/components/StatusTag/StatusTag";
import { getTagColor } from "@/shared/utils/tagColor";
import { appendSearch, buildListReturnUrl } from "@/shared/utils/urlQuery";

import type { ModuleRecord } from "./types";

export function ModuleDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = buildListReturnUrl("/modules", location.search);

  // Replace this placeholder with a feature detail query hook.
  const detailQuery = {
    data: undefined as { data: ModuleRecord } | undefined,
    isLoading: false,
    isError: false,
    refetch: () => undefined
  };

  if (detailQuery.isLoading) return <PageSkeleton rows={8} />;
  if (detailQuery.isError || !detailQuery.data?.data)
    return <Result status="404" title="模块不存在" subTitle="当前模块不存在或已被删除" />;

  const data = detailQuery.data.data;

  return (
    <PagePanel
      title="模块详情"
      description={data.name}
      backTo={backTo}
      breadcrumbs={[
        { title: "模块管理", path: "/modules" },
        { title: "模块详情" },
        { title: data.name }
      ]}
      actions={
        <Space>
          <Button onClick={() => detailQuery.refetch()}>刷新</Button>
          <Button
            type="primary"
            onClick={() => navigate(appendSearch(`/modules/${id}/edit`, location.search))}
          >
            编辑
          </Button>
        </Space>
      }
    >
      <Card title="基础信息">
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="模块名称">{data.name}</Descriptions.Item>
          <Descriptions.Item label="负责人">{data.owner}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <StatusTag status={data.status} />
          </Descriptions.Item>
          <Descriptions.Item label="标签">
            {data.tags.map((tag, index) => (
              <Tag key={tag} color={getTagColor(tag, index)}>
                {tag}
              </Tag>
            ))}
          </Descriptions.Item>
          <Descriptions.Item label="说明">{data.description || "-"}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="参数信息">
        <KeyValueInfoList title="环境变量" items={[]} />
        <KeyValueInfoList title="输入参数" items={[]} />
        <KeyValueInfoList title="输出参数" items={[]} outputMode />
      </Card>
    </PagePanel>
  );
}
