"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Team, User } from "@/lib/types";

const ROLE_ORDER: User["role"][] = ["admin", "director", "pm", "team_leader", "employee"];

const ROLE_META: Record<User["role"], { label: string; description: string; tone: string }> = {
  admin: {
    label: "管理员",
    description: "系统管理员，分配角色与团队",
    tone: "text-danger border-danger/30 bg-danger/10",
  },
  director: {
    label: "部门总监",
    description: "部门全局负责人",
    tone: "text-info border-info/30 bg-info/10",
  },
  pm: {
    label: "产品经理",
    description: "需求与验收负责人",
    tone: "text-purple border-purple/30 bg-purple/10",
  },
  team_leader: {
    label: "团队负责人",
    description: "团队任务分解与交付负责人",
    tone: "text-warning border-warning/30 bg-warning/10",
  },
  employee: {
    label: "工程师",
    description: "任务执行与 Session 上报",
    tone: "text-success border-success/30 bg-success/10",
  },
};

const ROLE_OPTIONS: Array<{ value: User["role"]; label: string }> = [
  { value: "employee", label: "工程师" },
  { value: "team_leader", label: "团队负责人" },
  { value: "pm", label: "产品经理" },
  { value: "director", label: "部门总监" },
  { value: "admin", label: "管理员" },
];

type TeamGroup = {
  id: string;
  name: string;
  leaders: User[];
  engineers: User[];
  members: User[];
};

export default function OrganizationPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = () => {
    Promise.all([api.getUsers(), api.getTeams()])
      .then(([u, t]) => {
        setUsers(Array.isArray(u) ? u : []);
        setTeams(Array.isArray(t) ? t : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "加载组织信息失败"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setCurrentUser(api.getUser());
        setAuthReady(true);
      }
    });
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const canManage = currentUser
    ? isAdmin || currentUser.role === "director" || currentUser.role === "pm" || currentUser.role === "team_leader"
    : false;

  const usersByRole = useMemo(() => {
    const groups = new Map<User["role"], User[]>();
    for (const role of ROLE_ORDER) groups.set(role, []);
    for (const user of users) {
      groups.set(user.role, [...(groups.get(user.role) || []), user]);
    }
    return groups;
  }, [users]);

  const teamsGrouped = useMemo(() => {
    const groups = new Map<string, TeamGroup>();
    for (const user of users) {
      if (!user.team_id) continue;
      const existing = groups.get(user.team_id) || {
        id: user.team_id,
        name: user.team_name || "未命名团队",
        leaders: [],
        engineers: [],
        members: [],
      };
      existing.members.push(user);
      if (user.role === "team_leader") existing.leaders.push(user);
      if (user.role === "employee") existing.engineers.push(user);
      groups.set(user.team_id, existing);
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  if (!authReady) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-2">组织</h2>
        <p className="text-sm text-muted">加载组织信息中...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-2">组织</h2>
        <p className="text-sm text-muted">仅管理员、总监、PM 和团队负责人可查看组织信息。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">组织</h2>
        <p className="text-sm text-muted mt-1">
          {isAdmin ? "管理员视图：可调整任何用户的角色与团队。" : "跨总监、PM、团队负责人、工程师的全景视图。"}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-5">
        {ROLE_ORDER.map((role) => {
          const meta = ROLE_META[role];
          const count = usersByRole.get(role)?.length || 0;
          return (
            <div key={role} className={`rounded-lg border p-4 ${meta.tone}`}>
              <div className="text-2xl font-bold">{loading ? "-" : count}</div>
              <div className="mt-1 text-sm font-semibold">{meta.label}</div>
              <div className="mt-1 text-xs opacity-80">{meta.description}</div>
            </div>
          );
        })}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">团队</h3>
          <span className="text-xs text-muted">{loading ? "加载中..." : `${teamsGrouped.length} 个团队`}</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {teamsGrouped.map((team) => (
            <div key={team.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold">{team.name}</h4>
                  <p className="mt-1 text-xs text-muted">{team.members.length} 名成员</p>
                </div>
                <span className="rounded-full bg-border px-2 py-1 text-xs text-muted">
                  {team.engineers.length} 名工程师
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 text-xs uppercase text-dim">团队负责人</div>
                  <div className="text-sm text-foreground">
                    {team.leaders.length > 0 ? team.leaders.map((u) => u.name).join(", ") : "未分配"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs uppercase text-dim">工程师</div>
                  <div className="text-sm text-muted">
                    {team.engineers.length > 0 ? team.engineers.map((u) => u.name).join(", ") : "暂无工程师"}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!loading && teamsGrouped.length === 0 && (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
              暂无团队。
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">成员</h3>
          <span className="text-xs text-muted">{loading ? "加载中..." : `${users.length} 位用户`}</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background/60 text-xs uppercase text-dim">
              <tr>
                <th className="px-4 py-3 font-semibold">工号</th>
                <th className="px-4 py-3 font-semibold">姓名</th>
                <th className="px-4 py-3 font-semibold">邮箱</th>
                <th className="px-4 py-3 font-semibold">角色</th>
                <th className="px-4 py-3 font-semibold">团队</th>
                {isAdmin && <th className="px-4 py-3 font-semibold text-right">操作</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-mono text-xs text-muted">{user.employee_id}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{user.name}</td>
                  <td className="px-4 py-3 text-muted">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-1 text-xs ${ROLE_META[user.role].tone}`}>
                      {ROLE_META[user.role].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{user.team_name || "-"}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingId(editingId === user.id ? null : user.id)}
                        className="text-xs text-info hover:underline disabled:opacity-50"
                        disabled={user.id === currentUser?.id}
                        title={user.id === currentUser?.id ? "不能编辑自己" : ""}
                      >
                        {editingId === user.id ? "关闭" : "编辑"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {editingId && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-4 py-4 bg-background/60">
                    <UserEditor
                      key={editingId}
                      user={users.find((u) => u.id === editingId)!}
                      teams={teams}
                      onSaved={() => {
                        setEditingId(null);
                        load();
                      }}
                      onCancelled={() => setEditingId(null)}
                    />
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted" colSpan={isAdmin ? 6 : 5}>
                    暂无用户。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UserEditor({
  user,
  teams,
  onSaved,
  onCancelled,
}: {
  user: User;
  teams: Team[];
  onSaved: () => void;
  onCancelled: () => void;
}) {
  const [role, setRole] = useState<User["role"]>(user.role);
  const [teamId, setTeamId] = useState<string>(user.team_id || "");
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const dirty = role !== user.role || teamId !== (user.team_id || "");

  const save = async () => {
    setSaving(true);
    setError("");
    setInfo("");
    try {
      const roleChanged = role !== user.role;
      const teamChanged = teamId !== (user.team_id || "");
      const payload: { role?: string; team_id?: string; clear_team?: boolean } = {};
      if (roleChanged) payload.role = role;
      if (teamChanged) {
        if (teamId === "") payload.clear_team = true;
        else payload.team_id = teamId;
      }
      if (Object.keys(payload).length > 0) {
        await api.adminUpdateUser(user.id, payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (newPassword.length < 8) {
      setError("新密码至少 8 位");
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await api.adminResetPassword(user.id, newPassword);
      setInfo("密码已重置");
      setNewPassword("");
      setResetOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "重置失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-muted mb-1">角色</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as User["role"])}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">团队</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">无团队</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-blue-700"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          onClick={onCancelled}
          className="text-sm text-muted hover:text-foreground px-2"
        >
          取消
        </button>
        <button
          onClick={() => setResetOpen((v) => !v)}
          className="text-sm text-warning hover:underline"
        >
          {resetOpen ? "收起重置密码" : "重置密码"}
        </button>
      </div>

      {resetOpen && (
        <div className="flex items-end gap-2 pl-1">
          <div>
            <label className="block text-xs text-muted mb-1">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 8 位"
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            onClick={resetPassword}
            disabled={saving}
            className="bg-warning text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            确认重置
          </button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {info && <p className="text-sm text-success">{info}</p>}
    </div>
  );
}
