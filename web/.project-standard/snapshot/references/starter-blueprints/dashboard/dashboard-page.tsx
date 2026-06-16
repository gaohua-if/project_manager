// Copy the complete dashboard pattern, then replace the example data mapping.

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  UnorderedListOutlined
} from "@ant-design/icons";
import { Button, Space } from "antd";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { setOrDeleteParam } from "@/shared/utils/urlQuery";

import {
  DashboardChartCard,
  DashboardChartGrid,
  DashboardMetricCard,
  DashboardMetricGrid,
  type DashboardMetric,
  type DashboardMetricTone
} from "./dashboard-components";

const metricPresentation: Record<string, { icon: ReactNode; tone: DashboardMetricTone }> = {
  total: { icon: <UnorderedListOutlined />, tone: "primary" },
  succeeded: { icon: <CheckCircleOutlined />, tone: "success" },
  failed: { icon: <CloseCircleOutlined />, tone: "danger" },
  duration: { icon: <ClockCircleOutlined />, tone: "info" }
};

export function BusinessDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const range = searchParams.get("range") ?? "7d";

  // Replace with the feature query hook. Keep all four states explicit.
  const dashboardQuery = {
    data: undefined as
      | {
          metrics: DashboardMetric[];
          trend: unknown[];
          ranking: unknown[];
        }
      | undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: () => undefined
  };

  const updateRange = (nextRange: string) => {
    const params = new URLSearchParams(searchParams);
    setOrDeleteParam(params, "range", nextRange);
    setSearchParams(params);
  };

  const metrics = dashboardQuery.data?.metrics ?? [];
  const metricSlots: DashboardMetric[] = dashboardQuery.isLoading
    ? Array.from({ length: 4 }, (_, index) => ({
        key: `loading-${index}`,
        title: "",
        value: ""
      }))
    : metrics;

  return (
    <PagePanel
      title="业务看板"
      description="展示真实业务指标、趋势和异常状态"
      breadcrumbs={[{ title: "Overview" }, { title: "业务看板" }]}
    >
      <div className="business-dashboard">
        <section className="business-dashboard__toolbar">
          <Space size={8}>
            {["7d", "30d", "90d"].map((value) => (
              <Button
                key={value}
                type={range === value ? "primary" : "default"}
                onClick={() => updateRange(value)}
              >
                近 {value.replace("d", "")} 天
              </Button>
            ))}
          </Space>
          <Button
            icon={<ReloadOutlined />}
            loading={dashboardQuery.isFetching}
            onClick={() => dashboardQuery.refetch()}
          >
            刷新
          </Button>
        </section>

        <DashboardMetricGrid>
          {metricSlots.map((metric) => (
            <DashboardMetricCard
              key={metric.key}
              metric={metric}
              loading={dashboardQuery.isLoading}
              icon={metricPresentation[metric.key]?.icon}
              tone={metricPresentation[metric.key]?.tone}
            />
          ))}
        </DashboardMetricGrid>

        <DashboardChartGrid>
          <DashboardChartCard
            title="业务趋势"
            description="按当前时间范围展示变化"
            loading={dashboardQuery.isLoading}
            empty={!dashboardQuery.isLoading && !dashboardQuery.data?.trend.length}
            error={dashboardQuery.isError}
          >
            <div>{/* Render the business EChart component here. */}</div>
          </DashboardChartCard>
          <DashboardChartCard
            title="Top 排行"
            description="展示当前范围内的关键对象"
            loading={dashboardQuery.isLoading}
            empty={!dashboardQuery.isLoading && !dashboardQuery.data?.ranking.length}
            error={dashboardQuery.isError}
          >
            <div>{/* Render the ranking chart or list here. */}</div>
          </DashboardChartCard>
        </DashboardChartGrid>
      </div>
    </PagePanel>
  );
}
