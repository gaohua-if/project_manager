package model

import "time"

type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type User struct {
	ID        string  `json:"id"`
	FeishuID  *string `json:"feishu_id,omitempty"`
	Name      string  `json:"name"`
	Role      string  `json:"role"`
	TeamID    *string `json:"team_id,omitempty"`
	TeamName  *string `json:"team_name,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type Requirement struct {
	ID                 string    `json:"id"`
	Title              string    `json:"title"`
	Description        string    `json:"description"`
	FeishuDocURL       *string   `json:"feishu_doc_url,omitempty"`
	AcceptanceCriteria []string  `json:"acceptance_criteria"`
	CreatorID          string    `json:"creator_id"`
	CreatorName        string    `json:"creator_name"`
	CreatorRole        string    `json:"creator_role"`
	Status             string    `json:"status"`
	Priority           string    `json:"priority"`
	Progress           int       `json:"progress"`
	Deadline           *string   `json:"deadline,omitempty"`
	TeamIDs            []string  `json:"team_ids"`
	TeamNames          []string  `json:"team_names"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

type Task struct {
	ID                     string    `json:"id"`
	RequirementID          string    `json:"requirement_id"`
	RequirementTitle       string    `json:"requirement_title,omitempty"`
	Title                  string    `json:"title"`
	AcceptanceCriteriaIDs  []int     `json:"acceptance_criteria_ids"`
	AssigneeID             *string   `json:"assignee_id,omitempty"`
	AssigneeName           *string   `json:"assignee_name,omitempty"`
	CreatorTLID            string    `json:"creator_tl_id"`
	Status                 string    `json:"status"`
	Priority               string    `json:"priority"`
	DueDate                *string   `json:"due_date,omitempty"`
	Dependencies           []TaskDep `json:"dependencies,omitempty"`
	Blocking               []TaskDep `json:"blocking,omitempty"`
	CreatedAt              time.Time `json:"created_at"`
	UpdatedAt              time.Time `json:"updated_at"`
}

type TaskDep struct {
	TaskID    string `json:"task_id"`
	TaskTitle string `json:"task_title"`
	Status    string `json:"status"`
}

type Session struct {
	ID              string    `json:"id"`
	SessionRef      string    `json:"session_ref"`
	UserID          string    `json:"user_id"`
	UserName         string    `json:"user_name"`
	AgentType       string    `json:"agent_type"`
	StartedAt       time.Time `json:"started_at"`
	EndedAt         *time.Time `json:"ended_at,omitempty"`
	DurationSecs    *int      `json:"duration_secs,omitempty"`
	Model           string    `json:"model"`
	Summary         *string   `json:"summary,omitempty"`
	ToolCallsJSON   any       `json:"tool_calls_json,omitempty"`
	GitCommits      []string  `json:"git_commits,omitempty"`
	TaskID          *string   `json:"task_id,omitempty"`
	TaskTitle       *string   `json:"task_title,omitempty"`
	RequirementID   *string   `json:"requirement_id,omitempty"`
	MatchConfidence *float64  `json:"match_confidence,omitempty"`
	RawLogURL       *string   `json:"raw_log_url,omitempty"`
	UploadedAt      time.Time `json:"uploaded_at"`
}

type TokenUsage struct {
	ID             string    `json:"id"`
	SessionID      string    `json:"session_id"`
	UserID         string    `json:"user_id"`
	TaskID         *string   `json:"task_id,omitempty"`
	RequirementID  *string   `json:"requirement_id,omitempty"`
	AgentType      string    `json:"agent_type"`
	Model          string    `json:"model"`
	InputTokens    int64     `json:"input_tokens"`
	OutputTokens   int64     `json:"output_tokens"`
	TotalTokens    int64     `json:"total_tokens"`
	RecordedAt     time.Time `json:"recorded_at"`
}

type DailyReport struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	UserName     string    `json:"user_name"`
	ReportDate   string    `json:"report_date"`
	Content      string    `json:"content"`
	Edited       bool      `json:"edited"`
	FeishuDocURL *string   `json:"feishu_doc_url,omitempty"`
	SessionIDs   []string  `json:"session_ids"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Request/Response types

type LoginRequest struct {
	Name string `json:"name"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type CreateRequirementRequest struct {
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	FeishuDocURL *string `json:"feishu_doc_url,omitempty"`
	Priority     string  `json:"priority"`
	Deadline     *string `json:"deadline,omitempty"`
	TeamIDs      []string `json:"team_ids"`
}

type UpdateRequirementRequest struct {
	Title        *string  `json:"title,omitempty"`
	Description  *string  `json:"description,omitempty"`
	FeishuDocURL *string  `json:"feishu_doc_url,omitempty"`
	Priority     *string  `json:"priority,omitempty"`
	Status       *string  `json:"status,omitempty"`
	Deadline     *string  `json:"deadline,omitempty"`
}

type CreateTaskRequest struct {
	RequirementID         string   `json:"requirement_id"`
	Title                 string   `json:"title"`
	AcceptanceCriteriaIDs []int    `json:"acceptance_criteria_ids"`
	AssigneeID            *string  `json:"assignee_id,omitempty"`
	Priority              string   `json:"priority"`
	DueDate               *string  `json:"due_date,omitempty"`
	DependsOnIDs          []string `json:"depends_on_ids,omitempty"`
}

type UpdateTaskRequest struct {
	Title                 *string `json:"title,omitempty"`
	AcceptanceCriteriaIDs *[]int  `json:"acceptance_criteria_ids,omitempty"`
	AssigneeID            *string `json:"assignee_id,omitempty"`
	Status                *string `json:"status,omitempty"`
	Priority              *string `json:"priority,omitempty"`
	DueDate               *string `json:"due_date,omitempty"`
}

type UpdateTaskStatusRequest struct {
	Status string `json:"status"`
}

type AddDependencyRequest struct {
	DependsOnID string `json:"depends_on_id"`
}

type BatchSessionUpload struct {
	Sessions []SessionUpload `json:"sessions"`
}

type SessionUpload struct {
	SessionRef   string          `json:"session_ref"`
	StartedAt    time.Time       `json:"started_at"`
	EndedAt      *time.Time      `json:"ended_at,omitempty"`
	DurationSecs *int            `json:"duration_secs,omitempty"`
	Model        string          `json:"model"`
	Summary      *string         `json:"summary,omitempty"`
	ToolCalls    map[string]int  `json:"tool_calls,omitempty"`
	GitCommits   []string        `json:"git_commits,omitempty"`
	TokenUsage   *TokenUpload    `json:"token_usage,omitempty"`
}

type TokenUpload struct {
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
	TotalTokens  int64 `json:"total_tokens"`
}

type UpdateSessionTaskRequest struct {
	TaskID *string `json:"task_id"`
}

type UpdateReportRequest struct {
	Content      *string `json:"content,omitempty"`
	FeishuDocURL *string `json:"feishu_doc_url,omitempty"`
}

type TeamReport struct {
	ID              string    `json:"id"`
	TeamID          string    `json:"team_id"`
	TeamName        string    `json:"team_name"`
	LeaderID        string    `json:"leader_id"`
	LeaderName      string    `json:"leader_name"`
	ReportDate      string    `json:"report_date"`
	Content         string    `json:"content"`
	FeishuDocURL    *string   `json:"feishu_doc_url,omitempty"`
	MemberReportIDs []string  `json:"member_report_ids"`
	SessionIDs      []string  `json:"session_ids"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type TeamMemberReport struct {
	UserID   string  `json:"user_id"`
	UserName string  `json:"user_name"`
	ReportID *string `json:"report_id,omitempty"`
	Content  string  `json:"content"`
	HasReport bool   `json:"has_report"`
}

type UpdateTeamReportRequest struct {
	Content      *string `json:"content,omitempty"`
	FeishuDocURL *string `json:"feishu_doc_url,omitempty"`
}

type ACStatus struct {
	Index      int    `json:"index"`
	Text       string `json:"text"`
	Completed  bool   `json:"completed"`
	LinkedTasks []string `json:"linked_tasks,omitempty"`
}

type Document struct {
	ID            string    `json:"id"`
	UserID        string    `json:"user_id"`
	UserName      string    `json:"user_name"`
	Title         string    `json:"title"`
	URL           string    `json:"url"`
	Description   *string   `json:"description,omitempty"`
	TaskID        *string   `json:"task_id,omitempty"`
	TaskTitle     *string   `json:"task_title,omitempty"`
	RequirementID *string   `json:"requirement_id,omitempty"`
	UploadedAt    time.Time `json:"uploaded_at"`
}

type CreateDocumentRequest struct {
	Title       string  `json:"title"`
	URL         string  `json:"url"`
	Description *string `json:"description,omitempty"`
	TaskID      *string `json:"task_id,omitempty"`
}

type UpdateDocumentRequest struct {
	Title       *string `json:"title,omitempty"`
	URL         *string `json:"url,omitempty"`
	Description *string `json:"description,omitempty"`
	TaskID      *string `json:"task_id,omitempty"`
}
