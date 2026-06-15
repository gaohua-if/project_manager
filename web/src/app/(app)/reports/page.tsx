"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import type { DailyReport, TeamReport, TeamMemberReport } from "@/lib/types";

function useUserRole(): string {
  const [role, setRole] = useState("employee");
  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) try { setRole(JSON.parse(u).role); } catch {}
  }, []);
  return role;
}

export default function ReportsPage() {
  const role = useUserRole();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editFeishuUrl, setEditFeishuUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");

  const [activeTab, setActiveTab] = useState<"team" | "members">("team");
  const [teamReport, setTeamReport] = useState<TeamReport | null>(null);
  const [teamReports, setTeamReports] = useState<TeamReport[]>([]);
  const [memberReports, setMemberReports] = useState<TeamMemberReport[]>([]);
  const [memberDate, setMemberDate] = useState(new Date().toISOString().split("T")[0]);
  const [isGeneratingTeam, setIsGeneratingTeam] = useState(false);
  const [editingTeamReport, setEditingTeamReport] = useState(false);
  const [teamEditContent, setTeamEditContent] = useState("");
  const [teamEditFeishuUrl, setTeamEditFeishuUrl] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    api.getReports({ from: weekAgo, to: today }).then((data) => setReports(Array.isArray(data) ? data : [])).catch(() => setReports([]));
  }, []);

  useEffect(() => {
    if (role !== "team_leader") return;
    api.getTeamReportToday().then(setTeamReport).catch(() => setTeamReport(null));
  }, [role]);

  useEffect(() => {
    if (role !== "team_leader") return;
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    api.getTeamReports({ from: weekAgo, to: today }).then((data) => setTeamReports(Array.isArray(data) ? data : [])).catch(() => setTeamReports([]));
  }, [role]);

  useEffect(() => {
    if (role !== "team_leader" || activeTab !== "members") return;
    api.getTeamMemberReports(memberDate).then((data) => setMemberReports(Array.isArray(data) ? data : [])).catch(() => setMemberReports([]));
  }, [role, activeTab, memberDate]);

  const isLeader = role === "team_leader" || role === "pm" || role === "director";
  const isTeamLeader = role === "team_leader";
  const isDirector = role === "director";

  const grouped = useMemo(() => {
    if (!isDirector && !isLeader) return null;
    const byDate: Record<string, DailyReport[]> = {};
    for (const r of reports) {
      if (!byDate[r.report_date]) byDate[r.report_date] = [];
      byDate[r.report_date].push(r);
    }
    return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));
  }, [reports, isLeader, isDirector]);

  const startEdit = (report: DailyReport) => {
    setEditingId(report.id);
    setEditContent(report.content);
    setEditFeishuUrl(report.feishu_doc_url || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const updated = await api.updateReport(editingId, {
        content: editContent,
        feishu_doc_url: editFeishuUrl || undefined,
      });
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingId(null);
    } catch {}
  };

  const generateTodayReport = async () => {
    setIsGenerating(true);
    setGenerateError("");
    try {
      const report = await api.generateTodayReport();
      setReports((prev) => {
        const exists = prev.find((r) => r.id === report.id);
        if (exists) return prev.map((r) => (r.id === report.id ? report : r));
        return [report, ...prev];
      });
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "生成报告失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTeamReport = async () => {
    setIsGeneratingTeam(true);
    setGenerateError("");
    try {
      const tr = await api.generateTeamReport();
      setTeamReport(tr);
      setTeamReports((prev) => {
        const exists = prev.find((r) => r.id === tr.id);
        if (exists) return prev.map((r) => (r.id === tr.id ? tr : r));
        return [tr, ...prev];
      });
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "生成团队报告失败");
    } finally {
      setIsGeneratingTeam(false);
    }
  };

  const startEditTeamReport = () => {
    if (!teamReport) return;
    setEditingTeamReport(true);
    setTeamEditContent(teamReport.content);
    setTeamEditFeishuUrl(teamReport.feishu_doc_url || "");
  };

  const saveTeamReport = async () => {
    if (!teamReport) return;
    try {
      const updated = await api.updateTeamReport(teamReport.id, {
        content: teamEditContent,
        feishu_doc_url: teamEditFeishuUrl || undefined,
      });
      setTeamReport(updated);
      setTeamReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingTeamReport(false);
    } catch {}
  };

  // 员工视图
  if (!isLeader) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">个人日报</h2>
            <p className="text-sm text-muted">查看和编辑你的日报</p>
          </div>
          <button
            onClick={generateTodayReport}
            disabled={isGenerating}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
          >
            {isGenerating ? "生成中..." : "生成 AI 日报"}
          </button>
        </div>
        {generateError && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {generateError}
          </div>
        )}
        {reports.length === 0 ? (
          <div className="bg-surface rounded-xl p-8 border border-border text-center">
            <p className="text-muted">暂无报告。</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-surface rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{report.report_date}</h3>
                    <p className="text-xs text-muted">
                      {report.user_name} &middot; {report.edited ? "已编辑" : "自动生成"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {report.feishu_doc_url && (
                      <a href={report.feishu_doc_url} target="_blank" rel="noopener noreferrer"
                        className="bg-blue-900/40 text-info px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                        飞书文档
                      </a>
                    )}
                    <button onClick={() => editingId === report.id ? saveEdit() : startEdit(report)}
                      className="bg-border text-foreground px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                      {editingId === report.id ? "保存" : "编辑"}
                    </button>
                  </div>
                </div>
                {editingId === report.id ? (
                  <div className="space-y-3">
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground h-48 focus:outline-none focus:ring-2 focus:ring-primary" />
                    <div>
                      <label className="block text-xs text-muted mb-1">飞书文档 URL</label>
                      <input type="url" value={editFeishuUrl} onChange={(e) => setEditFeishuUrl(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">{report.content}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 团队负责人视图
  if (isTeamLeader) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">团队日报</h2>
            <p className="text-sm text-muted">生成团队日报并查看成员日报</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateTodayReport}
              disabled={isGenerating}
              className="bg-border text-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-125 disabled:opacity-60 transition-colors"
            >
              {isGenerating ? "生成中..." : "生成我的日报"}
            </button>
          </div>
        </div>

        {generateError && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {generateError}
          </div>
        )}

        <div className="flex gap-1 mb-6 bg-surface rounded-lg p-1 border border-border w-fit">
          <button
            onClick={() => setActiveTab("team")}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === "team" ? "bg-primary text-white" : "text-muted hover:text-foreground"
            }`}
          >
            团队日报
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === "members" ? "bg-primary text-white" : "text-muted hover:text-foreground"
            }`}
          >
            成员日报
          </button>
        </div>

        {activeTab === "team" ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">今日团队日报</h3>
              <div className="flex gap-2">
                {teamReport && !editingTeamReport && (
                  <button onClick={startEditTeamReport}
                    className="bg-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                    编辑
                  </button>
                )}
                <button
                  onClick={handleGenerateTeamReport}
                  disabled={isGeneratingTeam}
                  className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
                >
                  {isGeneratingTeam ? "生成中..." : "生成团队日报"}
                </button>
              </div>
            </div>

            {teamReport ? (
              <div className="bg-surface rounded-xl p-4 border border-border mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-semibold text-info">{teamReport.team_name}</span>
                  <span className="text-xs text-dim">{teamReport.report_date}</span>
                  {teamReport.feishu_doc_url && (
                    <a href={teamReport.feishu_doc_url} target="_blank" rel="noopener noreferrer"
                      className="bg-blue-900/40 text-info px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                      飞书文档
                    </a>
                  )}
                </div>
                {editingTeamReport ? (
                  <div className="space-y-3">
                    <textarea value={teamEditContent} onChange={(e) => setTeamEditContent(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground h-64 focus:outline-none focus:ring-2 focus:ring-primary" />
                    <div>
                      <label className="block text-xs text-muted mb-1">飞书文档 URL</label>
                      <input type="url" value={teamEditFeishuUrl} onChange={(e) => setTeamEditFeishuUrl(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveTeamReport}
                        className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 transition">
                        保存
                      </button>
                      <button onClick={() => setEditingTeamReport(false)}
                        className="bg-border text-foreground px-4 py-1.5 rounded-lg text-sm font-semibold hover:brightness-125 transition">
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">{teamReport.content}</div>
                )}
              </div>
            ) : (
              <div className="bg-surface rounded-xl p-8 border border-border text-center mb-6">
                <p className="text-muted">尚未生成团队日报,点击 &quot;生成团队日报&quot; 创建。</p>
              </div>
            )}

            {teamReports.length > 1 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">历史日报</h3>
                <div className="space-y-3">
                  {teamReports.filter((r) => r.id !== teamReport?.id).map((tr) => (
                    <details key={tr.id} className="bg-surface rounded-xl border border-border">
                      <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-foreground hover:bg-border/30 transition-colors rounded-xl">
                        {tr.report_date} — {tr.team_name}
                      </summary>
                      <div className="px-4 pb-4 text-sm whitespace-pre-wrap text-muted leading-relaxed">{tr.content}</div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm text-muted">日期:</label>
              <input
                type="date"
                value={memberDate}
                onChange={(e) => setMemberDate(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {memberReports.length === 0 ? (
              <div className="bg-surface rounded-xl p-8 border border-border text-center">
                <p className="text-muted">未找到团队成员。</p>
              </div>
            ) : (
              <div className="space-y-3">
                {memberReports.map((mr) => (
                  <div key={mr.user_id} className="bg-surface rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-semibold text-info">{mr.user_name}</span>
                      {mr.has_report ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success bg-green-900/40 px-2 py-0.5 rounded-full">
                          已提交
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-dim bg-border px-2 py-0.5 rounded-full">
                          未提交
                        </span>
                      )}
                    </div>
                    {mr.has_report ? (
                      <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">{mr.content}</div>
                    ) : (
                      <p className="text-sm text-dim italic">该日期暂无报告。</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 总监视图:生成部门日报,可切换小组日报/员工日报两个 Tab
  if (isDirector) {
    return (
      <DirectorReportsView
        reports={reports}
        grouped={grouped}
        editingId={editingId}
        editContent={editContent}
        editFeishuUrl={editFeishuUrl}
        setEditContent={setEditContent}
        setEditFeishuUrl={setEditFeishuUrl}
        startEdit={startEdit}
        saveEdit={saveEdit}
        isGenerating={isGenerating}
        generateError={generateError}
        onGenerateDept={generateTodayReport}
      />
    );
  }

  // PM 视图(沿用原分组)
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">日报</h2>
          <p className="text-sm text-muted">查看团队成员日报</p>
        </div>
        <button
          onClick={generateTodayReport}
          disabled={isGenerating}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
        >
          {isGenerating ? "生成中..." : "生成我的日报"}
        </button>
      </div>
      {generateError && (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {generateError}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-surface rounded-xl p-8 border border-border text-center">
          <p className="text-muted">暂无报告。</p>
        </div>
      ) : grouped ? (
        <div className="space-y-6">
          {grouped.map(([date, dateReports]) => (
            <div key={date}>
              <h3 className="text-sm font-bold text-foreground mb-3">{date}</h3>
              <div className="space-y-3">
                {dateReports.map((report) => (
                  <div key={report.id} className="bg-surface rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-sm font-semibold text-info">{report.user_name}</span>
                        <span className="text-xs text-dim ml-2">{report.edited ? "已编辑" : "自动生成"}</span>
                      </div>
                      <div className="flex gap-2">
                        {report.feishu_doc_url && (
                          <a href={report.feishu_doc_url} target="_blank" rel="noopener noreferrer"
                            className="bg-blue-900/40 text-info px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                            飞书文档
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">{report.content}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DirectorReportsView({
  reports,
  grouped,
  editingId,
  editContent,
  editFeishuUrl,
  setEditContent,
  setEditFeishuUrl,
  startEdit,
  saveEdit,
  isGenerating,
  generateError,
  onGenerateDept,
}: {
  reports: DailyReport[];
  grouped: Array<[string, DailyReport[]]> | null;
  editingId: string | null;
  editContent: string;
  editFeishuUrl: string;
  setEditContent: (v: string) => void;
  setEditFeishuUrl: (v: string) => void;
  startEdit: (r: DailyReport) => void;
  saveEdit: () => void;
  isGenerating: boolean;
  generateError: string;
  onGenerateDept: () => void;
}) {
  const [tab, setTab] = useState<"teams" | "employees">("teams");
  const [deptContent, setDeptContent] = useState("");
  const [deptDate, setDeptDate] = useState(new Date().toISOString().split("T")[0]);
  const [deptGenerating, setDeptGenerating] = useState(false);
  const [deptEdited, setDeptEdited] = useState(false);
  const [deptError, setDeptError] = useState("");

  const generateDept = async () => {
    setDeptGenerating(true);
    setDeptError("");
    try {
      const r = await api.generateTodayReport();
      setDeptContent(r.content);
      setDeptEdited(false);
    } catch (err) {
      setDeptError(err instanceof Error ? err.message : "生成部门日报失败");
    } finally {
      setDeptGenerating(false);
    }
  };

  // 首次进入时,聚合当日员工日报作为部门日报草稿
  useEffect(() => {
    if (!deptContent && grouped && grouped.length > 0) {
      const todayKey = new Date().toISOString().split("T")[0];
      const todayEntry = grouped.find(([d]) => d === todayKey);
      const list = todayEntry ? todayEntry[1] : grouped[0][1];
      if (list.length > 0) {
        const summary = list
          .map((r) => `### ${r.user_name}\n${r.content}`)
          .join("\n\n---\n\n");
        setDeptContent(`# 部门日报 ${todayKey}\n\n本部门共 ${list.length} 份成员日报。\n\n---\n\n${summary}`);
      }
    }
  }, [grouped, deptContent]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">部门报告</h2>
          <p className="text-sm text-muted">生成部门日报,下方可查看小组日报与员工日报</p>
        </div>
      </div>

      {generateError && (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {generateError}
        </div>
      )}

      {/* 顶部:部门日报(始终可见) */}
      <div className="bg-surface rounded-xl p-4 border border-border mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">🏢 部门日报</h3>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={deptDate}
              onChange={(e) => setDeptDate(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={generateDept}
              disabled={deptGenerating}
              className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {deptGenerating ? "生成中..." : "🤖 生成部门日报"}
            </button>
          </div>
        </div>
        {deptError && <p className="text-sm text-danger mb-3">{deptError}</p>}
        <textarea
          value={deptContent}
          onChange={(e) => { setDeptContent(e.target.value); setDeptEdited(true); }}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground h-64 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder='点击 "🤖 生成部门日报" 由 AI 汇总各部门日报,或在此手动编辑...'
        />
        {deptEdited && <p className="text-xs text-warning mt-2">已手动编辑</p>}
      </div>

      {/* 下方:两个 Tab */}
      <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1 border border-border w-fit">
        <button
          onClick={() => setTab("teams")}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${tab === "teams" ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
        >
          小组日报
        </button>
        <button
          onClick={() => setTab("employees")}
          className={`px-4 py-2 rounded-md text-sm font-semibold ${tab === "employees" ? "bg-primary text-white" : "text-muted hover:text-foreground"}`}
        >
          员工日报
        </button>
      </div>

      {tab === "teams" && <TeamReportsTab />}
      {tab === "employees" && (
        <EmployeeReportsTab
          grouped={grouped}
          reports={reports}
          editingId={editingId}
          editContent={editContent}
          editFeishuUrl={editFeishuUrl}
          setEditContent={setEditContent}
          setEditFeishuUrl={setEditFeishuUrl}
          startEdit={startEdit}
          saveEdit={saveEdit}
        />
      )}
    </div>
  );
}

function TeamReportsTab() {
  const [list, setList] = useState<TeamReport[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    api.getTeamReports({ from: weekAgo, to: today })
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted text-sm">加载中...</p>;
  if (list.length === 0) {
    return (
      <div className="bg-surface rounded-xl p-8 border border-border text-center">
        <p className="text-muted">暂无团队日报。各团队 TL 可在其 Reports 页面生成。</p>
      </div>
    );
  }

  const byDate: Record<string, TeamReport[]> = {};
  for (const r of list) {
    if (!byDate[r.report_date]) byDate[r.report_date] = [];
    byDate[r.report_date].push(r);
  }
  const entries = Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {entries.map(([date, rs]) => (
        <div key={date}>
          <h3 className="text-sm font-bold text-foreground mb-3">{date}</h3>
          <div className="space-y-3">
            {rs.map((r) => (
              <div key={r.id} className="bg-surface rounded-xl p-4 border border-border">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-semibold text-info">{r.team_name}</span>
                  <span className="text-xs text-dim">由 {r.leader_name} 生成</span>
                  {r.feishu_doc_url && (
                    <a href={r.feishu_doc_url} target="_blank" rel="noopener noreferrer"
                      className="bg-blue-900/40 text-info px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                      飞书文档
                    </a>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">{r.content}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmployeeReportsTab({
  grouped,
  reports,
  editingId,
  editContent,
  editFeishuUrl,
  setEditContent,
  setEditFeishuUrl,
  startEdit,
  saveEdit,
}: {
  grouped: Array<[string, DailyReport[]]> | null;
  reports: DailyReport[];
  editingId: string | null;
  editContent: string;
  editFeishuUrl: string;
  setEditContent: (v: string) => void;
  setEditFeishuUrl: (v: string) => void;
  startEdit: (r: DailyReport) => void;
  saveEdit: () => void;
}) {
  if (reports.length === 0) {
    return (
      <div className="bg-surface rounded-xl p-8 border border-border text-center">
        <p className="text-muted">暂无员工日报。</p>
      </div>
    );
  }
  if (!grouped) return null;

  return (
    <div className="space-y-6">
      {grouped.map(([date, dateReports]) => (
        <div key={date}>
          <h3 className="text-sm font-bold text-foreground mb-3">{date}</h3>
          <div className="space-y-3">
            {dateReports.map((report) => (
              <div key={report.id} className="bg-surface rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-semibold text-info">{report.user_name}</span>
                    <span className="text-xs text-dim ml-2">{report.edited ? "已编辑" : "自动生成"}</span>
                  </div>
                  <div className="flex gap-2">
                    {report.feishu_doc_url && (
                      <a href={report.feishu_doc_url} target="_blank" rel="noopener noreferrer"
                        className="bg-blue-900/40 text-info px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                        飞书文档
                      </a>
                    )}
                    <button onClick={() => editingId === report.id ? saveEdit() : startEdit(report)}
                      className="bg-border text-foreground px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                      {editingId === report.id ? "保存" : "编辑"}
                    </button>
                  </div>
                </div>
                {editingId === report.id ? (
                  <div className="space-y-3">
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground h-48 focus:outline-none focus:ring-2 focus:ring-primary" />
                    <div>
                      <label className="block text-xs text-muted mb-1">飞书文档 URL</label>
                      <input type="url" value={editFeishuUrl} onChange={(e) => setEditFeishuUrl(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">{report.content}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
