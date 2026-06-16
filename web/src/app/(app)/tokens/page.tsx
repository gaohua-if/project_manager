"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { SessionTokens } from "@/lib/types";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatModels(models: string[]): string {
  if (!models || models.length === 0) return "-";
  return models.join(", ");
}

export default function TokensPage() {
  const [sessions, setSessions] = useState<SessionTokens[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(firstOfMonth.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true);
    api
      .getSessionTokens({ from, to })
      .then((data) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [from, to]);

  const totals = useMemo(() => {
    return sessions.reduce(
      (acc, s) => {
        acc.input += s.input_tokens;
        acc.output += s.output_tokens;
        acc.cacheCreate += s.cache_creation_tokens;
        acc.cacheRead += s.cache_read_tokens;
        acc.total += s.total_tokens;
        return acc;
      },
      { input: 0, output: 0, cacheCreate: 0, cacheRead: 0, total: 0 }
    );
  }, [sessions]);

  const cacheHitRate =
    totals.input + totals.cacheCreate + totals.cacheRead > 0
      ? (totals.cacheRead * 100) / (totals.input + totals.cacheCreate + totals.cacheRead)
      : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Token 明细</h2>
          <p className="text-sm text-muted">按 Session 维度查看 Input / Output / Cache / Total</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-muted text-sm">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Tokens" value={formatTokens(totals.total)} hint={`${sessions.length} sessions`} />
        <StatCard label="Input" value={formatTokens(totals.input)} />
        <StatCard label="Output" value={formatTokens(totals.output)} />
        <StatCard label="Cache Create" value={formatTokens(totals.cacheCreate)} />
        <StatCard label="Cache Read" value={formatTokens(totals.cacheRead)} hint={`hit ${cacheHitRate.toFixed(1)}%`} />
      </div>

      {loading ? (
        <div className="bg-surface rounded-xl p-8 border border-border text-center">
          <p className="text-muted">加载中...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-surface rounded-xl p-8 border border-border text-center">
          <p className="text-muted">所选范围暂无 Session</p>
          <p className="text-xs text-dim mt-2">用 CLI 上传 session 后会出现在此列表</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted font-medium p-3 text-xs">Session</th>
                <th className="text-left text-muted font-medium p-3 text-xs">Agent</th>
                <th className="text-left text-muted font-medium p-3 text-xs">Models</th>
                <th className="text-right text-muted font-medium p-3 text-xs">Input</th>
                <th className="text-right text-muted font-medium p-3 text-xs">Output</th>
                <th className="text-right text-muted font-medium p-3 text-xs">Cache Create</th>
                <th className="text-right text-muted font-medium p-3 text-xs">Cache Read</th>
                <th className="text-right text-muted font-medium p-3 text-xs">Total Tokens</th>
                <th className="text-left text-muted font-medium p-3 text-xs">Started</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.session_id} className="border-b border-border hover:bg-border/30">
                  <td className="p-3">
                    <span className="text-info font-mono text-xs">{s.session_ref.slice(0, 12)}</span>
                  </td>
                  <td className="p-3 text-muted text-xs">{s.agent_type}</td>
                  <td className="p-3 text-muted text-xs">{formatModels(s.models)}</td>
                  <td className="p-3 text-right text-foreground text-xs tabular-nums">
                    {formatTokens(s.input_tokens)}
                  </td>
                  <td className="p-3 text-right text-foreground text-xs tabular-nums">
                    {formatTokens(s.output_tokens)}
                  </td>
                  <td className="p-3 text-right text-foreground text-xs tabular-nums">
                    {formatTokens(s.cache_creation_tokens)}
                  </td>
                  <td className="p-3 text-right text-success text-xs tabular-nums">
                    {formatTokens(s.cache_read_tokens)}
                  </td>
                  <td className="p-3 text-right text-foreground font-semibold text-xs tabular-nums">
                    {formatTokens(s.total_tokens)}
                  </td>
                  <td className="p-3 text-muted text-xs">
                    {new Date(s.started_at).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-background/30">
                <td className="p-3 text-xs font-semibold" colSpan={3}>
                  Total ({sessions.length})
                </td>
                <td className="p-3 text-right text-xs font-semibold tabular-nums">{formatTokens(totals.input)}</td>
                <td className="p-3 text-right text-xs font-semibold tabular-nums">{formatTokens(totals.output)}</td>
                <td className="p-3 text-right text-xs font-semibold tabular-nums">
                  {formatTokens(totals.cacheCreate)}
                </td>
                <td className="p-3 text-right text-xs font-semibold tabular-nums text-success">
                  {formatTokens(totals.cacheRead)}
                </td>
                <td className="p-3 text-right text-xs font-bold tabular-nums">{formatTokens(totals.total)}</td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-dim mt-1">{hint}</p>}
    </div>
  );
}
