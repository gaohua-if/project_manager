"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

const ROLE_ORDER: User["role"][] = ["director", "pm", "team_leader", "employee"];

const ROLE_META: Record<User["role"], { label: string; description: string; tone: string }> = {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setCurrentUser(api.getUser());
        setAuthReady(true);
      }
    });
    api
      .getUsers()
      .then((data) => {
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载组织信息失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canManage = currentUser
    ? currentUser.role === "director" || currentUser.role === "pm" || currentUser.role === "team_leader"
    : false;

  const usersByRole = useMemo(() => {
    const groups = new Map<User["role"], User[]>();
    for (const role of ROLE_ORDER) groups.set(role, []);
    for (const user of users) {
      groups.set(user.role, [...(groups.get(user.role) || []), user]);
    }
    return groups;
  }, [users]);

  const teams = useMemo(() => {
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
        <p className="text-sm text-muted">仅总监、PM 和团队负责人可查看组织信息。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">组织</h2>
        <p className="text-sm text-muted mt-1">跨总监、PM、团队负责人、工程师的全景视图。</p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-4">
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
          <span className="text-xs text-muted">{loading ? "加载中..." : `${teams.length} 个团队`}</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {teams.map((team) => (
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
          {!loading && teams.length === 0 && (
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
                <th className="px-4 py-3 font-semibold">姓名</th>
                <th className="px-4 py-3 font-semibold">角色</th>
                <th className="px-4 py-3 font-semibold">团队</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-3 font-medium text-foreground">{user.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-1 text-xs ${ROLE_META[user.role].tone}`}>
                      {ROLE_META[user.role].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{user.team_name || "-"}</td>
                </tr>
              ))}
              {!loading && users.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted" colSpan={3}>
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
