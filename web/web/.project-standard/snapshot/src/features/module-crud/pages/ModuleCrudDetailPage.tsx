import {
  CodeOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  SettingOutlined
} from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Result, Space, Spin, Tag } from "antd";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { KeyValueInfoList } from "@/shared/components/DetailPatterns/KeyValueInfoList";
import { LogViewer } from "@/shared/components/LogViewer/LogViewer";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { PageSkeleton } from "@/shared/components/PageSkeleton/PageSkeleton";
import { StatusTag } from "@/shared/components/StatusTag/StatusTag";
import { getTagColor } from "@/shared/utils/tagColor";
import { appendSearch, buildListReturnUrl } from "@/shared/utils/urlQuery";

import { useModuleDetail, useModuleLogs } from "../hooks/useModuleCrudQueries";
import "./ModuleCrud.css";

export function ModuleCrudDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const detailQuery = useModuleDetail(id);
  const logsQuery = useModuleLogs(id);
  const backTo = buildListReturnUrl("/examples/module-crud", location.search);

  if (detailQuery.isLoading) return <PageSkeleton rows={8} />;
  if (detailQuery.isError || !detailQuery.data?.data) {
    return <Result status="404" title="模块不存在" subTitle="当前模块不存在或已被删除" />;
  }
  const data = detailQuery.data.data;

  return (
    <PagePanel
      title="模块详情"
      description={data.name}
      backTo={backTo}
      breadcrumbs={[
        { title: "Module CRUD", path: "/examples/module-crud" },
        { title: "模块详情" },
        { title: data.name }
      ]}
      actions={
        <Space>
          <Button onClick={() => detailQuery.refetch()}>刷新</Button>
          <Button
            type="primary"
            onClick={() =>
              navigate(appendSearch(`/examples/module-crud/${data.id}/edit`, location.search))
            }
          >
            编辑
          </Button>
        </Space>
      }
    >
      <div className="module-crud-detail__grid">
        <div>
          <Card
            className="module-crud-detail__card"
            title={
              <Space>
                <DatabaseOutlined />
                基础信息
              </Space>
            }
          >
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
          <Card
            className="module-crud-detail__card"
            title={
              <Space>
                <CodeOutlined />
                运行配置
              </Space>
            }
          >
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="框架">{data.framework}</Descriptions.Item>
              <Descriptions.Item label="镜像">{data.image}</Descriptions.Item>
              <Descriptions.Item label="命令">{data.command}</Descriptions.Item>
              <Descriptions.Item label="建议配置">
                {data.hardware_suggestion || "-"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
          {logsQuery.isLoading ? (
            <Card className="module-crud-detail__card">
              <Spin /> 日志加载中...
            </Card>
          ) : logsQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="日志加载失败"
              action={<Button onClick={() => logsQuery.refetch()}>重试</Button>}
            />
          ) : (
            <LogViewer value={logsQuery.data?.data ?? ""} fileName={`${data.name}.log`} />
          )}
        </div>
        <Card
          className="module-crud-detail__card"
          title={
            <Space>
              <FileTextOutlined />
              参数信息
            </Space>
          }
        >
          <KeyValueInfoList
            title="环境变量"
            icon={<SettingOutlined />}
            tagColor="blue"
            items={data.envs.map((item) => ({
              key: item.key,
              label: item.key,
              required: !item.is_optional,
              description: item.description
            }))}
          />
          <div className="module-crud-detail__divider" />
          <KeyValueInfoList
            title="输入参数"
            icon={<FileTextOutlined />}
            tagColor="purple"
            items={data.inputs.map((item) => ({
              key: item.name,
              label: item.name,
              required: !item.is_optional,
              description: item.description
            }))}
          />
          <div className="module-crud-detail__divider" />
          <KeyValueInfoList
            title="输出参数"
            icon={<FileTextOutlined />}
            tagColor="green"
            outputMode
            items={data.outputs.map((item) => ({
              key: item.name,
              label: item.name,
              type: item.value_type === 1 ? "文件路径" : "普通文本",
              path: item.path,
              description: item.description
            }))}
          />
        </Card>
      </div>
    </PagePanel>
  );
}
