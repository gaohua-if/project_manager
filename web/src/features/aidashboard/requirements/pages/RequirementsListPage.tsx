import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Col, DatePicker, Empty, Form, Input, Modal, Row, Select, Space, Table, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

import {
  createRequirement,
  fetchRequirements,
  fetchTeams
} from "../../api/client";
import type { Requirement, RequirementPriority } from "../../api/types";
import {
  ProgressBar,
  RequirementPriorityTag
} from "../../dashboard/shared";

const { Title, Text } = Typography;

interface CreateFormValues {
  title: string;
  description: string;
  priority: RequirementPriority;
  deadline?: dayjs.Dayjs;
  team_ids: string[];
  feishu_doc_url?: string;
}

export function RequirementsListPage() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<CreateFormValues>();

  const { data: requirements = [], isLoading } = useQuery<Requirement[]>({
    queryKey: ["requirements"],
    queryFn: () => fetchRequirements(),
    staleTime: 60_000
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeams(),
    staleTime: 5 * 60_000
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateFormValues) =>
      createRequirement({
        title: values.title.trim(),
        description: values.description.trim(),
        priority: values.priority,
        deadline: values.deadline ? values.deadline.format("YYYY-MM-DD") : undefined,
        team_ids: values.team_ids,
        feishu_doc_url: values.feishu_doc_url || undefined
      }),
    onSuccess: () => {
      message.success("需求已创建");
      setOpen(false);
      form.resetFields();
      void queryClient.invalidateQueries({ queryKey: ["requirements"] });
    },
    onError: (err: unknown) => {
      message.error(err instanceof Error ? err.message : "创建需求失败");
    }
  });

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>需求</Title>
          <Text type="secondary">管理需求和验收标准</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新建需求
        </Button>
      </Space>

      <Card size="small">
        <Table<Requirement>
          rowKey="id"
          dataSource={requirements}
          loading={isLoading}
          pagination={false}
          columns={[
            {
              title: "需求",
              dataIndex: "title",
              render: (title: string, r) => (
                <Space direction="vertical" size={0}>
                  <Link to={`/requirements/${r.id}`}>{title}</Link>
                  {r.feishu_doc_url ? (
                    <a href={r.feishu_doc_url} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>
                      [飞书文档]
                    </a>
                  ) : null}
                </Space>
              )
            },
            {
              title: "创建者",
              dataIndex: "creator_name",
              width: 100
            },
            {
              title: "团队",
              dataIndex: "team_names",
              render: (v: string[]) => v.join(", "),
              width: 160
            },
            {
              title: "AC",
              dataIndex: "acceptance_criteria",
              render: (v: string[]) => v?.length || 0,
              width: 60
            },
            {
              title: "进度",
              dataIndex: "progress",
              render: (v: number) => <ProgressBar value={v} />,
              width: 180
            },
            {
              title: "优先级",
              dataIndex: "priority",
              render: (p: RequirementPriority) => <RequirementPriorityTag priority={p} />,
              width: 90
            },
            {
              title: "截止日期",
              dataIndex: "deadline",
              render: (v?: string) => v || "-",
              width: 120
            }
          ]}
          locale={{ emptyText: <Empty description="暂无需求" /> }}
        />
      </Card>

      <Modal
        title="新建需求"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="创建需求"
        cancelText="取消"
        confirmLoading={createMutation.isPending}
        width={720}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ priority: "medium" }}
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item label="标题" name="title" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="例如:REQ-001 AI 平台 v3.0" />
          </Form.Item>
          <Form.Item label="描述" name="description" rules={[{ required: true, message: "请输入描述" }]}>
            <Input.TextArea rows={4} placeholder="详细描述需求..." />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="优先级" name="priority">
                <Select
                  options={[
                    { value: "low", label: "低" },
                    { value: "medium", label: "中" },
                    { value: "high", label: "高" },
                    { value: "urgent", label: "紧急" }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="截止日期" name="deadline">
                <DatePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="飞书文档 URL" name="feishu_doc_url">
                <Input placeholder="https://..." />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="参与团队"
            name="team_ids"
            rules={[{ required: true, message: "至少选择一个团队", type: "array", min: 1 }]}
          >
            <Select mode="multiple" placeholder="选择团队" options={teams.map((t) => ({ value: t.id, label: t.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
