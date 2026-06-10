"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { User, Requirement, Task } from "@/lib/types";
import Link from "next/link";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const u = api.getUser();
    if (!u) return;
    setUser(u);

    api.getRequirements().then(setRequirements).catch(() => {});
    if (u.role === "employee") {
      api.getTasks().then(setTasks).catch(() => {});
    } else if (u.role === "team_leader") {
      api.getTasks().then(setTasks).catch(() => {});
    }
  }, []);

  if (!user) return null;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">
        {greeting(user)} &middot; {user.name}
      </h2>
      <p className="text-sm text-muted mb-6">{roleDescription(user.role)}</p>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Requirements"
          value={requirements.length}
          color="text-info"
        />
        <StatCard
          label="Active"
          value={requirements.filter((r) => r.status === "active").length}
          color="text-warning"
        />
        <StatCard
          label="Completed"
          value={requirements.filter((r) => r.status === "completed").length}
          color="text-success"
        />
        <StatCard
          label="My Tasks"
          value={tasks.length}
          color="text-purple"
        />
      </div>

      {/* Quick Actions */}
      {(user.role === "director" || user.role === "pm" || user.role === "team_leader") && (
        <div className="mb-6">
          <Link
            href="/requirements"
            className="inline-block bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold mr-2 hover:bg-blue-700 transition-colors"
          >
            Requirements
          </Link>
          {user.role === "team_leader" && (
            <Link
              href="/tasks"
              className="inline-block bg-purple text-white px-4 py-2 rounded-lg text-sm font-semibold hover:brightness-110 transition"
            >
              Manage Tasks
            </Link>
          )}
        </div>
      )}

      {/* Requirements Table */}
      <div className="bg-surface rounded-xl p-4 border border-border">
        <h4 className="text-sm font-semibold text-muted mb-3">Recent Requirements</h4>
        {requirements.length === 0 ? (
          <p className="text-sm text-dim">No requirements yet. Create one to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Requirement</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Creator</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Status</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Progress</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {requirements.slice(0, 10).map((req) => (
                <tr key={req.id}>
                  <td className="py-2">
                    <Link href={`/requirements/${req.id}`} className="text-info hover:underline">
                      {req.title}
                    </Link>
                  </td>
                  <td className="py-2 text-muted">{req.creator_name}</td>
                  <td className="py-2">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 bg-border rounded-full w-20">
                        <div
                          className="h-1.5 rounded-full bg-success"
                          style={{ width: `${req.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted">{req.progress}%</span>
                    </div>
                  </td>
                  <td className="py-2 text-muted text-xs">{req.deadline || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tasks for employee */}
      {user.role === "employee" && tasks.length > 0 && (
        <div className="bg-surface rounded-xl p-4 border border-border mt-4">
          <h4 className="text-sm font-semibold text-muted mb-3">My Tasks</h4>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Task</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Requirement</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Status</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td className="py-2">
                    <Link href={`/tasks/${t.id}`} className="text-info hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="py-2 text-muted">{t.requirement_title}</td>
                  <td className="py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-2 text-muted text-xs">{t.due_date || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-border text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-blue-900/40 text-info",
    completed: "bg-green-900/40 text-success",
    cancelled: "bg-red-900/40 text-danger",
    todo: "bg-gray-800 text-muted",
    in_progress: "bg-yellow-900/40 text-warning",
    done: "bg-green-900/40 text-success",
    blocked: "bg-red-900/40 text-danger",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-gray-800 text-muted"}`}>
      {status}
    </span>
  );
}

function greeting(user: User): string {
  switch (user.role) {
    case "director": return "Director";
    case "pm": return "PM";
    case "team_leader": return "Team Leader";
    default: return "Engineer";
  }
}

function roleDescription(role: string): string {
  switch (role) {
    case "director": return "Department overview - all teams, requirements, and metrics";
    case "pm": return "Track requirements, acceptance criteria, and delivery progress";
    case "team_leader": return "Manage team tasks, track progress, and review sessions";
    default: return "View your tasks, upload sessions, and manage daily reports";
  }
}
