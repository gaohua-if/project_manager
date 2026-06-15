"use client";

import type { TeamStat } from "@/lib/types";

const TEAM_COLORS = [
  "linear-gradient(0deg,#2563eb,#60a5fa)",
  "linear-gradient(0deg,#7c3aed,#a78bfa)",
  "linear-gradient(0deg,#059669,#34d399)",
];

export function TeamActivityBars({ teams }: { teams: TeamStat[] }) {
  if (!teams || teams.length === 0) {
    return <div className="text-xs text-dim py-6 text-center">暂无团队</div>;
  }
  const maxTotal = Math.max(...teams.map((t) => t.total), 1);
  return (
    <div className="flex items-end gap-8 justify-around" style={{ height: 110 }}>
      {teams.map((t, i) => {
        const h = (t.total / maxTotal) * 80;
        const activeH = t.total > 0 ? (t.active / t.total) * h : 0;
        return (
          <div key={t.team_id} className="flex flex-col items-center" style={{ width: 80 }}>
            <div className="relative flex flex-col justify-end" style={{ height: 80, width: 44 }}>
              <div
                className="w-full rounded-t"
                style={{ height: `${h}px`, background: "#334155" }}
                title={`${t.active}/${t.total}`}
              />
              <div
                className="absolute bottom-0 w-full rounded-t"
                style={{ height: `${activeH}px`, background: TEAM_COLORS[i % TEAM_COLORS.length] }}
              />
            </div>
            <div className="text-xs mt-2 text-center">
              <div className="text-foreground">{t.team_name}</div>
              <div className="text-muted mt-0.5">
                <span className="text-success font-semibold">{t.active}</span>
                <span className="text-dim">/{t.total}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
