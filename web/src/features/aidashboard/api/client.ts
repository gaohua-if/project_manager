import { runtimeConfig } from "@/config/runtimeConfig";
import { api } from "@/shared/request/httpClient";
import { getAuthSession } from "@/shared/auth/session";
import type { User } from "@/shared/auth/types";
import { HttpError } from "@/shared/request/types";

import type {
  ACStatus,
  DashboardFollowItemDTO,
  DashboardRiskItemDTO,
  DailyReport,
  Document,
  Requirement,
  RequirementFollowStateDTO,
  Session,
  SessionTokens,
  Task,
  TeamActivity,
  TeamMemberReport,
  TeamReport,
  TokenAggregation,
  TokenGroupBy,
  TokenPeriod,
  Team
} from "./types";

async function unwrap<T>(promise: Promise<{ data: T }>): Promise<T> {
  const res = await promise;
  return res.data;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

// ───────────────────────── Users / Teams ─────────────────────────

export const fetchUsers = () => unwrap(api.get<User[]>("/users"));
export const fetchTeams = () => unwrap(api.get<Team[]>("/teams"));
export const fetchTeamActivity = (date?: string) =>
  unwrap(api.get<TeamActivity>("/teams/activity", date ? { date } : undefined));

// ───────────────────────── Admin ─────────────────────────

export const adminUpdateUser = (
  id: string,
  data: { role?: string; team_id?: string; clear_team?: boolean }
) => unwrap(api.put<unknown>(`/admin/users/${id}`, data));

export const adminResetPassword = (id: string, password: string) =>
  unwrap(api.post<{ status: string }>(`/admin/users/${id}/reset-password`, { password }));

// ───────────────────────── Requirements ─────────────────────────

export const fetchRequirements = (params?: Record<string, string>) =>
  unwrap(api.get<Requirement[]>("/requirements", params));
export const fetchRequirement = (id: string) => unwrap(api.get<Requirement>(`/requirements/${id}`));
export const createRequirement = (data: {
  title: string;
  description: string;
  priority: string;
  deadline?: string;
  team_ids: string[];
  feishu_doc_url?: string;
  acceptance_criteria?: string[];
}) => unwrap(api.post<Requirement>("/requirements", data));
export const updateRequirement = (id: string, data: Record<string, unknown>) =>
  unwrap(api.put<Requirement>(`/requirements/${id}`, data));
export const fetchACStatus = (id: string) => unwrap(api.get<ACStatus[]>(`/requirements/${id}/ac`));
export const regenerateAC = (id: string) =>
  unwrap(api.post<{ acceptance_criteria: string[] }>(`/requirements/${id}/regenerate-ac`));

// ───────────────────────── Tasks ─────────────────────────

export const fetchTasks = (params?: Record<string, string>) =>
  unwrap(api.get<Task[]>("/tasks", params));
export const fetchTask = (id: string) => unwrap(api.get<Task>(`/tasks/${id}`));
export const createTask = (data: {
  requirement_id: string;
  title: string;
  acceptance_criteria_ids: number[];
  assignee_id?: string;
  priority: string;
  due_date?: string;
  depends_on_ids?: string[];
}) => unwrap(api.post<{ id: string; status: string }>("/tasks", data));
export const updateTask = (id: string, data: Record<string, unknown>) =>
  unwrap(api.put<Task>(`/tasks/${id}`, data));
export const updateTaskStatus = (id: string, status: string) =>
  unwrap(api.put<Task>(`/tasks/${id}/status`, { status }));
export const updateTaskProgress = (id: string, progress: number) =>
  unwrap(api.put<Task>(`/tasks/${id}/progress`, { progress }));
export const addTaskDependency = (taskId: string, dependsOnId: string) =>
  unwrap(api.post<Task>(`/tasks/${taskId}/dependencies`, { depends_on_id: dependsOnId }));
export const removeTaskDependency = (taskId: string, depId: string) =>
  unwrap(api.delete<Task>(`/tasks/${taskId}/dependencies/${depId}`));

// ───────────────────────── Follows / Dashboard projections ─────────────────────────

export const fetchFollows = () => unwrap(api.get<RequirementFollowStateDTO[]>("/follows"));
export const followTarget = (targetType: "requirement" | "task", targetId: string) =>
  unwrap(
    api.post<{ favorited: true; target_type: "requirement" | "task"; target_id: string }>(
      "/follows",
      { target_type: targetType, target_id: targetId }
    )
  );
export const unfollowTarget = (targetType: "requirement" | "task", targetId: string) =>
  unwrap(
    api.delete<{ favorited: false; target_type: "requirement" | "task"; target_id: string }>(
      `/follows/${targetType}/${targetId}`
    )
  );
export const fetchDashboardFollows = () =>
  unwrap(api.get<DashboardFollowItemDTO[]>("/dashboard/follows"));
export const fetchDashboardRisks = () =>
  unwrap(api.get<DashboardRiskItemDTO[]>("/dashboard/risks"));

// ───────────────────────── Sessions ─────────────────────────

export const fetchSessions = (params?: Record<string, string>) =>
  unwrap(api.get<Session[]>("/sessions", params));
export const updateSessionTask = (sessionId: string, taskId: string | null) =>
  unwrap(api.put<Session>(`/sessions/${sessionId}/task`, { task_id: taskId }));
export const updateSessionRequirement = (sessionId: string, requirementId: string | null) =>
  unwrap(
    api.put<Session>(`/sessions/${sessionId}/requirement`, {
      requirement_id: requirementId
    })
  );
export const withdrawSession = (sessionId: string) =>
  unwrap(api.delete<{ status: string }>(`/sessions/${sessionId}`));

export function getSessionLogURL(sessionId: string): string {
  return `${trimTrailingSlash(runtimeConfig.apiBaseUrl)}/sessions/${sessionId}/log`;
}

export async function downloadSessionLog(sessionId: string): Promise<void> {
  const { token } = getAuthSession();
  const res = await fetch(getSessionLogURL(sessionId), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!res.ok) throw new Error("日志下载失败");
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${sessionId}.jsonl`;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

// ───────────────────────── Documents ─────────────────────────

export const fetchDocuments = (params?: Record<string, string>) =>
  unwrap(api.get<Document[]>("/documents", params));
export const createDocument = (data: {
  title: string;
  url: string;
  description?: string;
  task_id?: string;
}) => unwrap(api.post<Document>("/documents", data));
export const updateDocument = (id: string, data: Record<string, unknown>) =>
  unwrap(api.put<Document>(`/documents/${id}`, data));
export const deleteDocument = (id: string) =>
  unwrap(api.delete<{ status: string }>(`/documents/${id}`));

// ───────────────────────── Reports ─────────────────────────

export const fetchReports = (params?: Record<string, string>) =>
  unwrap(api.get<DailyReport[]>("/reports", params));
export const fetchTodayReport = () => unwrap(api.get<DailyReport>("/reports/today"));
export const generateTodayReport = () => unwrap(api.post<DailyReport>("/reports/today/generate"));
export const fetchReport = (id: string) => unwrap(api.get<DailyReport>(`/reports/${id}`));
export const updateReport = (id: string, data: { content?: string; feishu_doc_url?: string }) =>
  unwrap(api.put<DailyReport>(`/reports/${id}`, data));

export const fetchTeamMemberReports = (date: string) =>
  unwrap(api.get<TeamMemberReport[]>(`/reports/team/members`, { date }));
export const fetchTeamReportToday = () => unwrap(api.get<TeamReport>("/reports/team/today"));
export async function fetchTeamReportTodayOrNull() {
  try {
    return await unwrap(
      api.get<TeamReport>("/reports/team/today", undefined, { skipErrorHandler: true })
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
export const generateTeamReport = () =>
  unwrap(api.post<TeamReport>("/reports/team/today/generate"));
export const fetchTeamReports = (params?: Record<string, string>) =>
  unwrap(api.get<TeamReport[]>("/reports/team", params));
export const updateTeamReport = (id: string, data: { content?: string; feishu_doc_url?: string }) =>
  unwrap(api.put<TeamReport>(`/reports/team/${id}`, data));

// ───────────────────────── Tokens ─────────────────────────

export const fetchTokens = (params?: {
  period?: TokenPeriod;
  from?: string;
  to?: string;
  group_by?: TokenGroupBy;
}) => {
  const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
  return unwrap(api.get<TokenAggregation>(`/tokens${qs}`));
};

export const fetchSessionTokens = (params: { from: string; to: string; scope?: "mine" | "team" }) =>
  unwrap(api.get<SessionTokens[]>("/tokens/sessions", params));
