import { ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Form, Select, Tooltip } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useMemo } from "react";

import type { DashboardFilters } from "../api/dashboardTypes";
import "./DashboardComponents.css";

type FilterFormValues = {
  range: [Dayjs, Dayjs];
  category?: string;
  owner?: string;
};

interface TimeRangeFilterProps {
  value: DashboardFilters;
  loading?: boolean;
  onChange: (filters: DashboardFilters) => void;
  onRefresh: () => void;
}

function toFilters(values: FilterFormValues): DashboardFilters {
  return {
    start_date: values.range[0].format("YYYY-MM-DD"),
    end_date: values.range[1].format("YYYY-MM-DD"),
    category: values.category,
    owner: values.owner
  };
}

export function TimeRangeFilter({ value, loading, onChange, onRefresh }: TimeRangeFilterProps) {
  const [form] = Form.useForm<FilterFormValues>();
  const formValue = useMemo(
    () => ({
      range: [dayjs(value.start_date), dayjs(value.end_date)] as [Dayjs, Dayjs],
      category: value.category,
      owner: value.owner
    }),
    [value.start_date, value.end_date, value.category, value.owner]
  );
  const categoryOptions = useMemo(
    () => [
      { label: "训练任务", value: "training" },
      { label: "评估任务", value: "evaluation" },
      { label: "推理任务", value: "inference" }
    ],
    []
  );
  const ownerOptions = useMemo(
    () => ["平台组", "算法组", "数据组"].map((item) => ({ label: item, value: item })),
    []
  );

  useEffect(() => {
    form.setFieldsValue(formValue);
  }, [form, formValue]);

  return (
    <Form
      form={form}
      className="dashboard-filter dashboard-filter--refined"
      layout="inline"
      initialValues={formValue}
      onValuesChange={(_, values) => {
        if (!values.range?.[0] || !values.range?.[1]) return;
        onChange(toFilters(values as FilterFormValues));
      }}
    >
      <Form.Item name="range">
        <DatePicker.RangePicker allowClear={false} size="large" />
      </Form.Item>
      <Form.Item name="category">
        <Select
          allowClear
          placeholder="全部分类"
          size="large"
          style={{ width: 140 }}
          options={categoryOptions}
        />
      </Form.Item>
      <Form.Item name="owner">
        <Select
          allowClear
          placeholder="全部团队"
          size="large"
          style={{ width: 140 }}
          options={ownerOptions}
        />
      </Form.Item>
      <Form.Item>
        <Tooltip title="刷新">
          <Button
            aria-label="刷新"
            className="dashboard-filter__refresh"
            icon={<ReloadOutlined />}
            loading={loading}
            size="large"
            onClick={onRefresh}
          />
        </Tooltip>
      </Form.Item>
    </Form>
  );
}
