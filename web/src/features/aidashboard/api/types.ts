// AIDashboard domain types — ported from web.legacy/src/lib/types.ts

export interface Team {
  id: string;
  name: string;
}

export type RequirementStatus = "active" | "completed" | "cancelled";
export type RequirementPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type TaskPriority = "low" | "medium" | "high";

export interface Requirement {
  id: string;
  title: string;
  description: string;
  feishu_doc_url?: string;
  acceptance_criteria: string[];
  creator_id: string;
  creator_name: string;
  creator_role: string;
  status: RequirementStatus;
  priority: RequirementPriority;
  progress: number;
  deadline?: string;
  team_ids: string[];
  team_names: string[];
  created_at: string;
  updated_at: string;
}

export interface ACStatus {
  index: number;
  text: string;
  completed: boolean;
  linked_tasks?: string[];
}

export interface TaskDep {
  task_id: string;
  task_title: string;
  status: TaskStatus;
}

export interface Task {
  id: string;
  requirement_id: string;
  requirement_title?: string;
  title: string;
  acceptance_criteria_ids: number[];
  assignee_id?: string;
  assignee_name?: string;
  creator_tl_id: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  dependencies?: TaskDep[];
  blocking?: TaskDep[];
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  session_ref: string;
  user_id: string;
  user_name: string;
  agent_type: string;
  started_at: string;
  ended_at?: string;
  duration_secs?: number;
  model: string;
  summary?: string;
  tool_calls_json?: Record<string, number>;
  git_commits?: string[];
  task_id?: string;
  task_title?: string;
  requirement_id?: string;
  match_confidence?: number;
  raw_log_url?: string;
  uploaded_at: string;
}

export interface DailyReport {
  id: string;
  user_id: string;
  user_name: string;
  report_date: string;
  content: string;
  edited: boolean;
  feishu_doc_url?: string;
  session_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface TeamReport {
  id: string;
  team_id: string;
  team_name: string;
  leader_id: string;
  leader_name: string;
  report_date: string;
  content: string;
  feishu_doc_url?: string;
  member_report_ids: string[];
  session_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface TeamMemberReport {
  user_id: string;
  user_name: string;
  report_id?: string;
  content: string;
  has_report: boolean;
}

export interface Document {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  url: string;
  description?: string;
  task_id?: string;
  task_title?: string;
  requirement_id?: string;
  uploaded_at: string;
}

export interface TokenGroup {
  key: string;
  label: string;
  value: number;
  percent: number;
}

export interface TokenPoint {
  date: string;
  value: number;
}

export interface TokenAggregation {
  total: number;
  input_sum: number;
  output_sum: number;
  groups: TokenGroup[];
  series: TokenPoint[];
  period: string;
  group_by: string;
}

export interface SessionTokens {
  session_id: string;
  session_ref: string;
  agent_type: string;
  models: string[];
  started_at: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
}

export interface MemberStat {
  user_id: string;
  user_name: string;
  active: boolean;
  last_active?: string;
  idle_days: number;
}

export interface TeamStat {
  team_id: string;
  team_name: string;
  active: number;
  total: number;
  members: MemberStat[];
}

export interface IdleWarning {
  user_id: string;
  user_name: string;
  team_name: string;
  idle_days: number;
}

export interface TeamActivity {
  teams: TeamStat[];
  idle_warnings: IdleWarning[];
}

export type TokenPeriod = "today" | "week" | "month" | "range";
export type TokenGroupBy = "team" | "user" | "requirement" | "task" | "model";
