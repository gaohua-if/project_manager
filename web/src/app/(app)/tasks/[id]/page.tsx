"use client";

import { useState, useEffect, use } from "react";
import { api } from "@/lib/api";
import type { Task } from "@/lib/types";
import Link from "next/link";

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [task, setTask] = useState<Task | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    api.getTask(id).then(setTask).catch(() => {});
  }, [id]);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      const updated = await api.updateTaskStatus(id, status);
      setTask(updated);
    } catch {}
    setUpdating(false);
  };

  if (!task) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      <Link href="/tasks" className="text-muted hover:text-foreground text-sm">
        &larr; Tasks
      </Link>

      <div className="flex items-start justify-between mt-2 mb-4">
        <div>
          <h2 className="text-xl font-bold">{task.title}</h2>
          <p className="text-sm text-muted mt-1">
            Requirement:{" "}
            <Link href={`/requirements/${task.requirement_id}`} className="text-info hover:underline">
              {task.requirement_title}
            </Link>
            &middot; Created by TL &middot; Assignee: {task.assignee_name || "Unassigned"}
          </p>
        </div>
        <div className="flex gap-2">
          {task.status !== "done" && (
            <button
              onClick={() => updateStatus("done")}
              disabled={updating}
              className="bg-success text-black px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              Mark Done
            </button>
          )}
          {task.status === "done" && (
            <button
              onClick={() => updateStatus("todo")}
              disabled={updating}
              className="bg-border text-foreground px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Details */}
        <div className="bg-surface rounded-xl p-4 border border-border">
          <h4 className="text-sm font-semibold text-muted mb-3">Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Status</span>
              <StatusBadge status={task.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Priority</span>
              <span>{task.priority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Due Date</span>
              <span>{task.due_date || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Linked AC</span>
              <span>{task.acceptance_criteria_ids?.map((i) => `AC${i + 1}`).join(", ") || "-"}</span>
            </div>
          </div>
        </div>

        {/* Dependencies */}
        <div className="bg-surface rounded-xl p-4 border border-border">
          <h4 className="text-sm font-semibold text-muted mb-3">Dependencies</h4>
          {task.dependencies && task.dependencies.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-dim">Depends on:</p>
              {task.dependencies.map((d) => (
                <div key={d.task_id} className="flex items-center gap-2 text-sm">
                  <StatusBadge status={d.status} />
                  <span>{d.task_title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-dim">No dependencies</p>
          )}
          {task.blocking && task.blocking.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-xs text-dim">Blocking:</p>
              {task.blocking.map((d) => (
                <div key={d.task_id} className="flex items-center gap-2 text-sm">
                  <StatusBadge status={d.status} />
                  <span>{d.task_title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
