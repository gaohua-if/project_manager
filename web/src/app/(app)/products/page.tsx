"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Session, Task, Document } from "@/lib/types";

function useUserRole(): string {
  const [role] = useState(() => {
    if (typeof window === "undefined") return "employee";
    const user = localStorage.getItem("user");
    if (!user) return "employee";
    try {
      return JSON.parse(user).role || "employee";
    } catch {
      return "employee";
    }
  });
  return role;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })} ${fmtTime(iso)}`;
}

export default function ProductsPage() {
  const [date, setDate] = useState("");
  const role = useUserRole();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docDesc, setDocDesc] = useState("");
  const [docTaskId, setDocTaskId] = useState("");

  useEffect(() => {
    const params = date ? { date } : undefined;
    api.getSessions(params).then((d) => setSessions(Array.isArray(d) ? d : [])).catch(() => setSessions([]));
    api.getDocuments(params).then((d) => setDocuments(Array.isArray(d) ? d : [])).catch(() => setDocuments([]));
    api.getTasks().then((d) => setTasks(Array.isArray(d) ? d : [])).catch(() => setTasks([]));
  }, [date]);

  const sortedDocuments = [...documents].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

  // Session handlers
  const handleOverrideTask = async (sessionId: string, taskId: string | null) => {
    try {
      const updated = await api.updateSessionTask(sessionId, taskId);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {}
  };

  const handleWithdraw = async (sessionId: string) => {
    if (!confirm("Withdraw this session?")) return;
    try {
      await api.withdrawSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {}
  };

  const handleViewLog = async (sessionId: string) => {
    try {
      const token = localStorage.getItem("token");
      const url = api.getSessionLogURL(sessionId);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${sessionId}.jsonl`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch { alert("Raw log not available"); }
  };

  const handleAddDoc = async () => {
    if (!docTitle || !docUrl) return;
    try {
      await api.createDocument({
        title: docTitle, url: docUrl,
        description: docDesc || undefined,
        task_id: docTaskId || undefined,
      });
      setShowAddDoc(false);
      setDocTitle(""); setDocUrl(""); setDocDesc(""); setDocTaskId("");
      api.getDocuments(date ? { date } : undefined).then((d) => setDocuments(Array.isArray(d) ? d : []));
    } catch { alert("Failed to add document"); }
  };

  const handleDeleteDoc = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">My Work</h2>
          <p className="text-sm text-muted">Documents and Claude Code sessions are tracked separately</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddDoc(true)}
            className="bg-primary text-white rounded-lg px-3 py-2 text-sm hover:opacity-90"
          >
            + Add Document
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {date && (
            <button onClick={() => setDate("")} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground">
              All
            </button>
          )}
        </div>
      </div>

      {/* Add Document Modal */}
      {showAddDoc && (
        <div className="bg-surface rounded-xl border border-border p-6 mb-4">
          <h3 className="text-sm font-bold mb-4">Add Document</h3>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Title *" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            <input placeholder="URL *" value={docUrl} onChange={(e) => setDocUrl(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            <input placeholder="Description (optional)" value={docDesc} onChange={(e) => setDocDesc(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            <select value={docTaskId} onChange={(e) => setDocTaskId(e.target.value)} className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground">
              <option value="">No task</option>
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowAddDoc(false)} className="px-4 py-2 text-sm text-muted hover:text-foreground">Cancel</button>
            <button onClick={handleAddDoc} disabled={!docTitle || !docUrl} className="bg-primary text-white rounded-lg px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50">Add</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-border bg-surface/90 shadow-[0_20px_60px_rgba(2,8,23,0.24)]">
          <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Documents</h3>
              <p className="text-xs text-dim">{date ? `Uploaded on ${date}` : "Latest uploaded documents"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-info">{sortedDocuments.length}</span>
              <span className="text-xs text-muted">View all</span>
            </div>
          </div>

          {sortedDocuments.length === 0 ? (
            <EmptyState
              title={date ? `No documents uploaded on ${date}` : "No documents yet"}
              detail="Add document links from the action above."
            />
          ) : (
            <div className="divide-y divide-border/70">
              {sortedDocuments.slice(0, 8).map((d) => (
                <div key={d.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 hover:bg-border/25">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-info/30 bg-info/15 text-xs font-bold text-info">
                    DOC
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium text-foreground hover:text-info">
                        {d.title}
                      </a>
                      <span className="rounded bg-info/10 px-1.5 py-0.5 text-[10px] font-medium text-info">Document</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-dim">
                      {fmtDateTime(d.uploaded_at)}
                      {d.description ? ` - ${d.description}` : ""}
                    </p>
                  </div>
                  <span className="hidden rounded bg-background/70 px-2 py-1 text-xs text-muted sm:inline">
                    {d.task_title || "No task"}
                  </span>
                  <button onClick={() => handleDeleteDoc(d.id)} className="text-xs font-medium text-danger hover:underline">
                    Delete
                  </button>
                </div>
              ))}
              {sortedDocuments.length > 8 && (
                <div className="px-4 py-2 text-xs text-dim">{sortedDocuments.length - 8} more documents...</div>
              )}
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-surface/90 shadow-[0_20px_60px_rgba(2,8,23,0.24)]">
          <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Claude Code Sessions</h3>
              <p className="text-xs text-dim">{date ? `Recorded on ${date}` : "Latest session records"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-purple/15 px-2 py-0.5 text-xs font-medium text-purple">{sortedSessions.length}</span>
              <span className="text-xs text-muted">View all Session</span>
            </div>
          </div>

          {sortedSessions.length === 0 ? (
            <EmptyState
              title={date ? `No sessions uploaded on ${date}` : "No sessions found"}
              detail="Upload sessions using the CLI daemon."
            />
          ) : (
            <div className="divide-y divide-border/70">
              {sortedSessions.slice(0, 8).map((s) => (
                <div key={s.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 px-4 py-3 hover:bg-border/25 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-success/30 bg-success/10 text-xs font-bold text-success">
                    &gt;_
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{s.summary || s.session_ref.slice(0, 12)}</span>
                      <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">Session</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-dim">
                      {s.model || "Claude Code"} - {s.duration_secs ? `${Math.floor(s.duration_secs / 60)}m ${s.duration_secs % 60}s` : "Duration unknown"}
                      {role !== "employee" ? ` - ${s.user_name}` : ""}
                    </p>
                  </div>
                  <span className="hidden self-center text-xs text-muted lg:inline">{fmtDateTime(s.uploaded_at)}</span>
                  <select
                    value={s.task_id || ""}
                    onChange={(e) => handleOverrideTask(s.id, e.target.value || null)}
                    className="hidden w-36 self-center rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary sm:block"
                  >
                    <option value="">No task</option>
                    {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  <div className="flex items-center justify-end gap-2 self-center">
                    {s.raw_log_url && <button onClick={() => handleViewLog(s.id)} className="text-xs font-medium text-info hover:underline">Log</button>}
                    <button onClick={() => handleWithdraw(s.id)} className="text-xs font-medium text-danger hover:underline">Withdraw</button>
                  </div>
                </div>
              ))}
              {sortedSessions.length > 8 && (
                <div className="px-4 py-2 text-xs text-dim">{sortedSessions.length - 8} more sessions...</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm text-muted">{title}</p>
      <p className="mt-1 text-xs text-dim">{detail}</p>
    </div>
  );
}
