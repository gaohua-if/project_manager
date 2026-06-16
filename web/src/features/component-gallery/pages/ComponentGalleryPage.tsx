import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Radio,
  Select,
  Skeleton,
  Slider,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload
} from "antd";
import type { TableProps } from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  InboxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  UploadOutlined
} from "@ant-design/icons";
import { useState } from "react";

import { KeyValueInfoList } from "@/shared/components/DetailPatterns/KeyValueInfoList";
import { FormPageWrap } from "@/shared/components/FormPageWrap/FormPageWrap";
import { FormSubmitButton } from "@/shared/components/FormSubmitButton/FormSubmitButton";
import { ParameterListField } from "@/shared/components/FormPatterns/ParameterListField";
import { TwoColumnFormLayout } from "@/shared/components/FormPatterns/TwoColumnFormLayout";
import { LogViewer } from "@/shared/components/LogViewer/LogViewer";
import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { ModuleOrderBar } from "@/shared/components/PagePatterns/ModuleOrderBar";
import type { ModuleOrderType } from "@/shared/components/PagePatterns/ModuleOrderBar";
import { ResourceActions, ResourceTable } from "@/shared/components/ResourceTable/ResourceTable";
import { StatusTag } from "@/shared/components/StatusTag/StatusTag";
import { TableLayout } from "@/shared/components/TableLayout/TableLayout";

import "./ComponentGalleryPage.css";

interface GalleryRow {
  id: string;
  name: string;
  owner: string;
  status: "running" | "paused" | "failed";
}

const selectOptions = [
  { label: "运行中", value: "running" },
  { label: "已暂停", value: "paused" },
  { label: "异常", value: "failed" }
];

const tableRows: GalleryRow[] = [
  { id: "1", name: "模型网关", owner: "平台组", status: "running" },
  { id: "2", name: "训练任务", owner: "算法组", status: "paused" }
];

const tableColumns: TableProps<GalleryRow>["columns"] = [
  { title: "资源名称", dataIndex: "name" },
  { title: "负责人", dataIndex: "owner", width: 120 },
  {
    title: "状态",
    dataIndex: "status",
    width: 120,
    render: (status: GalleryRow["status"]) => <StatusTag status={status} />
  }
];

const logText = `[2026-05-29 10:30:01] INFO  start task
[2026-05-29 10:30:04] INFO  pull image registry.aihub.local/train:latest
[2026-05-29 10:30:12] WARN  retry download chunk
[2026-05-29 10:30:18] INFO  task completed`;

const semanticColors = [
  {
    key: "primary",
    title: "Primary",
    usage: "主操作、焦点、当前项",
    bg: "var(--aihub-color-primary-bg)",
    border: "var(--aihub-color-border-strong)",
    color: "var(--aihub-color-primary)"
  },
  {
    key: "info",
    title: "Info",
    usage: "说明、处理中、普通状态",
    bg: "var(--aihub-color-info-bg)",
    border: "var(--aihub-color-info-border)",
    color: "var(--aihub-color-info)"
  },
  {
    key: "success",
    title: "Success",
    usage: "成功、健康、已完成",
    bg: "var(--aihub-color-success-bg)",
    border: "var(--aihub-color-success-border)",
    color: "var(--aihub-color-success)"
  },
  {
    key: "warning",
    title: "Warning",
    usage: "需关注、等待、可恢复风险",
    bg: "var(--aihub-color-warning-bg)",
    border: "var(--aihub-color-warning-border)",
    color: "var(--aihub-color-warning)"
  },
  {
    key: "danger",
    title: "Danger",
    usage: "失败、删除、不可逆风险",
    bg: "var(--aihub-color-danger-bg)",
    border: "var(--aihub-color-danger-border)",
    color: "var(--aihub-color-danger)"
  }
];

function GallerySection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="component-gallery__section">
      <div className="component-gallery__section-head">
        <Typography.Title level={3}>{title}</Typography.Title>
        {description && <Typography.Paragraph>{description}</Typography.Paragraph>}
      </div>
      <div className="component-gallery__grid">{children}</div>
    </section>
  );
}

function SampleCard({
  title,
  children,
  wide = false
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Card
      className={wide ? "component-gallery__sample is-wide" : "component-gallery__sample"}
      size="small"
      title={title}
    >
      {children}
    </Card>
  );
}

export function ComponentGalleryPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [moduleOrder, setModuleOrder] = useState<{ orderBy: string; orderType: ModuleOrderType }>({
    orderBy: "used_cnt",
    orderType: "desc"
  });

  return (
    <PagePanel
      title="AIHub 组件样板"
      description="单独展示 starter 基础组件的默认样式、状态和尺寸"
      breadcrumbs={[{ title: "Build" }, { title: "Components" }]}
    >
      <GallerySection
        title="交互与语义色"
        description="主交互保持中性克制，语义色只表达状态和风险。"
      >
        {semanticColors.map((item) => (
          <SampleCard key={item.key} title={item.title}>
            <div
              className="component-gallery__tone-card"
              style={{ background: item.bg, borderColor: item.border }}
            >
              <span className="component-gallery__tone-dot" style={{ background: item.color }} />
              <div>
                <Typography.Text style={{ color: item.color }} strong>
                  {item.title}
                </Typography.Text>
                <Typography.Paragraph>{item.usage}</Typography.Paragraph>
              </div>
            </div>
          </SampleCard>
        ))}
      </GallerySection>

      <GallerySection title="基础输入" description="表单和筛选中最常用的数据录入组件。">
        <SampleCard title="Input">
          <Input placeholder="请输入名称" />
        </SampleCard>
        <SampleCard title="Input.Search">
          <Input.Search allowClear placeholder="搜索资源名称" />
        </SampleCard>
        <SampleCard title="Input.Password">
          <Input.Password placeholder="请输入密钥" />
        </SampleCard>
        <SampleCard title="InputNumber">
          <InputNumber min={1} max={10} defaultValue={4} />
        </SampleCard>
        <SampleCard title="Select">
          <Select placeholder="请选择状态" options={selectOptions} />
        </SampleCard>
        <SampleCard title="Select Multiple">
          <Select
            mode="multiple"
            placeholder="请选择团队"
            defaultValue={["platform"]}
            options={[
              { label: "平台组", value: "platform" },
              { label: "算法组", value: "algorithm" },
              { label: "数据组", value: "data" }
            ]}
          />
        </SampleCard>
        <SampleCard title="DatePicker">
          <DatePicker />
        </SampleCard>
        <SampleCard title="RangePicker">
          <DatePicker.RangePicker />
        </SampleCard>
        <SampleCard title="Checkbox">
          <Checkbox defaultChecked>启用自动同步</Checkbox>
        </SampleCard>
        <SampleCard title="Radio.Group">
          <Radio.Group
            optionType="button"
            defaultValue="single"
            options={[
              { label: "单机", value: "single" },
              { label: "多机", value: "multi" }
            ]}
          />
        </SampleCard>
        <SampleCard title="Switch">
          <Switch defaultChecked />
        </SampleCard>
        <SampleCard title="Slider">
          <Slider defaultValue={42} />
        </SampleCard>
      </GallerySection>

      <GallerySection title="操作按钮" description="主操作、次级操作、危险操作和图标按钮。">
        <SampleCard title="Button">
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />}>
              新建
            </Button>
            <Button icon={<ReloadOutlined />}>刷新</Button>
            <Button danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Space>
        </SampleCard>
        <SampleCard title="Tooltip Button">
          <Tooltip title="下载当前结果">
            <Button icon={<DownloadOutlined />} />
          </Tooltip>
        </SampleCard>
        <SampleCard title="ResourceActions">
          <ResourceActions
            actions={[
              { key: "edit", label: "编辑", onClick: () => undefined },
              { key: "delete", label: "删除", danger: true, onClick: () => undefined }
            ]}
          />
        </SampleCard>
      </GallerySection>

      <GallerySection
        title="列表筛选控件"
        description="TableLayout toolbar 中推荐使用的受控筛选组件。"
      >
        <SampleCard title="SearchInput">
          <TableLayout.SearchGroup>
            <TableLayout.SearchInput placeholder="搜索模型名称" />
          </TableLayout.SearchGroup>
        </SampleCard>
        <SampleCard title="TextFilter">
          <TableLayout.SearchGroup>
            <TableLayout.TextFilter placeholder="筛选名称" />
          </TableLayout.SearchGroup>
        </SampleCard>
        <SampleCard title="SelectFilter">
          <TableLayout.SearchGroup>
            <TableLayout.SelectFilter placeholder="状态" options={selectOptions} />
          </TableLayout.SearchGroup>
        </SampleCard>
        <SampleCard title="DateRangeFilter">
          <TableLayout.SearchGroup>
            <TableLayout.DateRangeFilter />
          </TableLayout.SearchGroup>
        </SampleCard>
      </GallerySection>

      <GallerySection title="数据展示" description="状态、标签、表格和详情字段展示。">
        <SampleCard title="Tag">
          <Space wrap>
            <Tag>默认</Tag>
            <Tag color="success">成功</Tag>
            <Tag color="warning">需关注</Tag>
            <Tag color="error">异常</Tag>
          </Space>
        </SampleCard>
        <SampleCard title="StatusTag">
          <Space wrap>
            <StatusTag status="running" />
            <StatusTag status="paused" />
            <StatusTag status="failed" />
          </Space>
        </SampleCard>
        <SampleCard title="Table" wide>
          <Table<GalleryRow>
            rowKey="id"
            size="small"
            columns={tableColumns}
            dataSource={tableRows}
            pagination={false}
          />
        </SampleCard>
        <SampleCard title="ResourceTable" wide>
          <ResourceTable<GalleryRow>
            rowKey="id"
            columns={tableColumns}
            dataSource={tableRows}
            pagination={false}
          />
        </SampleCard>
        <SampleCard title="KeyValueInfoList" wide>
          <KeyValueInfoList
            title="环境变量"
            icon={<SettingOutlined />}
            tagColor="blue"
            items={[
              {
                key: "NCCL_DEBUG",
                label: "NCCL_DEBUG",
                required: true,
                description: "通信调试等级"
              },
              { key: "OMP_NUM_THREADS", label: "OMP_NUM_THREADS", description: "线程数量" }
            ]}
          />
        </SampleCard>
      </GallerySection>

      <GallerySection title="反馈状态" description="全局反馈、局部反馈、加载、空状态和进度。">
        <SampleCard title="Alert Info">
          <Alert type="info" showIcon icon={<InfoCircleOutlined />} message="任务已进入后台队列" />
        </SampleCard>
        <SampleCard title="Alert Success">
          <Alert type="success" showIcon icon={<CheckCircleOutlined />} message="配置已保存" />
        </SampleCard>
        <SampleCard title="Alert Warning">
          <Alert type="warning" showIcon icon={<WarningOutlined />} message="资源同步延迟" />
        </SampleCard>
        <SampleCard title="Alert Error">
          <Alert
            type="error"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="请求失败，请重试"
          />
        </SampleCard>
        <SampleCard title="Skeleton">
          <Skeleton active paragraph={{ rows: 3 }} />
        </SampleCard>
        <SampleCard title="Empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
        </SampleCard>
        <SampleCard title="Progress">
          <Progress percent={68} />
        </SampleCard>
        <SampleCard title="Confirm Modal">
          <Button onClick={() => setModalOpen(true)}>打开确认框</Button>
          <Modal
            title="确认删除资源？"
            open={modalOpen}
            okText="删除"
            okButtonProps={{ danger: true }}
            onCancel={() => setModalOpen(false)}
            onOk={() => setModalOpen(false)}
          >
            <Typography.Paragraph>删除后无法恢复，请确认当前资源不再使用。</Typography.Paragraph>
          </Modal>
        </SampleCard>
      </GallerySection>

      <GallerySection
        title="表单容器与字段组"
        description="只展示组件本身，不替代完整创建/编辑页面样板。"
      >
        <SampleCard title="FormPageWrap" wide>
          <FormPageWrap maxWidth={520} card>
            <Form layout="vertical" initialValues={{ name: "workflow-template" }}>
              <Form.Item label="名称" name="name">
                <Input />
              </Form.Item>
              <FormSubmitButton submitText="保存" />
            </Form>
          </FormPageWrap>
        </SampleCard>
        <SampleCard title="TwoColumnFormLayout" wide>
          <TwoColumnFormLayout
            left={<Alert type="info" showIcon message="左侧配置区" />}
            right={<Alert type="success" showIcon message="右侧参数区" />}
          />
        </SampleCard>
        <SampleCard title="ParameterListField" wide>
          <Form
            layout="vertical"
            initialValues={{
              envs: [{ key: "NCCL_DEBUG", is_optional: false, description: "通信调试等级" }]
            }}
          >
            <ParameterListField name="envs" label="环境变量" kind="env" />
          </Form>
        </SampleCard>
      </GallerySection>

      <GallerySection title="导航与辅助组件" description="页面导航、排序、上传、日志和 Tabs。">
        <SampleCard title="ModuleOrderBar">
          <ModuleOrderBar
            orderBy={moduleOrder.orderBy}
            orderType={moduleOrder.orderType}
            onChange={setModuleOrder}
          />
        </SampleCard>
        <SampleCard title="Upload">
          <Upload>
            <Button icon={<UploadOutlined />}>上传文件</Button>
          </Upload>
        </SampleCard>
        <SampleCard title="Dragger" wide>
          <Upload.Dragger>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">拖拽文件到此处上传</p>
          </Upload.Dragger>
        </SampleCard>
        <SampleCard title="Tabs" wide>
          <Tabs
            items={[
              { key: "overview", label: "概览", children: "基础信息" },
              { key: "logs", label: "日志", children: "运行日志" }
            ]}
          />
        </SampleCard>
        <SampleCard title="LogViewer" wide>
          <LogViewer value={logText} height={180} />
        </SampleCard>
      </GallerySection>

      <GallerySection title="图标" description="常用动作图标应优先来自 Ant Design Icons。">
        <SampleCard title="Icons" wide>
          <Space wrap size={16}>
            <SearchOutlined />
            <PlusOutlined />
            <ReloadOutlined />
            <DownloadOutlined />
            <UploadOutlined />
            <DeleteOutlined />
            <SettingOutlined />
          </Space>
        </SampleCard>
      </GallerySection>
    </PagePanel>
  );
}
