import type { User } from "./types"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1"

class ApiClient {
  private token: string | null = null

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("token")
    }
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== "undefined") {
      localStorage.setItem("token", token)
    }
  }

  clearToken() {
    this.token = null
    if (typeof window !== "undefined") {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
    }
  }

  getUser(): User | null {
    if (typeof window === "undefined") return null
    const raw = localStorage.getItem("user")
    if (!raw) return null
    return JSON.parse(raw)
  }

  setUser(user: User) {
    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(user))
    }
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...headers, ...options?.headers },
    })

    if (res.status === 401) {
      this.clearToken()
      if (typeof window !== "undefined") {
        window.location.href = "/login"
      }
      throw new Error("unauthorized")
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `HTTP ${res.status}`)
    }

    return res.json()
  }

  async login(employeeId: string, password: string) {
    const res = await this.request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ employee_id: employeeId, password }),
    })
    this.setToken(res.token)
    this.setUser(res.user)
    return res
  }

  async register(data: { employee_id: string; name: string; email: string; password: string }) {
    return this.request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async getMe() {
    return this.request<User>("/auth/me")
  }

  async getUsers() {
    return this.request<User[]>("/users")
  }

  async getTeams() {
    return this.request<import("./types").Team[]>("/teams")
  }

  async adminUpdateUser(id: string, data: { role?: string; team_id?: string; clear_team?: boolean }) {
    return this.request<User>(`/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async adminResetPassword(id: string, password: string) {
    return this.request<{ status: string }>(`/admin/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    })
  }

  // Requirements
  async getRequirements(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return this.request<import("./types").Requirement[]>(`/requirements${qs}`)
  }

  async getRequirement(id: string) {
    return this.request<import("./types").Requirement>(`/requirements/${id}`)
  }

  async createRequirement(data: {
    title: string
    description: string
    priority: string
    deadline?: string
    team_ids: string[]
    feishu_doc_url?: string
  }) {
    return this.request<import("./types").Requirement>("/requirements", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateRequirement(id: string, data: Record<string, unknown>) {
    return this.request<import("./types").Requirement>(`/requirements/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async getAC(id: string) {
    return this.request<import("./types").ACStatus[]>(`/requirements/${id}/ac`)
  }

  // Tasks
  async getTasks(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return this.request<import("./types").Task[]>(`/tasks${qs}`)
  }

  async getTask(id: string) {
    return this.request<import("./types").Task>(`/tasks/${id}`)
  }

  async createTask(data: {
    requirement_id: string
    title: string
    acceptance_criteria_ids: number[]
    assignee_id?: string
    priority: string
    due_date?: string
    depends_on_ids?: string[]
  }) {
    return this.request<{ id: string; status: string }>("/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateTask(id: string, data: Record<string, unknown>) {
    return this.request<import("./types").Task>(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async updateTaskStatus(id: string, status: string) {
    return this.request<import("./types").Task>(`/tasks/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  }

  async addTaskDependency(taskId: string, dependsOnId: string) {
    return this.request<import("./types").Task>(`/tasks/${taskId}/dependencies`, {
      method: "POST",
      body: JSON.stringify({ depends_on_id: dependsOnId }),
    })
  }

  async removeTaskDependency(taskId: string, depId: string) {
    return this.request<import("./types").Task>(`/tasks/${taskId}/dependencies/${depId}`, {
      method: "DELETE",
    })
  }

  // Sessions
  async getSessions(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return this.request<import("./types").Session[]>(`/sessions${qs}`)
  }

  async batchUploadSessions(sessions: unknown[]) {
    return this.request<{ total: number; results: Array<{ session_ref: string; id: string; status: string }> }>("/sessions/batch", {
      method: "POST",
      body: JSON.stringify({ sessions }),
    })
  }

  async updateSessionTask(sessionId: string, taskId: string | null) {
    return this.request<import("./types").Session>(`/sessions/${sessionId}/task`, {
      method: "PUT",
      body: JSON.stringify({ task_id: taskId }),
    })
  }

  async withdrawSession(sessionId: string) {
    return this.request<{ status: string }>(`/sessions/${sessionId}`, {
      method: "DELETE",
    })
  }

  getSessionLogURL(sessionId: string): string {
    return `${API_BASE}/sessions/${sessionId}/log`
  }

  // Documents
  async getDocuments(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return this.request<import("./types").Document[]>(`/documents${qs}`)
  }

  async createDocument(data: { title: string; url: string; description?: string; task_id?: string }) {
    return this.request<import("./types").Document>("/documents", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateDocument(id: string, data: Record<string, unknown>) {
    return this.request<import("./types").Document[]>(`/documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async deleteDocument(id: string) {
    return this.request<{ status: string }>(`/documents/${id}`, {
      method: "DELETE",
    })
  }

  // Reports
  async getReports(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return this.request<import("./types").DailyReport[]>(`/reports${qs}`)
  }

  async getTodayReport() {
    return this.request<import("./types").DailyReport>("/reports/today")
  }

  async generateTodayReport() {
    return this.request<import("./types").DailyReport>("/reports/today/generate", {
      method: "POST",
    })
  }

  async getReport(id: string) {
    return this.request<import("./types").DailyReport>(`/reports/${id}`)
  }

  async updateReport(id: string, data: { content?: string; feishu_doc_url?: string }) {
    return this.request<import("./types").DailyReport>(`/reports/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  // Team Reports
  async getTeamMemberReports(date: string) {
    return this.request<import("./types").TeamMemberReport[]>(
      `/reports/team/members?date=${encodeURIComponent(date)}`
    )
  }

  async getTeamReportToday() {
    return this.request<import("./types").TeamReport>("/reports/team/today")
  }

  async generateTeamReport() {
    return this.request<import("./types").TeamReport>("/reports/team/today/generate", {
      method: "POST",
    })
  }

  async getTeamReports(params?: Record<string, string>) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return this.request<import("./types").TeamReport[]>(`/reports/team${qs}`)
  }

  async updateTeamReport(id: string, data: { content?: string; feishu_doc_url?: string }) {
    return this.request<import("./types").TeamReport>(`/reports/team/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  // Tokens
  async getTokens(params?: {
    period?: import("./types").TokenPeriod
    from?: string
    to?: string
    group_by?: import("./types").TokenGroupBy
  }) {
    const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : ""
    return this.request<import("./types").TokenAggregation>(`/tokens${qs}`)
  }

  async getSessionTokens(params?: { from?: string; to?: string }) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : ""
    return this.request<import("./types").SessionTokens[]>(`/tokens/sessions${qs}`)
  }

  // Team activity
  async getTeamActivity(date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : ""
    return this.request<import("./types").TeamActivity>(`/teams/activity${qs}`)
  }

  // Regenerate AC via AI
  async regenerateAC(id: string) {
    return this.request<{ acceptance_criteria: string[] }>(`/requirements/${id}/regenerate-ac`, {
      method: "POST",
    })
  }
}

export const api = new ApiClient()
