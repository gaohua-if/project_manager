// AIDashboard domain types — ported from web.legacy/src/lib/types.ts

export interface Team {
  id: string;
  name: string;
}

export type RequirementStatus = "todo" | "review" | "active" | "completed" | "cancelled";
export type RequirementPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type StoredTaskStatus = Exclude<TaskStatus, "blocked">;
export type TaskPriority = "low" | "medium" | "high";

export interface RequirementTaskSummaryDTO {
  total: number;
  done: number;
  blocked: number;
}

export interface RequirementRiskSummaryDTO {
  blocked: number;
  overdue: number;
}

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
  token_source_ids: string[];
  task_summary: RequirementTaskSummaryDTO;
  risk_summary: RequirementRiskSummaryDTO;
  is_followed: boolean;
  can_update?: boolean;
  can_change_status?: boolean;
  can_cancel?: boolean;
  can_restore?: boolean;
  can_delete?: boolean;
  can_manage_ac?: boolean;
  can_create_task?: boolean;
  completed_at?: string;
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
  acceptance_criteria: string[];
  assignee_id?: string;
  assignee_name?: string;
  creator_tl_id: string;
  status: TaskStatus;
  display_status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  due_date?: string;
  dependencies?: TaskDep[];
  blocking?: TaskDep[];
  risk_types: Array<"blocked" | "overdue">;
  token_source_ids: string[];
  is_followed: boolean;
  can_update_meta?: boolean;
  can_reassign?: boolean;
  can_update_status?: boolean;
  can_update_progress?: boolean;
  can_manage_dependencies?: boolean;
  can_delete?: boolean;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export type RequirementListItemDTO = Requirement;
export type RequirementDetailDTO = Requirement;
export type RequirementTaskDTO = Task;
export type TaskDependencyDTO = TaskDep;

export type FollowTargetType = "requirement" | "task";

export interface RequirementFollowStateDTO {
  user_id: string;
  target_type: FollowTargetType;
  target_id: string;
  created_at: string;
}

export interface DashboardNavigationTargetDTO {
  requirementId: string;
  taskId?: string;
  url: string;
}

export type AttentionLevel = "normal" | "notable" | "important" | "high";

export interface DashboardFollowItemDTO {
  key: string;
  type: "需求" | "任务";
  title: string;
  requirement?: string;
  requirementId: string;
  taskId?: string;
  owner: string;
  status: string;
  deadline: string;
  risk: string;
  dependency?: string;
  activity?: string;
  attentionScore: number;
  attentionLevel: AttentionLevel;
  riskPriority: number;
  navigation: DashboardNavigationTargetDTO;
}

export interface DashboardRiskItemDTO {
  key: string;
  riskType: "deadline" | "dependency_blocker";
  title: string;
  source: string;
  target: string;
  relatedObjectType: "requirement" | "task";
  requirementId: string;
  taskId: string;
  owner: string;
  deadline: string;
  reason: string;
  level: "高" | "中" | "低";
  tone: "red" | "orange" | "gold" | "blue";
  actionText: string;
  targetUrl: string;
  attentionScore: number;
  attentionLevel: AttentionLevel;
  navigation: DashboardNavigationTargetDTO;
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

export interface PaginatedSessions {
  items: Session[];
  total: number;
  page: number;
  page_size: number;
}

export interface DailyReport {
  id: string;
  user_id: string;
  user_name: string;
  report_date: string;
  content: string;
  submitted_content?: string;
  status?: "saved" | "submitted" | null;
  submitted_to?: "team_leader" | "director" | null;
  edited: boolean;
  feishu_doc_url?: string;
  session_ids: string[];
  saved_at?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReportListItem {
  id: string;
  user_id: string;
  user_name: string;
  report_date: string;
  status?: "saved" | "submitted" | null;
  submitted_to?: "team_leader" | "director" | null;
  edited: boolean;
  source_session_count: number;
  session_ids: string[];
  saved_at?: string;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedDailyReports {
  items: DailyReportListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface GenerateReportDraftPayload {
  report_date: string;
  session_ids: string[];
  skill_id: "default_daily";
  skill_content?: string;
  include_task_progress: boolean;
}

export interface TaskProgressSuggestion {
  task_id: string;
  task_title: string;
  requirement_id?: string;
  requirement_title?: string;
  suggested_status: "todo" | "in_progress" | "done";
  suggested_progress: number;
  evidence_session_ids: string[];
  evidence_session_titles: string[];
  reason: string;
}

export interface GenerateReportDraftResponse {
  report_markdown: string;
  selected_session_ids: string[];
  skill_name: string;
  task_progress_suggestions: TaskProgressSuggestion[];
}

export interface TeamReport {
  id: string;
  team_id: string;
  team_name: string;
  leader_id: string;
  leader_name: string;
  report_date: string;
  content: string;
  submitted_content?: string;
  status?: "saved" | "submitted" | null;
  feishu_doc_url?: string;
  member_report_ids: string[];
  source_daily_report_ids: string[];
  session_ids: string[];
  saved_at?: string;
  submitted_at?: string;
  submitted_to?: "director" | null;
  created_at: string;
  updated_at: string;
}

export interface TeamReportListItem {
  id: string;
  team_id: string;
  team_name: string;
  leader_id: string;
  leader_name: string;
  report_date: string;
  member_count: number;
  submitted_count: number;
  missing_count: number;
  status?: "saved" | "submitted" | null;
  saved_at?: string;
  submitted_at?: string;
  submitted_to?: "director" | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedTeamReports {
  items: TeamReportListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface TeamMemberReport {
  user_id: string;
  user_name: string;
  report_id?: string;
  content: string;
  submitted_at?: string;
  has_report: boolean;
}

export interface TeamReportSources {
  team_id: string;
  team_name: string;
  report_date: string;
  members: TeamMemberReport[];
  submitted_reports?: TeamMemberReport[];
  missing_members?: TeamMemberReport[];
  total_member_count?: number;
  submitted: number;
  submitted_count?: number;
  missing: number;
  missing_count?: number;
}

export interface DepartmentTeamReportSource {
  team_id: string;
  team_name: string;
  leader_id?: string;
  leader_name: string;
  team_leader_name: string;
  report_id?: string;
  team_report_id?: string;
  content: string;
  submitted_at?: string;
  has_report: boolean;
}

export interface DepartmentMissingTeam {
  team_id: string;
  team_name: string;
}

export interface DepartmentReportSources {
  report_date: string;
  submitted_team_count: number;
  total_team_count: number;
  missing_team_count?: number;
  submitted_team_reports: DepartmentTeamReportSource[];
  missing_teams: DepartmentMissingTeam[];
}

export interface DepartmentReport {
  id: string;
  report_date: string;
  content: string;
  status?: "saved" | "archived" | null;
  source_team_report_ids: string[];
  saved_at?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DepartmentReportListItem {
  id: string;
  report_date: string;
  team_count: number;
  submitted_team_count: number;
  missing_team_count: number;
  status?: "saved" | "archived" | null;
  saved_at?: string;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedDepartmentReports {
  items: DepartmentReportListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface WeeklySessionSource {
  session_id: string;
  session_ref: string;
  agent_type: string;
  started_at: string;
  ended_at?: string;
  summary: string;
  task_id?: string;
  task_title?: string;
  requirement_id?: string;
  requirement_title?: string;
  total_tokens: number;
}

export interface WeeklyDailyReportSource {
  report_id: string;
  user_id: string;
  user_name: string;
  report_date: string;
  content: string;
}

export interface WeeklyTeamDailyReportSource {
  report_id: string;
  team_id: string;
  team_name: string;
  leader_id: string;
  leader_name: string;
  report_date: string;
  content: string;
  submitted_at?: string;
}

export interface WeeklyTaskSource {
  task_id: string;
  task_title: string;
  requirement_id: string;
  requirement_title: string;
  assignee_id?: string;
  assignee_name: string;
  status: string;
  priority: string;
  due_date?: string;
}

export interface PersonalWeeklyReportSources {
  user_id: string;
  user_name: string;
  week_start: string;
  week_end: string;
  sessions: WeeklySessionSource[];
  daily_reports: WeeklyDailyReportSource[];
  tasks: WeeklyTaskSource[];
  session_count: number;
  daily_count: number;
  task_count: number;
}

export interface PersonalWeeklyReport {
  id: string;
  user_id: string;
  user_name: string;
  week_start: string;
  week_end: string;
  content: string;
  submitted_content?: string;
  status: "saved" | "submitted";
  saved_at?: string;
  submitted_at?: string;
  submitted_to?: "team_leader" | "director";
  source_daily_report_ids: string[];
  source_session_ids: string[];
  source_task_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface PersonalWeeklyReportListItem {
  id: string;
  user_id: string;
  user_name: string;
  week_start: string;
  week_end: string;
  status: "saved" | "submitted";
  saved_at?: string;
  submitted_at?: string;
  submitted_to?: "team_leader" | "director";
  source_daily_count: number;
  source_session_count: number;
  source_task_count: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedPersonalWeeklyReports {
  items: PersonalWeeklyReportListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface PersonalWeeklyReportPreview {
  report_markdown: string;
  week_start: string;
  week_end: string;
  source_session_ids: string[];
  source_daily_report_ids: string[];
  source_task_ids: string[];
}

export interface TeamWeeklyReportSources {
  team_id: string;
  team_name: string;
  week_start: string;
  week_end: string;
  daily_reports: WeeklyDailyReportSource[];
  team_reports: WeeklyTeamDailyReportSource[];
  tasks: WeeklyTaskSource[];
  submitted_daily_count: number;
  team_report_count: number;
  task_count: number;
}

export interface TeamWeeklyReport {
  id: string;
  team_id: string;
  team_name: string;
  leader_id: string;
  leader_name: string;
  week_start: string;
  content: string;
  source_daily_report_ids: string[];
  source_team_report_ids: string[];
  source_task_ids: string[];
  submitted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DepartmentTeamWeeklyReportSource {
  team_id: string;
  team_name: string;
  leader_id?: string;
  leader_name: string;
  report_id?: string;
  content: string;
  submitted_at?: string;
  has_report: boolean;
}

export interface DepartmentWeeklyReportSources {
  week_start: string;
  week_end: string;
  submitted_team_count: number;
  total_team_count: number;
  submitted_team_reports: DepartmentTeamWeeklyReportSource[];
  missing_teams: DepartmentMissingTeam[];
}

export interface DepartmentWeeklyReport {
  id: string;
  week_start: string;
  content: string;
  source_team_weekly_report_ids: string[];
  archived_at?: string;
  created_at: string;
  updated_at: string;
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
  cache_creation_sum?: number;
  cache_read_sum?: number;
  groups: TokenGroup[];
  series: TokenPoint[];
  period: string;
  group_by: string;
}

export interface SessionTokens {
  session_id: string;
  session_ref: string;
  user_id: string;
  user_name: string;
  agent_type: string;
  models: string[];
  summary?: string;
  started_at: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
}

export interface PaginatedSessionTokens {
  items: SessionTokens[];
  total: number;
  page: number;
  page_size: number;
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
