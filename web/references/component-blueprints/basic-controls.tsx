// This file is a reference blueprint for AI agents.
// Do not import it into runtime routes.
// Copy the usage pattern, not the mock labels.

import { Button, Checkbox, DatePicker, Form, Input, InputNumber, Radio, Select, Slider, Space, Switch, Tag } from "antd";

import { FileUpload } from "@/shared/components/Upload/FileUpload";
import { getTagColor } from "@/shared/utils/tagColor";

const statusOptions = [
  { label: "运行中", value: "running" },
  { label: "已暂停", value: "paused" },
  { label: "异常", value: "failed" }
];

const tags = ["推理", "GPU", "公开"];

export function BasicControlsReference() {
  return (
    <Form layout="vertical">
      <Form.Item name="name" label="资源名称" rules={[{ required: true, message: "请输入资源名称" }]}>
        <Input placeholder="请输入资源名称" />
      </Form.Item>

      <Form.Item name="keyword" label="搜索">
        <Input.Search allowClear placeholder="搜索资源名称" />
      </Form.Item>

      <Form.Item name="secret" label="密钥">
        <Input.Password placeholder="请输入密钥" />
      </Form.Item>

      <Form.Item name="replicas" label="副本数">
        <InputNumber min={1} max={10} />
      </Form.Item>

      <Form.Item name="status" label="状态">
        <Select allowClear placeholder="请选择状态" options={statusOptions} />
      </Form.Item>

      <Form.Item name="range" label="时间范围">
        <DatePicker.RangePicker format="YYYY-MM-DD" />
      </Form.Item>

      <Form.Item name="enabled" label="启用" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item name="mode" label="模式">
        <Radio.Group
          options={[
            { label: "标准", value: "standard" },
            { label: "高级", value: "advanced" }
          ]}
        />
      </Form.Item>

      <Form.Item name="confirmed" valuePropName="checked">
        <Checkbox>已确认配置无误</Checkbox>
      </Form.Item>

      <Form.Item name="quota" label="配额">
        <Slider min={0} max={100} />
      </Form.Item>

      <Form.Item name="file" label="配置文件">
        <FileUpload accept=".json,.yaml,.yml" maxCount={1} tips="支持 JSON 或 YAML 配置文件" />
      </Form.Item>

      <Space wrap>
        {tags.map((tag, index) => (
          <Tag key={tag} color={getTagColor(tag, index)}>
            {tag}
          </Tag>
        ))}
      </Space>

      <Button type="primary">保存</Button>
    </Form>
  );
}
