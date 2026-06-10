"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Session, Task } from "@/lib/types";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    api.getSessions({ date }).then(setSessions).catch(() => {});
    api.getTasks().then(setTasks).catch(() => {});
  }, [date]);

  const handleOverrideTask = async (sessionId: string, taskId: string | null) => {
    try {
      const updated = await api.updateSessionTask(sessionId, taskId);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {}
  };

  const handleWithdraw = async (sessionId: string) => {
    if (!confirm("Withdraw this session? This will permanently delete it.")) return;
    try {
      await api.withdrawSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Sessions</h2>
          <p className="text-sm text-muted">View and manage uploaded Claude Code sessions</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {sessions.length === 0 ? (
        <div className="bg-surface rounded-xl p-8 border border-border text-center">
          <p className="text-muted">No sessions found for {date}</p>
          <p className="text-xs text-dim mt-2">Upload sessions using the CLI daemon: aidashboard upload</p>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-muted font-medium p-3 text-xs">Session</th>
                <th className="text-left text-muted font-medium p-3 text-xs">Time</th>
                <th className="text-left text-muted font-medium p-3 text-xs">Model</th>
                <th className="text-left text-muted font-medium p-3 text-xs">Duration</th>
                <th className="text-left text-muted font-medium p-3 text-xs">Matched Task</th>
                <th className="text-left text-muted font-medium p-3 text-xs">Confidence</th>
                <th className="text-left text-muted font-medium p-3 text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-border/30">
                  <td className="p-3">
                    <span className="text-info font-mono text-xs">{s.session_ref.slice(0, 12)}</span>
                    {s.summary && (
                      <p className="text-xs text-dim mt-0.5 truncate max-w-48">{s.summary}</p>
                    )}
                  </td>
                  <td className="p-3 text-muted text-xs">
                    {new Date(s.started_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    {s.duration_secs && ` (${Math.floor(s.duration_secs / 60)}m)`}
                  </td>
                  <td className="p-3 text-muted text-xs">{s.model}</td>
                  <td className="p-3 text-muted text-xs">
                    {s.duration_secs ? `${Math.floor(s.duration_secs / 60)}m ${s.duration_secs % 60}s` : "-"}
                  </td>
                  <td className="p-3">
                    <select
                      value={s.task_id || ""}
                      onChange={(e) => handleOverrideTask(s.id, e.target.value || null)}
                      className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Not matched</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-xs">
                    {s.match_confidence != null ? (
                      <span className={s.match_confidence > 0.8 ? "text-success" : s.match_confidence > 0.5 ? "text-warning" : "text-danger"}>
                        {Math.round(s.match_confidence * 100)}%
                      </span>
                    ) : (
                      <span className="text-dim">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleWithdraw(s.id)}
                      className="text-xs text-danger hover:underline"
                    >
                      Withdraw
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
