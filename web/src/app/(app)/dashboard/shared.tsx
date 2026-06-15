import type { User } from "@/lib/types";

export function greeting(role: User["role"]): string {
  switch (role) {
    case "director": return "部门总监";
    case "pm": return "产品经理";
    case "team_leader": return "团队负责人";
    default: return "工程师";
  }
}

export function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function StatCard({
  label,
  value,
  sub,
  color = "text-info",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-border text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
      {sub && <div className="text-[10px] text-dim mt-0.5">{sub}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-blue-900/40 text-info",
    completed: "bg-green-900/40 text-success",
    cancelled: "bg-red-900/40 text-danger",
    todo: "bg-gray-800 text-muted",
    in_progress: "bg-yellow-900/40 text-warning",
    done: "bg-green-900/40 text-success",
    blocked: "bg-red-900/40 text-danger",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-gray-800 text-muted"}`}>
      {status}
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 bg-border rounded-full w-20">
        <div
          className={`h-1.5 rounded-full ${value >= 80 ? "bg-success" : value >= 40 ? "bg-warning" : "bg-danger"}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted">{value}%</span>
    </div>
  );
}

export function DeadlineCell({ deadline }: { deadline?: string }) {
  if (!deadline) return <span className="text-muted text-xs">-</span>;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  const urgent = days <= 3;
  return (
    <span className={`text-xs ${urgent ? "text-danger font-semibold" : "text-muted"}`}>
      {deadline}
      {urgent && days >= 0 ? ` (${days}天)` : ""}
    </span>
  );
}

export function PeriodTabs({ value, onChange }: { value: string; onChange: (v: any) => void }) {
  const options: Array<{ key: string; label: string }> = [
    { key: "today", label: "日" },
    { key: "week", label: "周" },
    { key: "month", label: "月" },
  ];
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`px-2 py-0.5 text-xs rounded ${value === o.key ? "bg-primary text-white" : "bg-background text-muted hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
