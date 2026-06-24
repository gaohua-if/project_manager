export type RequirementStage = "todo" | "review" | "active" | "completed" | "cancelled";
export type RequirementPriority = "low" | "medium" | "high" | "urgent";
export type MockTaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type MockTaskPriority = "low" | "medium" | "high";

export interface MockTeam {
  id: string;
  name: string;
}

export interface MockAssignee {
  id: string;
  name: string;
  employee_id: string;
  team_id: string;
}

export interface MockTaskDependency {
  task_id: string;
  task_title: string;
  status: MockTaskStatus;
}

export interface MockRequirement {
  id: string;
  title: string;
  description: string;
  feishu_doc_url?: string;
  acceptance_criteria: string[];
  creator_id: string;
  creator_name: string;
  creator_role: string;
  status: RequirementStage;
  priority: RequirementPriority;
  progress: number;
  deadline?: string;
  team_ids: string[];
  team_names: string[];
  created_at: string;
  updated_at: string;
}

export interface MockTask {
  id: string;
  requirement_id: string;
  requirement_title: string;
  title: string;
  acceptance_criteria_ids: number[];
  assignee_id?: string;
  assignee_name?: string;
  status: MockTaskStatus;
  priority: MockTaskPriority;
  progress: number;
  due_date?: string;
  dependencies: MockTaskDependency[];
  blocking: MockTaskDependency[];
  session_count: number;
  token_total: number;
  created_at: string;
  updated_at: string;
}

export interface CreateMockRequirementInput {
  title: string;
  description: string;
  priority: RequirementPriority;
  deadline?: string;
  team_ids: string[];
  feishu_doc_url?: string;
  acceptance_criteria: string[];
}

export interface CreateMockTaskInput {
  requirement_id: string;
  title: string;
  acceptance_criteria_ids: number[];
  assignee_id?: string;
  priority: MockTaskPriority;
  due_date?: string;
}
