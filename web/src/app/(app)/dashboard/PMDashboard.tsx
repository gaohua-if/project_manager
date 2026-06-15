"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Requirement, TokenAggregation, TokenPeriod, TokenGroupBy, User } from "@/lib/types";
import { TokenDistributionPie } from "@/components/charts/TokenDistributionPie";
import { AlertBanner } from "@/components/charts/AlertBanner";
import { formatTokens, StatCard, ProgressBar, DeadlineCell, PeriodTabs } from "./shared";

export default function PMDashboard({ user }: { user: User }) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [byReq, setByReq] = useState<TokenAggregation | null>(null);
  const [byModel, setByModel] = useState<TokenAggregation | null>(null);
  const [period, setPeriod] = useState<TokenPeriod>("week");

  useEffect(() => {
    api.getRequirements().then((d) => setRequirements(Array.isArray(d) ? d : [])).catch(() => setRequirements([]));
  }, []);

  useEffect(() => {
    api.getTokens({ period, group_by: "requirement" }).then(setByReq).catch(() => setByReq(null));
    api.getTokens({ period, group_by: "model" }).then(setByModel).catch(() => setByModel(null));
  }, [period]);

  const myReqs = requirements.filter((r) => r.creator_id === user.id);
  const others = requirements.filter((r) => r.creator_id !== user.id);

  const tokenByReq = new Map<string, number>();
  (byReq?.groups || []).forEach((g) => tokenByReq.set(g.label, g.value));

  const urgentReqs = requirements.filter((r) => {
    if (!r.deadline || r.status === "completed") return false;
    const days = Math.round((new Date(r.deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return days <= 3;
  });

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">📦 产品经理 · {user.name}</h2>
      <p className="text-sm text-muted mb-6">
        全部 {requirements.length} 个需求 · 我创建 {myReqs.length} 个
      </p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Token 今日" value={formatTokens(byReq?.series?.find(p => p.date === new Date().toISOString().slice(0,10))?.value || 0)} color="text-warning" />
        <StatCard label={`Token ${period}`} value={formatTokens(byReq?.total || 0)} color="text-warning" />
        <StatCard label="紧急 deadline" value={urgentReqs.length} color="text-danger" />
        <StatCard label="已交付需求" value={requirements.filter((r) => r.status === "completed").length} color="text-success" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-muted">Token 按需求 <span className="text-[11px] text-dim ml-1">({period})</span></h4>
            <PeriodTabs value={period} onChange={(v) => setPeriod(v as TokenPeriod)} />
          </div>
          <TokenDistributionPie groups={byReq?.groups || []} centerLabel={formatTokens(byReq?.total || 0)} />
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <h4 className="text-sm font-semibold text-muted mb-3">Token 按模型 <span className="text-[11px] text-dim ml-1">({period})</span></h4>
          <TokenDistributionPie groups={byModel?.groups || []} centerLabel={formatTokens(byModel?.total || 0)} />
        </div>
      </div>

      <div className="bg-surface rounded-xl p-4 border border-border mb-4">
        <h4 className="text-sm font-semibold text-muted mb-3">⭐ 重点关注需求</h4>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted border-b border-border">
              <th className="text-left pb-2 font-medium">需求</th>
              <th className="text-left pb-2 font-medium">AC</th>
              <th className="text-left pb-2 font-medium">进度</th>
              <th className="text-left pb-2 font-medium">本周 Token</th>
              <th className="text-left pb-2 font-medium">Deadline</th>
            </tr>
          </thead>
          <tbody>
            {myReqs.concat(others).slice(0, 8).map((r) => (
              <tr key={r.id} className="border-b border-border/50">
                <td className="py-2">
                  <Link href={`/requirements/${r.id}`} className="text-info hover:underline">
                    {r.creator_id === user.id ? "⭐ " : ""}{r.title}
                  </Link>
                </td>
                <td className="py-2 text-muted">{r.acceptance_criteria?.length || 0} 条</td>
                <td className="py-2"><ProgressBar value={r.progress} /></td>
                <td className="py-2 text-warning">{formatTokens(tokenByReq.get(r.title) || 0)}</td>
                <td className="py-2"><DeadlineCell deadline={r.deadline} /></td>
              </tr>
            ))}
            {requirements.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-dim">暂无需求</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {urgentReqs.length > 0 && (
        <AlertBanner level="danger">
          🔴 紧急 deadline:{" "}
          {urgentReqs.map((r, i) => (
            <span key={r.id}>
              {i > 0 && " · "}
              <Link href={`/requirements/${r.id}`} className="underline">{r.title}</Link>
              {" "}({r.deadline}, {r.progress}%)
            </span>
          ))}
        </AlertBanner>
      )}
    </div>
  );
}
