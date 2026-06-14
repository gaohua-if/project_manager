"use client";

import { useState, useEffect, use } from "react";
import { api } from "@/lib/api";
import type { Requirement, ACStatus, Task } from "@/lib/types";
import Link from "next/link";

export default function RequirementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [req, setReq] = useState<Requirement | null>(null);
  const [acStatuses, setAcStatuses] = useState<ACStatus[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreateTask, setShowCreateTask] = useState(false);

  useEffect(() => {
    api.getRequirement(id).then(setReq).catch(() => {});
    api.getAC(id).then((data) => setAcStatuses(Array.isArray(data) ? data : [])).catch(() => setAcStatuses([]));
    api.getTasks({ requirement_id: id }).then((data) => setTasks(Array.isArray(data) ? data : [])).catch(() => setTasks([]));
  }, [id]);

  if (!req) {
    return <div className="text-muted">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/requirements" className="text-muted hover:text-foreground text-sm">
              &larr; Requirements
            </Link>
          </div>
          <h2 className="text-xl font-bold">{req.title}</h2>
          <p className="text-sm text-muted mt-1">
            Created by {req.creator_name} ({req.creator_role}) &middot;{" "}
            {req.team_names?.join(", ")} &middot;{" "}
            <span className={req.status === "active" ? "text-info" : "text-success"}>
              {req.status}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {req.feishu_doc_url && (
            <a
              href={req.feishu_doc_url}
              target="_blank"
              className="bg-blue-900/40 text-info px-3 py-1.5 rounded-lg text-sm font-semibold hover:brightness-125 transition"
            >
              Feishu Doc
            </a>
          )}
          <div className="text-right">
            <div className="text-2xl font-bold text-success">{req.progress}%</div>
            <div className="text-xs text-muted">Progress</div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-surface rounded-xl p-4 border border-border mb-4">
        <h4 className="text-sm font-semibold text-muted mb-2">Description</h4>
        <p className="text-sm whitespace-pre-wrap">{req.description}</p>
        <div className="flex gap-4 mt-3 text-xs text-dim">
          <span>Priority: {req.priority}</span>
          <span>Deadline: {req.deadline || "TBD"}</span>
        </div>
      </div>

      {/* Acceptance Criteria */}
      <div className="bg-surface rounded-xl p-4 border border-border mb-4">
        <h4 className="text-sm font-semibold text-muted mb-3">
          Acceptance Criteria ({acStatuses.filter((a) => a.completed).length}/{acStatuses.length})
        </h4>
        {acStatuses.length === 0 ? (
          <p className="text-sm text-dim">No acceptance criteria yet.</p>
        ) : (
          <ul className="space-y-2">
            {acStatuses.map((ac) => (
              <li
                key={ac.index}
                className={`flex items-start gap-2 text-sm ${
                  ac.completed ? "text-success line-through" : "text-foreground"
                }`}
              >
                <span className="mt-0.5">{ac.completed ? "✓" : "○"}</span>
                <div>
                  <span>{ac.text}</span>
                  {ac.linked_tasks.length > 0 && (
                    <span className="text-xs text-dim ml-2">({ac.linked_tasks.join(", ")})</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tasks */}
      <div className="bg-surface rounded-xl p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-muted">
            Tasks ({tasks.length})
          </h4>
          <button
            onClick={() => setShowCreateTask(!showCreateTask)}
            className="bg-primary text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            {showCreateTask ? "Cancel" : "+ Add Task"}
          </button>
        </div>

        {showCreateTask && (
          <CreateTaskForm
            requirementId={id}
            acceptanceCriteria={req.acceptance_criteria}
            onCreated={() => {
              setShowCreateTask(false);
              api.getTasks({ requirement_id: id }).then((data) => setTasks(Array.isArray(data) ? data : [])).catch(() => setTasks([]));
            }}
          />
        )}

        {tasks.length === 0 ? (
          <p className="text-sm text-dim">No tasks yet. TL can break this requirement into tasks.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Task</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Assignee</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">AC</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Status</th>
                <th className="text-left text-muted font-medium pb-2 border-b border-border text-xs">Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-b border-border hover:bg-border/30">
                  <td className="py-2">
                    <Link href={`/tasks/${t.id}`} className="text-info hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="py-2 text-muted">{t.assignee_name || "-"}</td>
                  <td className="py-2 text-muted text-xs">
                    {t.acceptance_criteria_ids?.map((i) => `AC${i + 1}`).join(", ") || "-"}
                  </td>
                  <td className="py-2">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-2 text-muted text-xs">{t.due_date || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CreateTaskForm({
  requirementId,
  acceptanceCriteria,
  onCreated,
}: {
  requirementId: string;
  acceptanceCriteria: string[];
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [selectedAC, setSelectedAC] = useState<number[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      setError("Title is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.createTask({
        requirement_id: requirementId,
        title,
        acceptance_criteria_ids: selectedAC,
        assignee_id: assigneeId || undefined,
        priority,
        due_date: dueDate || undefined,
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-background rounded-lg p-4 mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Task title"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Assignee ID</label>
          <input
            type="text"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="User UUID (optional)"
          />
        </div>
      </div>
      {acceptanceCriteria.length > 0 && (
        <div>
          <label className="block text-xs text-muted mb-1">Linked AC</label>
          <div className="flex flex-wrap gap-2">
            {acceptanceCriteria.map((ac, i) => (
              <label key={i} className="flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedAC.includes(i)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAC([...selectedAC, i]);
                    } else {
                      setSelectedAC(selectedAC.filter((x) => x !== i));
                    }
                  }}
                  className="accent-emerald-400"
                />
                <span>AC{i + 1}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Task"}
      </button>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    todo: "bg-gray-800 text-muted",
    in_progress: "bg-yellow-900/40 text-warning",
    done: "bg-green-900/40 text-success",
    blocked: "bg-red-900/40 text-danger",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || ""}`}>
      {status}
    </span>
  );
}
