"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Requirement, Task, TokenAggregation, TeamActivity, TokenPeriod, TokenGroupBy, IdleWarning } from "@/lib/types";
import { AlertBanner } from "@/components/charts/AlertBanner";
import { TokenTrendChart } from "@/components/charts/TokenTrendChart";
import { TokenDistributionPie } from "@/components/charts/TokenDistributionPie";
import { TeamActivityBars } from "@/components/charts/TeamActivityBars";
import { formatTokens, StatCard, StatusBadge, ProgressBar, DeadlineCell, PeriodTabs } from "./shared";

export default function DirectorDashboard({ user }: { user: { name: string; role: string } }) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tokens, setTokens] = useState<TokenAggregation | null>(null);
  const [teamActivity, setTeamActivity] = useState<TeamActivity | null>(null);
  const [period, setPeriod] = useState<TokenPeriod>("week");
  const [groupBy, setGroupBy] = useState<TokenGroupBy>("model");

  useEffect(() => {
    api.getRequirements().then((d) => setRequirements(Array.isArray(d) ? d : [])).catch(() => setRequirements([]));
    api.getTasks().then((d) => setTasks(Array.isArray(d) ? d : [])).catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    api.getTokens({ period, group_by: groupBy }).then(setTokens).catch(() => setTokens(null));
  }, [period, groupBy]);

  useEffect(() => {
    api.getTeamActivity().then(setTeamActivity).catch(() => setTeamActivity(null));
  }, []);

  const todayTokens = tokens?.series?.find((p) => p.date === new Date().toISOString().slice(0, 10))?.value || 0;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const completionRate = tasks.length > 0 ? Math.round((completedTasks * 100) / tasks.length) : 0;
  const crossTeamBlocked = requirements.filter((r) => r.team_ids.length > 1 && r.progress < 100).length;

  const urgentReqs = requirements.filter((r) => {
    if (!r.deadline || r.status === "completed") return false;
    const days = Math.round((new Date(r.deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return days <= 3;
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">🏢 部门总监 · {user.name}</h2>
      <p className="text-sm text-muted mb-6">全局视图 · {requirements.length} 个需求 · {tasks.length} 个任务</p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="今日部门 Session" value="-" color="text-info" />
        <StatCard label="任务完成率" value={`${completionRate}%`} color="text-success" />
        <StatCard label="跨团队进行中" value={crossTeamBlocked} color="text-danger" />
        <StatCard
          label="Token 消耗"
          value={formatTokens(tokens?.total || 0)}
          sub={`今日 ${formatTokens(todayTokens)}`}
          color="text-warning"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <h4 className="text-sm font-semibold text-muted mb-3">
            📊 团队活跃度
            <span className="text-[11px] text-dim ml-2">活跃 = 当日 ≥1 个已上报 Session</span>
          </h4>
          <TeamActivityBars teams={teamActivity?.teams || []} />
          {teamActivity && teamActivity.idle_warnings.length > 0 && (
            <div className="text-[11px] text-dim mt-3">
              沉寂预警:{" "}
              {teamActivity.idle_warnings.slice(0, 5).map((w: IdleWarning, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {w.user_name}({w.team_name})
                  {w.idle_days === 999 ? " 从未" : ` ${w.idle_days}天`}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-muted">Token 趋势</h4>
            <PeriodTabs value={period} onChange={(v) => setPeriod(v as TokenPeriod)} />
          </div>
          <TokenTrendChart series={tokens?.series || []} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-muted">Token 分布 ({period})</h4>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as TokenGroupBy)}
              className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground"
            >
              <option value="model">按模型</option>
              <option value="team">按团队</option>
              <option value="requirement">按需求</option>
              <option value="task">按任务</option>
              <option value="user">按成员</option>
            </select>
          </div>
          <TokenDistributionPie groups={tokens?.groups || []} centerLabel={formatTokens(tokens?.total || 0)} />
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <h4 className="text-sm font-semibold text-muted mb-3">📋 需求总览</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted border-b border-border">
                <th className="text-left pb-2 font-medium">需求</th>
                <th className="text-left pb-2 font-medium">团队</th>
                <th className="text-left pb-2 font-medium">进度</th>
                <th className="text-left pb-2 font-medium">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {requirements.slice(0, 6).map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="py-2">
                    <Link href={`/requirements/${r.id}`} className="text-info hover:underline">{r.title}</Link>
                  </td>
                  <td className="py-2 text-muted">{r.team_names.join("+")}</td>
                  <td className="py-2"><ProgressBar value={r.progress} /></td>
                  <td className="py-2"><DeadlineCell deadline={r.deadline} /></td>
                </tr>
              ))}
              {requirements.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-dim">暂无需求</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {urgentReqs.length > 0 && (
        <AlertBanner level="danger">
          🔴 紧急 deadline:{" "}
          {urgentReqs.map((r, i) => (
            <span key={r.id}>
              {i > 0 && " · "}
              <Link href={`/requirements/${r.id}`} className="underline">
                {r.title}
              </Link>
              {" "}
              ({r.deadline}, {r.progress}%)
            </span>
          ))}
        </AlertBanner>
      )}
    </div>
  );
}
