"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Task, TokenAggregation, TokenPeriod, User } from "@/lib/types";
import { TokenDistributionPie } from "@/components/charts/TokenDistributionPie";
import { AlertBanner } from "@/components/charts/AlertBanner";
import { formatTokens, StatCard, DeadlineCell, PeriodTabs } from "./shared";

export default function EmployeeDashboard({ user }: { user: User }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tokens, setTokens] = useState<TokenAggregation | null>(null);
  const [period, setPeriod] = useState<TokenPeriod>("week");

  useEffect(() => {
    api.getTasks().then((d) => setTasks(Array.isArray(d) ? d : [])).catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    api.getTokens({ period, group_by: "task" }).then(setTokens).catch(() => setTokens(null));
  }, [period]);

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked");

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">🧑‍💻 {user.name} · {user.team_name || "工程师"}</h2>
      <p className="text-sm text-muted mb-6">
        分配 {tasks.length} 个任务 · 完成 {doneCount} · Token {period}: {formatTokens(tokens?.total || 0)}
      </p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="今日 Token" value={formatTokens(tokens?.series?.find(p => p.date === new Date().toISOString().slice(0,10))?.value || 0)} color="text-warning" />
        <StatCard label={`${period} Token`} value={formatTokens(tokens?.total || 0)} color="text-warning" />
        <StatCard label="进行中任务" value={tasks.filter((t) => t.status === "in_progress").length} color="text-info" />
        <StatCard label="已完成" value={doneCount} color="text-success" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <h4 className="text-sm font-semibold text-muted mb-3">📋 我的任务</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted border-b border-border">
                <th className="text-left pb-2 font-medium">任务</th>
                <th className="text-left pb-2 font-medium">需求</th>
                <th className="text-left pb-2 font-medium">状态</th>
                <th className="text-left pb-2 font-medium">截止</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-border/50">
                  <td className="py-2">
                    <Link href={`/tasks/${t.id}`} className="text-info hover:underline">{t.title}</Link>
                  </td>
                  <td className="py-2 text-muted">{t.requirement_title || "-"}</td>
                  <td className="py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                      t.status === "done" ? "bg-green-900/40 text-success" :
                      t.status === "blocked" ? "bg-red-900/40 text-danger" :
                      t.status === "in_progress" ? "bg-yellow-900/40 text-warning" : "bg-gray-800 text-muted"
                    }`}>{t.status}</span>
                  </td>
                  <td className="py-2"><DeadlineCell deadline={t.due_date} /></td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-dim">暂无任务</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-muted">我的 Token 分布 <span className="text-[11px] text-dim ml-1">(按任务)</span></h4>
            <PeriodTabs value={period} onChange={(v) => setPeriod(v as TokenPeriod)} />
          </div>
          <TokenDistributionPie groups={tokens?.groups || []} centerLabel={formatTokens(tokens?.total || 0)} />
        </div>
      </div>

      {blockedTasks.length > 0 && (
        <AlertBanner level="warning">
          ⚠️ 阻塞任务:{" "}
          {blockedTasks.map((t, i) => (
            <span key={t.id}>
              {i > 0 && " · "}
              <Link href={`/tasks/${t.id}`} className="underline">{t.title}</Link>
            </span>
          ))}
        </AlertBanner>
      )}

      <div className="bg-surface rounded-xl p-4 border border-border mt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted">🔗 Session 上报</h4>
          <Link
            href="/sessions"
            className="text-xs bg-primary text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
          >
            前往 Session 管理 →
          </Link>
        </div>
        <p className="text-xs text-dim mt-2">
          上报 Claude Code session,AI 自动关联任务。未勾选永不离机,撤回=物理删除。
        </p>
      </div>
    </div>
  );
}
