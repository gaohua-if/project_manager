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

  // Team report state
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

  const grouped = useMemo(() => {
    if (!isLeader || isTeamLeader) return null;
    const byDate: Record<string, DailyReport[]> = {};
    for (const r of reports) {
      if (!byDate[r.report_date]) byDate[r.report_date] = [];
      byDate[r.report_date].push(r);
    }
    return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));
  }, [reports, isLeader, isTeamLeader]);

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
      setGenerateError(err instanceof Error ? err.message : "Failed to generate report");
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
      setGenerateError(err instanceof Error ? err.message : "Failed to generate team report");
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

  // Employee view
  if (!isLeader) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Daily Reports</h2>
            <p className="text-sm text-muted">View and edit your daily reports</p>
          </div>
          <button
            onClick={generateTodayReport}
            disabled={isGenerating}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
          >
            {isGenerating ? "Generating..." : "Generate AI Report"}
          </button>
        </div>
        {generateError && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {generateError}
          </div>
        )}
        {reports.length === 0 ? (
          <div className="bg-surface rounded-xl p-8 border border-border text-center">
            <p className="text-muted">No reports yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="bg-surface rounded-xl p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{report.report_date}</h3>
                    <p className="text-xs text-muted">
                      {report.user_name} &middot; {report.edited ? "Edited" : "Auto-generated"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {report.feishu_doc_url && (
                      <a href={report.feishu_doc_url} target="_blank" rel="noopener noreferrer"
                        className="bg-blue-900/40 text-info px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                        Feishu Doc
                      </a>
                    )}
                    <button onClick={() => editingId === report.id ? saveEdit() : startEdit(report)}
                      className="bg-border text-foreground px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                      {editingId === report.id ? "Save" : "Edit"}
                    </button>
                  </div>
                </div>
                {editingId === report.id ? (
                  <div className="space-y-3">
                    <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground h-48 focus:outline-none focus:ring-2 focus:ring-primary" />
                    <div>
                      <label className="block text-xs text-muted mb-1">Feishu Doc URL</label>
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

  // Team Leader view
  if (isTeamLeader) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Team Reports</h2>
            <p className="text-sm text-muted">Generate team daily report and view member reports</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateTodayReport}
              disabled={isGenerating}
              className="bg-border text-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-125 disabled:opacity-60 transition-colors"
            >
              {isGenerating ? "Generating..." : "Generate My Report"}
            </button>
          </div>
        </div>

        {generateError && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {generateError}
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-surface rounded-lg p-1 border border-border w-fit">
          <button
            onClick={() => setActiveTab("team")}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === "team" ? "bg-primary text-white" : "text-muted hover:text-foreground"
            }`}
          >
            Team Daily Report
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === "members" ? "bg-primary text-white" : "text-muted hover:text-foreground"
            }`}
          >
            Member Reports
          </button>
        </div>

        {activeTab === "team" ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Today&apos;s Team Report</h3>
              <div className="flex gap-2">
                {teamReport && !editingTeamReport && (
                  <button onClick={startEditTeamReport}
                    className="bg-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                    Edit
                  </button>
                )}
                <button
                  onClick={handleGenerateTeamReport}
                  disabled={isGeneratingTeam}
                  className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
                >
                  {isGeneratingTeam ? "Generating..." : "Generate Team Report"}
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
                      Feishu Doc
                    </a>
                  )}
                </div>
                {editingTeamReport ? (
                  <div className="space-y-3">
                    <textarea value={teamEditContent} onChange={(e) => setTeamEditContent(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground h-64 focus:outline-none focus:ring-2 focus:ring-primary" />
                    <div>
                      <label className="block text-xs text-muted mb-1">Feishu Doc URL</label>
                      <input type="url" value={teamEditFeishuUrl} onChange={(e) => setTeamEditFeishuUrl(e.target.value)}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="https://..." />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveTeamReport}
                        className="bg-primary text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 transition">
                        Save
                      </button>
                      <button onClick={() => setEditingTeamReport(false)}
                        className="bg-border text-foreground px-4 py-1.5 rounded-lg text-sm font-semibold hover:brightness-125 transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">{teamReport.content}</div>
                )}
              </div>
            ) : (
              <div className="bg-surface rounded-xl p-8 border border-border text-center mb-6">
                <p className="text-muted">No team report generated yet. Click &quot;Generate Team Report&quot; to create one.</p>
              </div>
            )}

            {/* Historical team reports */}
            {teamReports.length > 1 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">History</h3>
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
          /* Members tab */
          <div>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm text-muted">Date:</label>
              <input
                type="date"
                value={memberDate}
                onChange={(e) => setMemberDate(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {memberReports.length === 0 ? (
              <div className="bg-surface rounded-xl p-8 border border-border text-center">
                <p className="text-muted">No team members found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {memberReports.map((mr) => (
                  <div key={mr.user_id} className="bg-surface rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-sm font-semibold text-info">{mr.user_name}</span>
                      {mr.has_report ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success bg-green-900/40 px-2 py-0.5 rounded-full">
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-dim bg-border px-2 py-0.5 rounded-full">
                          Not submitted
                        </span>
                      )}
                    </div>
                    {mr.has_report ? (
                      <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">{mr.content}</div>
                    ) : (
                      <p className="text-sm text-dim italic">No report for this date.</p>
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

  // Director / PM view (existing grouped layout)
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Team Reports</h2>
          <p className="text-sm text-muted">View team members&apos; reports and generate department summary</p>
        </div>
        <button
          onClick={generateTodayReport}
          disabled={isGenerating}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-colors"
        >
          {isGenerating ? "Generating..." : "Generate Dept Report"}
        </button>
      </div>
      {generateError && (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          {generateError}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-surface rounded-xl p-8 border border-border text-center">
          <p className="text-muted">No reports yet.</p>
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
                        <span className="text-xs text-dim ml-2">{report.edited ? "Edited" : "Auto-generated"}</span>
                      </div>
                      <div className="flex gap-2">
                        {report.feishu_doc_url && (
                          <a href={report.feishu_doc_url} target="_blank" rel="noopener noreferrer"
                            className="bg-blue-900/40 text-info px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                            Feishu Doc
                          </a>
                        )}
                        {role === "director" && (
                          <button onClick={() => editingId === report.id ? saveEdit() : startEdit(report)}
                            className="bg-border text-foreground px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition">
                            {editingId === report.id ? "Save" : "Edit"}
                          </button>
                        )}
                      </div>
                    </div>
                    {editingId === report.id ? (
                      <div className="space-y-3">
                        <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground h-48 focus:outline-none focus:ring-2 focus:ring-primary" />
                        <div>
                          <label className="block text-xs text-muted mb-1">Feishu Doc URL</label>
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
      ) : null}
    </div>
  );
}
