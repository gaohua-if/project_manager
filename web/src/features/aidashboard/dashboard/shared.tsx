import { Card, Progress, Segmented, Tag, Tooltip } from "antd";
import type { SegmentedOptions } from "antd/es/segmented";
import type { RequirementPriority, RequirementStatus, TaskPriority, TaskStatus } from "../api/types";

export function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

const STAT_CARD_TONES = {
  info: { color: "#1677ff" },
  success: { color: "#52c41a" },
  warning: { color: "#faad14" },
  danger: { color: "#ff4d4f" },
  purple: { color: "#722ed1" }
} as const;

export type StatCardTone = keyof typeof STAT_CARD_TONES;

export function StatCard({
  label,
  value,
  sub,
  tone = "info"
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: StatCardTone;
}) {
  const color = STAT_CARD_TONES[tone].color;
  return (
    <Card size="small" className="aidashboard-stat-card" bodyStyle={{ padding: 16 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{label}</div>
      {sub ? <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div> : null}
    </Card>
  );
}

export function ProgressBar({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const color: "success" | "normal" | "exception" | "active" =
    value >= 80 ? "success" : value >= 40 ? "active" : "exception";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 120 }}>
      <Progress percent={value} size="small" strokeColor={undefined} status={color} style={{ flex: 1, minWidth: 80 }} />
      {showLabel ? <span style={{ fontSize: 12, color: "#6b7280" }}>{value}%</span> : null}
    </div>
  );
}

export function DeadlineCell({ deadline }: { deadline?: string }) {
  if (!deadline) return <span style={{ color: "#9ca3af", fontSize: 12 }}>-</span>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const urgent = days <= 3;
  return (
    <Tooltip title={urgent ? `剩 ${days} 天` : undefined}>
      <span style={{ fontSize: 12, color: urgent ? "#ff4d4f" : "#6b7280", fontWeight: urgent ? 600 : 400 }}>
        {deadline}
        {urgent && days >= 0 ? ` (${days}天)` : ""}
      </span>
    </Tooltip>
  );
}

const TASK_STATUS_META: Record<TaskStatus, { color: string; label: string }> = {
  todo: { color: "default", label: "待办" },
  in_progress: { color: "processing", label: "进行中" },
  done: { color: "success", label: "完成" },
  blocked: { color: "error", label: "阻塞" }
};

const REQ_STATUS_META: Record<RequirementStatus, { color: string; label: string }> = {
  active: { color: "processing", label: "进行中" },
  completed: { color: "success", label: "已完成" },
  cancelled: { color: "default", label: "已取消" }
};

export function TaskStatusTag({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS_META[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export function RequirementStatusTag({ status }: { status: RequirementStatus }) {
  const meta = REQ_STATUS_META[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

const REQ_PRIORITY_META: Record<RequirementPriority, { color: string; label: string }> = {
  low: { color: "default", label: "低" },
  medium: { color: "gold", label: "中" },
  high: { color: "orange", label: "高" },
  urgent: { color: "red", label: "紧急" }
};

const TASK_PRIORITY_META: Record<TaskPriority, { color: string; label: string }> = {
  low: { color: "default", label: "低" },
  medium: { color: "gold", label: "中" },
  high: { color: "orange", label: "高" }
};

export function RequirementPriorityTag({ priority }: { priority: RequirementPriority }) {
  const meta = REQ_PRIORITY_META[priority];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

export function TaskPriorityTag({ priority }: { priority: TaskPriority }) {
  const meta = TASK_PRIORITY_META[priority];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

const PERIOD_OPTIONS: SegmentedOptions = [
  { label: "日", value: "today" },
  { label: "周", value: "week" },
  { label: "月", value: "month" }
];

export function PeriodTabs({
  value,
  onChange
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return <Segmented size="small" options={PERIOD_OPTIONS} value={value} onChange={(v) => onChange(String(v))} />;
}
