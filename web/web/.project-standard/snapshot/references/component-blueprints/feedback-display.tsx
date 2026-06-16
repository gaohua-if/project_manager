// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the usage pattern, not the mock labels.

import { DeleteOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Progress, Skeleton } from "antd";

import { KeyValueInfoList } from "@/shared/components/DetailPatterns/KeyValueInfoList";
import { LogViewer } from "@/shared/components/LogViewer/LogViewer";
import { confirmDangerAction } from "@/shared/components/ResourceTable/confirmDangerAction";

export function FeedbackDisplayReference() {
  return (
    <section>
      <Alert type="info" showIcon message="配置已保存" />
      <Alert type="warning" showIcon message="配额即将用尽" />
      <Alert type="error" showIcon message="请求失败" />

      <Skeleton active paragraph={{ rows: 4 }} />
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
      <Progress percent={68} />

      <Button
        danger
        icon={<DeleteOutlined />}
        onClick={() =>
          confirmDangerAction({
            title: "确认删除该资源？",
            content: "删除后无法恢复",
            okText: "删除",
            onConfirm: async () => undefined
          })
        }
      >
        删除资源
      </Button>

      <KeyValueInfoList
        title="基础信息"
        items={[
          { key: "owner", label: "负责人", value: "平台组" },
          { key: "status", label: "状态", value: "运行中" }
        ]}
      />

      <LogViewer title="运行日志" value="[2026-05-29 10:30:01] INFO task started" />
    </section>
  );
}
