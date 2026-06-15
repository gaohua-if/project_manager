"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Requirement, Task, TokenAggregation, TokenPeriod, User, TeamActivity } from "@/lib/types";
import { TokenDistributionPie } from "@/components/charts/TokenDistributionPie";
import { AlertBanner } from "@/components/charts/AlertBanner";
import { formatTokens, StatCard, ProgressBar, DeadlineCell, PeriodTabs } from "./shared";

export default function TLDashboard({ user }: { user: User }) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tokens, setTokens] = useState<TokenAggregation | null>(null);
  const [period, setPeriod] = useState<TokenPeriod>("week");
  const [activity, setActivity] = useState<TeamActivity | null>(null);

  useEffect(() => {
    api.getRequirements().then((d) => setRequirements(Array.isArray(d) ? d : [])).catch(() => setRequirements([]));
    api.getTasks().then((d) => setTasks(Array.isArray(d) ? d : [])).catch(() => setTasks([]));
    api.getTeamActivity().then(setActivity).catch(() => setActivity(null));
  }, []);

  useEffect(() => {
    api.getTokens({ period, group_by: "user" }).then(setTokens).catch(() => setTokens(null));
  }, [period]);

  const myTeamMembers = activity?.teams?.find((t) => t.team_id === user.team_id);
  const activeCount = myTeamMembers?.active || 0;
  const totalCount = myTeamMembers?.total || 0;

  const memberTokenRows = (tokens?.groups || []).map((g) => ({
    name: g.label,
    percent: g.percent,
    value: g.value,
  }));

  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">👥 {user.team_name || "团队"} · TL {user.name}</h2>
      <p className="text-sm text-muted mb-6">
        参与 {requirements.length} 个需求 · 拆解 {tasks.length} 个任务 · 活跃度 {activeCount}/{totalCount}
      </p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="今日活跃" value={`${activeCount}/${totalCount}`} color="text-info" />
        <StatCard label="参与需求" value={requirements.length} color="text-purple" />
        <StatCard label="阻碍预警" value={blockedTasks.length} color="text-danger" />
        <StatCard
          label="本队 Token"
          value={formatTokens(tokens?.total || 0)}
          sub={`按 ${period}`}
          color="text-warning"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <h4 className="text-sm font-semibold text-muted mb-3">👤 成员 Token 排名 <span className="text-[11px] text-dim ml-1">({period})</span></h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted border-b border-border">
                <th className="text-left pb-2 font-medium">成员</th>
                <th className="text-left pb-2 font-medium">占比</th>
                <th className="text-right pb-2 font-medium">Token</th>
              </tr>
            </thead>
            <tbody>
              {memberTokenRows.map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 text-foreground">{r.name}</td>
                  <td className="py-2 text-muted">{r.percent.toFixed(0)}%</td>
                  <td className="py-2 text-right text-warning font-semibold">{formatTokens(r.value)}</td>
                </tr>
              ))}
              {memberTokenRows.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-dim">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-muted">Token 分布 <span className="text-[11px] text-dim ml-1">(按成员)</span></h4>
            <PeriodTabs value={period} onChange={(v) => setPeriod(v as TokenPeriod)} />
          </div>
          <TokenDistributionPie groups={tokens?.groups || []} centerLabel={formatTokens(tokens?.total || 0)} />
        </div>
      </div>

      <div className="bg-surface rounded-xl p-4 border border-border mb-4">
        <h4 className="text-sm font-semibold text-muted mb-3">📋 本队任务</h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted border-b border-border">
              <th className="text-left pb-2 font-medium">任务</th>
              <th className="text-left pb-2 font-medium">负责人</th>
              <th className="text-left pb-2 font-medium">状态</th>
              <th className="text-left pb-2 font-medium">进度</th>
              <th className="text-left pb-2 font-medium">截止</th>
            </tr>
          </thead>
          <tbody>
            {tasks.slice(0, 10).map((t) => (
              <tr key={t.id} className="border-b border-border/50">
                <td className="py-2">
                  <Link href={`/tasks/${t.id}`} className="text-info hover:underline">{t.title}</Link>
                </td>
                <td className="py-2 text-muted">{t.assignee_name || "-"}</td>
                <td className="py-2">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                    t.status === "done" ? "bg-green-900/40 text-success" :
                    t.status === "blocked" ? "bg-red-900/40 text-danger" :
                    t.status === "in_progress" ? "bg-yellow-900/40 text-warning" : "bg-gray-800 text-muted"
                  }`}>{t.status}</span>
                </td>
                <td className="py-2 text-muted text-xs">{t.status === "done" ? "100%" : t.status === "in_progress" ? "进行中" : "-"}</td>
                <td className="py-2"><DeadlineCell deadline={t.due_date} /></td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-dim">暂无任务</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {blockedTasks.length > 0 && (
        <AlertBanner level="warning">
          ⚠️ 阻塞任务:{" "}
          {blockedTasks.map((t, i) => (
            <span key={t.id}>
              {i > 0 && " · "}
              <Link href={`/tasks/${t.id}`} className="underline">{t.title}</Link>
              {t.assignee_name ? ` (${t.assignee_name})` : ""}
            </span>
          ))}
        </AlertBanner>
      )}

      <div className="bg-surface rounded-xl p-4 border border-border mt-4">
        <h4 className="text-sm font-semibold text-muted mb-3">📋 本队需求</h4>
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
            {requirements.map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="py-2">
                  <Link href={`/requirements/${r.id}`} className="text-info hover:underline">{r.title}</Link>
                </td>
                <td className="py-2 text-muted">{r.team_names.join("+")}</td>
                <td className="py-2"><ProgressBar value={r.progress} /></td>
                <td className="py-2"><DeadlineCell deadline={r.deadline} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
