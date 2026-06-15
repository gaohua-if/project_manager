"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Requirement } from "@/lib/types";
import Link from "next/link";

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    api.getRequirements().then((data) => setRequirements(Array.isArray(data) ? data : [])).catch(() => setRequirements([]));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">需求</h2>
          <p className="text-sm text-muted">管理需求和验收标准</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          {showCreate ? "取消" : "+ 新建需求"}
        </button>
      </div>

      {showCreate && (
        <CreateRequirementForm
          onCreated={(req) => {
            setRequirements((prev) => [req, ...prev]);
            setShowCreate(false);
          }}
        />
      )}

      <div className="bg-surface rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-muted font-medium p-3 text-xs">需求</th>
              <th className="text-left text-muted font-medium p-3 text-xs">创建者</th>
              <th className="text-left text-muted font-medium p-3 text-xs">团队</th>
              <th className="text-left text-muted font-medium p-3 text-xs">AC</th>
              <th className="text-left text-muted font-medium p-3 text-xs">进度</th>
              <th className="text-left text-muted font-medium p-3 text-xs">优先级</th>
              <th className="text-left text-muted font-medium p-3 text-xs">截止日期</th>
            </tr>
          </thead>
          <tbody>
            {requirements.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-dim">
                  暂无需求
                </td>
              </tr>
            ) : (
              requirements.map((req) => (
                <tr key={req.id} className="border-b border-border hover:bg-border/30 transition-colors">
                  <td className="p-3">
                    <Link href={`/requirements/${req.id}`} className="text-info hover:underline font-medium">
                      {req.title}
                    </Link>
                    {req.feishu_doc_url && (
                      <a
                        href={req.feishu_doc_url}
                        target="_blank"
                        className="ml-2 text-xs text-muted hover:text-info"
                      >
                        [文档]
                      </a>
                    )}
                  </td>
                  <td className="p-3 text-muted">{req.creator_name}</td>
                  <td className="p-3 text-muted text-xs">{req.team_names?.join(", ")}</td>
                  <td className="p-3 text-muted">{req.acceptance_criteria?.length || 0}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 bg-border rounded-full w-16">
                        <div
                          className="h-1.5 rounded-full bg-success"
                          style={{ width: `${req.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted">{req.progress}%</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <PriorityBadge priority={req.priority} />
                  </td>
                  <td className="p-3 text-muted text-xs">{req.deadline || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateRequirementForm({ onCreated }: { onCreated: (req: Requirement) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [feishuUrl, setFeishuUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const teams = [
    { id: "a0000000-0000-0000-0000-000000000001", name: "AI工程" },
    { id: "a0000000-0000-0000-0000-000000000002", name: "推理加速" },
    { id: "a0000000-0000-0000-0000-000000000003", name: "模型训练" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || teamIds.length === 0) {
      setError("标题、描述和至少一个团队是必填项");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const req = await api.createRequirement({
        title,
        description,
        priority,
        deadline: deadline || undefined,
        team_ids: teamIds,
        feishu_doc_url: feishuUrl || undefined,
      });
      onCreated(req);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建需求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl p-6 border border-border mb-6">
      <h3 className="text-lg font-semibold mb-4">新建需求</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-muted mb-1">标题</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="例如:REQ-001 AI 平台 v3.0"
          />
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary h-24"
            placeholder="详细描述需求..."
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">优先级</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">截止日期</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">飞书文档 URL</label>
            <input
              type="url"
              value={feishuUrl}
              onChange={(e) => setFeishuUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://..."
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-muted mb-1">参与团队</label>
          <div className="flex gap-3">
            {teams.map((t) => (
              <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={teamIds.includes(t.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTeamIds([...teamIds, t.id]);
                    } else {
                      setTeamIds(teamIds.filter((id) => id !== t.id));
                    }
                  }}
                  className="accent-emerald-400"
                />
                <span className="text-sm">{t.name}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-primary text-white px-6 py-2 rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {loading ? "创建中..." : "创建需求"}
        </button>
      </form>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    low: "bg-gray-800 text-muted",
    medium: "bg-yellow-900/40 text-warning",
    high: "bg-orange-900/40 text-orange-400",
    urgent: "bg-red-900/40 text-danger",
  };
  const labels: Record<string, string> = {
    low: "低",
    medium: "中",
    high: "高",
    urgent: "紧急",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[priority] || ""}`}>
      {labels[priority] || priority}
    </span>
  );
}
