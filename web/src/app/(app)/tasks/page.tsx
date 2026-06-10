"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Task } from "@/lib/types";
import Link from "next/link";

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.getTasks(filter ? { status: filter } : undefined).then(setTasks).catch(() => {});
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Tasks</h2>
          <p className="text-sm text-muted">View and manage tasks</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Status</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <div className="bg-surface rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted font-medium p-3 text-xs">Task</th>
              <th className="text-left text-muted font-medium p-3 text-xs">Requirement</th>
              <th className="text-left text-muted font-medium p-3 text-xs">Assignee</th>
              <th className="text-left text-muted font-medium p-3 text-xs">Status</th>
              <th className="text-left text-muted font-medium p-3 text-xs">Priority</th>
              <th className="text-left text-muted font-medium p-3 text-xs">Due</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-dim">No tasks found</td>
              </tr>
            ) : (
              tasks.map((t) => (
                <tr key={t.id} className="border-b border-border hover:bg-border/30 transition-colors">
                  <td className="p-3">
                    <Link href={`/tasks/${t.id}`} className="text-info hover:underline font-medium">
                      {t.title}
                    </Link>
                  </td>
                  <td className="p-3 text-muted">{t.requirement_title}</td>
                  <td className="p-3 text-muted">{t.assignee_name || "-"}</td>
                  <td className="p-3"><StatusBadge status={t.status} /></td>
                  <td className="p-3"><PriorityBadge priority={t.priority} /></td>
                  <td className="p-3 text-muted text-xs">{t.due_date || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    todo: "bg-gray-800 text-muted",
    in_progress: "bg-yellow-900/40 text-warning",
    done: "bg-green-900/40 text-success",
    blocked: "bg-red-900/40 text-danger",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || ""}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    low: "bg-gray-800 text-muted",
    medium: "bg-yellow-900/40 text-warning",
    high: "bg-orange-900/40 text-orange-400",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[priority] || ""}`}>{priority}</span>;
}
