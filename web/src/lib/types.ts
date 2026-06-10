export interface User {
  id: string
  name: string
  role: "director" | "team_leader" | "pm" | "employee"
  team_id?: string
  team_name?: string
}

export interface Team {
  id: string
  name: string
}

export interface Requirement {
  id: string
  title: string
  description: string
  feishu_doc_url?: string
  acceptance_criteria: string[]
  creator_id: string
  creator_name: string
  creator_role: string
  status: string
  priority: string
  progress: number
  deadline?: string
  team_ids: string[]
  team_names: string[]
  created_at: string
  updated_at: string
}

export interface ACStatus {
  index: number
  text: string
  completed: boolean
  linked_tasks: string[]
}

export interface Task {
  id: string
  requirement_id: string
  requirement_title?: string
  title: string
  acceptance_criteria_ids: number[]
  assignee_id?: string
  assignee_name?: string
  creator_tl_id: string
  status: "todo" | "in_progress" | "done" | "blocked"
  priority: string
  due_date?: string
  dependencies?: TaskDep[]
  blocking?: TaskDep[]
  created_at: string
  updated_at: string
}

export interface TaskDep {
  task_id: string
  task_title: string
  status: string
}

export interface Session {
  id: string
  session_ref: string
  user_id: string
  agent_type: string
  started_at: string
  ended_at?: string
  duration_secs?: number
  model: string
  summary?: string
  tool_calls_json?: Record<string, number>
  git_commits?: string[]
  task_id?: string
  task_title?: string
  requirement_id?: string
  match_confidence?: number
  uploaded_at: string
}

export interface DailyReport {
  id: string
  user_id: string
  user_name: string
  report_date: string
  content: string
  edited: boolean
  feishu_doc_url?: string
  session_ids: string[]
  created_at: string
  updated_at: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
