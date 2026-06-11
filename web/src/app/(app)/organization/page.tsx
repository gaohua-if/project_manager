"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

const ROLE_ORDER: User["role"][] = ["director", "pm", "team_leader", "employee"];

const ROLE_META: Record<User["role"], { label: string; description: string; tone: string }> = {
  director: {
    label: "总监",
    description: "部门全局负责人",
    tone: "text-info border-info/30 bg-info/10",
  },
  pm: {
    label: "PM",
    description: "需求与验收负责人",
    tone: "text-purple border-purple/30 bg-purple/10",
  },
  team_leader: {
    label: "Team Leader",
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load organization");
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
        <h2 className="text-xl font-bold mb-2">Organization</h2>
        <p className="text-sm text-muted">Loading organization access...</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-2">Organization</h2>
        <p className="text-sm text-muted">Only directors, PMs, and team leaders can view organization management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Organization</h2>
        <p className="text-sm text-muted mt-1">Manage visibility across directors, PMs, team leaders, and engineers.</p>
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
          <h3 className="text-base font-semibold">Teams</h3>
          <span className="text-xs text-muted">{loading ? "Loading..." : `${teams.length} teams`}</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {teams.map((team) => (
            <div key={team.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold">{team.name}</h4>
                  <p className="mt-1 text-xs text-muted">{team.members.length} members</p>
                </div>
                <span className="rounded-full bg-border px-2 py-1 text-xs text-muted">
                  {team.engineers.length} engineers
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 text-xs uppercase text-dim">Team Leader</div>
                  <div className="text-sm text-foreground">
                    {team.leaders.length > 0 ? team.leaders.map((u) => u.name).join(", ") : "Unassigned"}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-xs uppercase text-dim">Engineers</div>
                  <div className="text-sm text-muted">
                    {team.engineers.length > 0 ? team.engineers.map((u) => u.name).join(", ") : "No engineers"}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!loading && teams.length === 0 && (
            <div className="rounded-lg border border-border bg-surface p-4 text-sm text-muted">
              No teams found.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Members</h3>
          <span className="text-xs text-muted">{loading ? "Loading..." : `${users.length} users`}</span>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-background/60 text-xs uppercase text-dim">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Team</th>
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
                    No users found.
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
