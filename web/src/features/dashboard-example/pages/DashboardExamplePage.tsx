import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  UnorderedListOutlined
} from "@ant-design/icons";
import { Alert, Button, Space } from "antd";
import dayjs from "dayjs";
import { useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { PagePanel } from "@/shared/components/PagePanel/PagePanel";
import { setOrDeleteParam } from "@/shared/utils/urlQuery";

import type { DashboardFilters } from "../api/dashboardTypes";
import {
  ChartGrid,
  ChartGridItem,
  DashboardContent,
  MetricGrid
} from "../components/DashboardGrid";
import { MetricCard } from "../components/MetricCard";
import type { MetricCardTone } from "../components/MetricCard";
import { TimeRangeFilter } from "../components/TimeRangeFilter";
import { ResourceUsageBarChart } from "../charts/ResourceUsageBarChart";
import { StatusDonutChart } from "../charts/StatusDonutChart";
import { TopRankingBarChart } from "../charts/TopRankingBarChart";
import { TrendLineChart } from "../charts/TrendLineChart";
import { useDashboardOverview } from "../hooks/useDashboardQueries";
import "./DashboardExamplePage.css";

const rangePresets = [
  { label: "Last 7 days", days: 6 },
  { label: "Last 30 days", days: 29 },
  { label: "Last 90 days", days: 89 }
];
const maxRangeDays = 89;
const metricPresentation: Record<string, { icon: ReactNode; tone: MetricCardTone }> = {
  totalTasks: { icon: <UnorderedListOutlined />, tone: "primary" },
  successRate: { icon: <CheckCircleOutlined />, tone: "success" },
  failedTasks: { icon: <CloseCircleOutlined />, tone: "danger" },
  avgDuration: { icon: <ClockCircleOutlined />, tone: "info" }
};

function getDefaultFilters(): DashboardFilters {
  return {
    start_date: dayjs().subtract(6, "day").format("YYYY-MM-DD"),
    end_date: dayjs().format("YYYY-MM-DD")
  };
}

function getValidDateParam(searchParams: URLSearchParams, key: string, fallback: string) {
  const value = searchParams.get(key);
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : fallback;
}

function getFiltersFromQuery(searchParams: URLSearchParams): DashboardFilters {
  const defaults = getDefaultFilters();
  const startDate = getValidDateParam(searchParams, "start_date", defaults.start_date);
  const endDate = getValidDateParam(searchParams, "end_date", defaults.end_date);
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const rangeInvalid = start.isAfter(end) || end.diff(start, "day") > maxRangeDays;

  return {
    start_date: rangeInvalid ? defaults.start_date : startDate,
    end_date: rangeInvalid ? defaults.end_date : endDate,
    category: searchParams.get("category") ?? undefined,
    owner: searchParams.get("owner") ?? undefined
  };
}

export function DashboardExamplePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => getFiltersFromQuery(searchParams), [searchParams]);
  const overviewQuery = useDashboardOverview(filters);
  const { data, isError, isFetching, isLoading, refetch } = overviewQuery;
  const overview = data?.data;

  const updateFilters = useCallback(
    (nextFilters: DashboardFilters) => {
      const params = new URLSearchParams(searchParams);
      setOrDeleteParam(params, "start_date", nextFilters.start_date);
      setOrDeleteParam(params, "end_date", nextFilters.end_date);
      setOrDeleteParam(params, "category", nextFilters.category);
      setOrDeleteParam(params, "owner", nextFilters.owner);
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const activeRangeDays = useMemo(() => {
    const start = dayjs(filters.start_date);
    const end = dayjs(filters.end_date);
    return end.diff(start, "day");
  }, [filters.end_date, filters.start_date]);

  const handlePresetChange = useCallback(
    (days: number) => {
      updateFilters({
        ...filters,
        start_date: dayjs().subtract(days, "day").format("YYYY-MM-DD"),
        end_date: dayjs().format("YYYY-MM-DD")
      });
    },
    [filters, updateFilters]
  );

  const loading = isLoading;
  const chartError = isError;
  const statusTotal =
    overview?.statusDistribution.reduce((total, item) => total + item.value, 0) ?? 0;
  const failedCount =
    overview?.statusDistribution.find((item) => item.status === "failed")?.value ?? 0;
  const processingCount =
    overview?.statusDistribution.find((item) => item.status === "processing")?.value ?? 0;
  const usageAverage = overview?.resourceUsage.length
    ? Math.round(
        overview.resourceUsage.reduce(
          (total, item) => total + (item.cpu + item.memory + item.storage) / 3,
          0
        ) / overview.resourceUsage.length
      )
    : 0;
  const topPipeline = overview?.topRanking[0];

  return (
    <PagePanel
      title="Dashboard"
      description="平台运行指标、趋势与资源状态概览"
      breadcrumbs={[{ title: "Overview" }, { title: "Dashboard" }]}
    >
      <div className="dashboard-page">
        <DashboardContent>
          <section className="dashboard-commandbar" aria-label="Dashboard controls">
            <Space className="dashboard-commandbar__ranges" size={0}>
              {rangePresets.map((preset) => (
                <Button
                  key={preset.days}
                  className={[
                    "dashboard-commandbar__range",
                    activeRangeDays === preset.days ? "is-active" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handlePresetChange(preset.days)}
                >
                  {preset.label}
                </Button>
              ))}
            </Space>
            <div className="dashboard-commandbar__filters">
              <TimeRangeFilter
                value={filters}
                loading={isFetching}
                onChange={updateFilters}
                onRefresh={handleRefresh}
              />
            </div>
          </section>
          {isError && (
            <Alert
              className="dashboard-page__notice"
              type="error"
              showIcon
              title="Dashboard 数据加载失败"
              description="页面级错误不阻断图表卡片自身的错误态，真实接口接入时可在这里展示统一重试入口。"
              action={<Button onClick={handleRefresh}>重试</Button>}
            />
          )}
          <MetricGrid>
            {[0, 1, 2, 3].map((index) => (
              <MetricCard
                key={overview?.metrics[index]?.key ?? index}
                metric={overview?.metrics[index]}
                loading={loading}
                icon={metricPresentation[overview?.metrics[index]?.key ?? ""]?.icon}
                tone={metricPresentation[overview?.metrics[index]?.key ?? ""]?.tone}
              />
            ))}
          </MetricGrid>
          <section className="dashboard-showcase">
            <div className="dashboard-showcase__main">
              <TrendLineChart data={overview?.trend} loading={loading} error={chartError} />
            </div>
            <aside className="dashboard-insights" aria-label="Dashboard insights">
              <div className="dashboard-insights__section">
                <div className="dashboard-insights__head">
                  <strong>System Health</strong>
                  <span className="dashboard-insights__eyebrow">Live mock</span>
                </div>
                <div className="dashboard-insight-row">
                  <span>Task volume</span>
                  <div className="dashboard-insight-row__value">
                    <i className="is-neutral" />
                    <strong>{statusTotal.toLocaleString()}</strong>
                  </div>
                </div>
                <div className="dashboard-insight-row">
                  <span>Failures</span>
                  <div className="dashboard-insight-row__value">
                    <i className="is-danger" />
                    <strong className="is-danger">{failedCount.toLocaleString()}</strong>
                  </div>
                </div>
                <div className="dashboard-insight-row">
                  <span>Processing</span>
                  <div className="dashboard-insight-row__value">
                    <i className="is-info" />
                    <strong>{processingCount.toLocaleString()}</strong>
                  </div>
                </div>
                <div className="dashboard-insight-row">
                  <span>Avg. utilization</span>
                  <div className="dashboard-insight-row__value">
                    <i className="is-success" />
                    <strong>{usageAverage}%</strong>
                  </div>
                </div>
              </div>
              <div className="dashboard-insights__section dashboard-insights__section--accent">
                <div className="dashboard-insights__head">
                  <strong>Top Pipeline</strong>
                  <span className="dashboard-insights__eyebrow">Current range</span>
                </div>
                <div className="dashboard-pipeline">
                  <em className="dashboard-pipeline__badge">Highest throughput</em>
                  <span>{topPipeline?.name ?? "暂无数据"}</span>
                  <strong>{topPipeline?.value?.toLocaleString() ?? "--"}</strong>
                </div>
              </div>
              <StatusDonutChart
                data={overview?.statusDistribution}
                loading={loading}
                error={chartError}
                height={220}
              />
            </aside>
          </section>
          <ChartGrid>
            <ChartGridItem span={6}>
              <TopRankingBarChart
                data={overview?.topRanking}
                loading={loading}
                error={chartError}
              />
            </ChartGridItem>
            <ChartGridItem span={6}>
              <ResourceUsageBarChart
                data={overview?.resourceUsage}
                loading={loading}
                error={chartError}
              />
            </ChartGridItem>
          </ChartGrid>
        </DashboardContent>
      </div>
    </PagePanel>
  );
}
