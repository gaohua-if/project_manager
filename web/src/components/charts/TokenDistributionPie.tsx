"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { TokenGroup } from "@/lib/types";

const COLORS = ["#2563eb", "#a78bfa", "#4ade80", "#fbbf24", "#f87171", "#38bdf8", "#fb923c", "#94a3b8"];

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

export function TokenDistributionPie({
  groups,
  centerLabel,
  size = 110,
}: {
  groups: TokenGroup[];
  centerLabel?: string;
  size?: number;
}) {
  if (!groups || groups.length === 0) {
    return <div className="text-xs text-dim py-6 text-center">暂无数据</div>;
  }
  const data = groups.map((g) => ({ name: g.label, value: g.value, percent: g.percent }));
  const total = groups.reduce((s, g) => s + g.value, 0);

  return (
    <div className="flex items-center gap-3">
      <div style={{ width: size, height: size }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="100%"
              paddingAngle={1}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }}
              formatter={(v: any, _name: any, p: any) => {
                const percent = (p?.payload?.percent as number) || 0;
                return [`${formatTokens(Number(v))} (${percent.toFixed(0)}%)`, p?.payload?.name as string];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-sm font-bold">{centerLabel || formatTokens(total)}</div>
        </div>
      </div>
      <div className="text-xs space-y-1 flex-1 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="truncate text-foreground">{d.name}</span>
            <span className="text-muted ml-auto flex-shrink-0">{d.percent.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
