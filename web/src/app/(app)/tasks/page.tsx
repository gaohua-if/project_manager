"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Requirement, Task, User } from "@/lib/types";
import Link from "next/link";

export default function TasksPage() {
  const [user] = useState(() => api.getUser());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [requirementId, setRequirementId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [acceptanceCriteriaIds, setAcceptanceCriteriaIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isTeamLeader = user?.role === "team_leader";

  useEffect(() => {
    api.getTasks(filter ? { status: filter } : undefined).then((data) => setTasks(Array.isArray(data) ? data : [])).catch(() => setTasks([]));
  }, [filter]);

  useEffect(() => {
    if (!isTeamLeader) return;
    Promise.all([
      api.getRequirements(),
      api.getUsers(),
    ])
      .then(([reqData, userData]) => {
        setRequirements(Array.isArray(reqData) ? reqData : []);
        setUsers(Array.isArray(userData) ? userData : []);
      })
      .catch(() => {
        setRequirements([]);
        setUsers([]);
      });
  }, [isTeamLeader]);

  const teamEmployees = users.filter((u) => u.role === "employee" && u.team_id === user?.team_id);
  const selectedRequirement = requirements.find((r) => r.id === requirementId);

  const resetCreateForm = () => {
    setTitle("");
    setRequirementId("");
    setAssigneeId("");
    setPriority("medium");
    setDueDate("");
    setAcceptanceCriteriaIds([]);
    setError("");
  };

  const handleRequirementChange = (nextRequirementId: string) => {
    setRequirementId(nextRequirementId);
    setAcceptanceCriteriaIds([]);
  };

  const toggleAcceptanceCriteria = (index: number) => {
    setAcceptanceCriteriaIds((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort((a, b) => a - b)
    );
  };

  const refreshTasks = () => {
    api.getTasks(filter ? { status: filter } : undefined)
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]));
  };

  const handleCreateTask = async () => {
    if (!title.trim() || !requirementId || !assigneeId) {
      setError("Title, requirement, and assignee are required.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await api.createTask({
        requirement_id: requirementId,
        title: title.trim(),
        acceptance_criteria_ids: acceptanceCriteriaIds,
        assignee_id: assigneeId,
        priority,
        due_date: dueDate || undefined,
      });
      resetCreateForm();
      setShowCreate(false);
      refreshTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Tasks</h2>
          <p className="text-sm text-muted">View and manage tasks</p>
        </div>
        <div className="flex items-center gap-2">
          {isTeamLeader && (
            <button
              type="button"
              onClick={() => {
                setShowCreate((value) => !value);
                setError("");
              }}
              className="bg-primary text-white rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90"
            >
              {showCreate ? "Close" : "+ Create Task"}
            </button>
          )}
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
      </div>

      {isTeamLeader && showCreate && (
        <div className="bg-surface rounded-xl p-4 border border-border mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1">Task title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Implement API pagination"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1">Requirement</span>
              <select
                value={requirementId}
                onChange={(e) => handleRequirementChange(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select requirement</option>
                {requirements.map((requirement) => (
                  <option key={requirement.id} value={requirement.id}>{requirement.title}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-medium text-muted mb-1">Assignee</span>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select employee</option>
                {teamEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-xs font-medium text-muted mb-1">Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-muted mb-1">Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
            </div>
          </div>

          {selectedRequirement && selectedRequirement.acceptance_criteria.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted mb-2">Acceptance criteria</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {selectedRequirement.acceptance_criteria.map((criterion, index) => (
                  <label key={`${selectedRequirement.id}-${index}`} className="flex items-start gap-2 rounded-lg border border-border bg-background/60 p-3 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={acceptanceCriteriaIds.includes(index)}
                      onChange={() => toggleAcceptanceCriteria(index)}
                      className="mt-0.5 accent-blue-500"
                    />
                    <span>{criterion}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetCreateForm();
                setShowCreate(false);
              }}
              className="px-4 py-2 text-sm text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateTask}
              disabled={submitting || !title.trim() || !requirementId || !assigneeId}
              className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create and assign"}
            </button>
          </div>
        </div>
      )}

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
