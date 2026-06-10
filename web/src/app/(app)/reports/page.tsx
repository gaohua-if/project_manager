"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { DailyReport } from "@/lib/types";

export default function ReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editFeishuUrl, setEditFeishuUrl] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    api.getReports({ from: weekAgo, to: today }).then(setReports).catch(() => {});
  }, []);

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Daily Reports</h2>
          <p className="text-sm text-muted">View and edit your daily reports</p>
        </div>
        <button
          onClick={async () => {
            try {
              const report = await api.getTodayReport();
              setReports((prev) => {
                const exists = prev.find((r) => r.id === report.id);
                if (exists) return prev;
                return [report, ...prev];
              });
            } catch {}
          }}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Generate Today&apos;s Report
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="bg-surface rounded-xl p-8 border border-border text-center">
          <p className="text-muted">No reports yet. Click &quot;Generate Today&apos;s Report&quot; to create one.</p>
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
                    <a
                      href={report.feishu_doc_url}
                      target="_blank"
                      className="bg-blue-900/40 text-info px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition"
                    >
                      Feishu Doc
                    </a>
                  )}
                  <button
                    onClick={() =>
                      editingId === report.id ? saveEdit() : startEdit(report)
                    }
                    className="bg-border text-foreground px-3 py-1 rounded-lg text-xs font-semibold hover:brightness-125 transition"
                  >
                    {editingId === report.id ? "Save" : "Edit"}
                  </button>
                </div>
              </div>

              {editingId === report.id ? (
                <div className="space-y-3">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground h-48 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div>
                    <label className="block text-xs text-muted mb-1">Feishu Doc URL</label>
                    <input
                      type="url"
                      value={editFeishuUrl}
                      onChange={(e) => setEditFeishuUrl(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">
                  {report.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
