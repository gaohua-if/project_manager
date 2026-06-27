package model

import "time"

type Team struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type User struct {
	ID         string    `json:"id"`
	EmployeeID string    `json:"employee_id"`
	Email      string    `json:"email"`
	Name       string    `json:"name"`
	Role       string    `json:"role"`
	TeamID     *string   `json:"team_id,omitempty"`
	TeamName   *string   `json:"team_name,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type Requirement struct {
	ID                 string                 `json:"id"`
	Title              string                 `json:"title"`
	Description        string                 `json:"description"`
	FeishuDocURL       *string                `json:"feishu_doc_url,omitempty"`
	AcceptanceCriteria []string               `json:"acceptance_criteria"`
	CreatorID          string                 `json:"creator_id"`
	CreatorName        string                 `json:"creator_name"`
	CreatorRole        string                 `json:"creator_role"`
	Status             string                 `json:"status"`
	Priority           string                 `json:"priority"`
	Progress           int                    `json:"progress"`
	Deadline           *string                `json:"deadline,omitempty"`
	TeamIDs            []string               `json:"team_ids"`
	TeamNames          []string               `json:"team_names"`
	TokenSourceIDs     []string               `json:"token_source_ids"`
	TaskSummary        RequirementTaskSummary `json:"task_summary"`
	RiskSummary        RequirementRiskSummary `json:"risk_summary"`
	IsFollowed         bool                   `json:"is_followed"`
	CanUpdate          bool                   `json:"can_update"`
	CanChangeStatus    bool                   `json:"can_change_status"`
	CanCancel          bool                   `json:"can_cancel"`
	CanRestore         bool                   `json:"can_restore"`
	CanDelete          bool                   `json:"can_delete"`
	CanManageAC        bool                   `json:"can_manage_ac"`
	CanCreateTask      bool                   `json:"can_create_task"`
	CompletedAt        *time.Time             `json:"completed_at,omitempty"`
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
	Version            int64                  `json:"version"`
}

type Task struct {
	ID                    string     `json:"id"`
	RequirementID         string     `json:"requirement_id"`
	RequirementTitle      string     `json:"requirement_title,omitempty"`
	Title                 string     `json:"title"`
	AcceptanceCriteria    []string   `json:"acceptance_criteria"`
	AssigneeID            *string    `json:"assignee_id,omitempty"`
	AssigneeName          *string    `json:"assignee_name,omitempty"`
	CreatorTLID           string     `json:"creator_tl_id"`
	Status                string     `json:"status"`
	DisplayStatus         string     `json:"display_status"`
	Priority              string     `json:"priority"`
	Progress              int        `json:"progress"`
	DueDate               *string    `json:"due_date,omitempty"`
	Dependencies          []TaskDep  `json:"dependencies,omitempty"`
	Blocking              []TaskDep  `json:"blocking,omitempty"`
	RiskTypes             []string   `json:"risk_types"`
	TokenSourceIDs        []string   `json:"token_source_ids"`
	IsFollowed            bool       `json:"is_followed"`
	CanUpdateMeta         bool       `json:"can_update_meta"`
	CanReassign           bool       `json:"can_reassign"`
	CanUpdateStatus       bool       `json:"can_update_status"`
	CanUpdateProgress     bool       `json:"can_update_progress"`
	CanManageDependencies bool       `json:"can_manage_dependencies"`
	CanDelete             bool       `json:"can_delete"`
	CompletedAt           *time.Time `json:"completed_at,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	Version               int64      `json:"version"`
}

type TaskDep struct {
	TaskID    string `json:"task_id"`
	TaskTitle string `json:"task_title"`
	Status    string `json:"status"`
}

type RequirementTaskSummary struct {
	Total   int `json:"total"`
	Done    int `json:"done"`
	Blocked int `json:"blocked"`
}

type RequirementRiskSummary struct {
	Blocked int `json:"blocked"`
	Overdue int `json:"overdue"`
}

type RequirementFollowState struct {
	Requirement bool `json:"requirement"`
	TaskCount   int  `json:"task_count"`
}

// P0 API DTO aliases keep the contract names explicit while reusing the
// existing transport structs used by legacy handlers.
type RequirementListItemDTO = Requirement
type RequirementDetailDTO = Requirement
type RequirementTaskDTO = Task
type TaskDependencyDTO = TaskDep
type RequirementRiskSummaryDTO = RequirementRiskSummary
type RequirementFollowStateDTO = RequirementFollowState

type UserFollow struct {
	UserID     string    `json:"user_id"`
	TargetType string    `json:"target_type"`
	TargetID   string    `json:"target_id"`
	CreatedAt  time.Time `json:"created_at"`
}

type FollowFollower struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Role       string    `json:"role"`
	TeamID     *string   `json:"teamId,omitempty"`
	TeamName   *string   `json:"teamName,omitempty"`
	FollowedAt time.Time `json:"followedAt"`
}

type FollowRequest struct {
	TargetType string `json:"target_type"`
	TargetID   string `json:"target_id"`
}

type DashboardNavigationTarget struct {
	RequirementID string  `json:"requirementId"`
	TaskID        *string `json:"taskId,omitempty"`
	URL           string  `json:"url"`
}

type DashboardFollowItem struct {
	Key            string                    `json:"key"`
	Type           string                    `json:"type"`
	Title          string                    `json:"title"`
	Requirement    string                    `json:"requirement,omitempty"`
	RequirementID  string                    `json:"requirementId"`
	TaskID         *string                   `json:"taskId,omitempty"`
	Owner          string                    `json:"owner"`
	Status         string                    `json:"status"`
	Deadline       string                    `json:"deadline"`
	Risk           string                    `json:"risk"`
	Dependency     string                    `json:"dependency,omitempty"`
	Activity       string                    `json:"activity,omitempty"`
	AttentionScore int                       `json:"attentionScore"`
	AttentionLevel string                    `json:"attentionLevel"`
	FollowerCount  int                       `json:"followerCount"`
	RiskPriority   int                       `json:"riskPriority"`
	SortDueDate    *string                   `json:"-"`
	SortUpdatedAt  time.Time                 `json:"-"`
	Navigation     DashboardNavigationTarget `json:"navigation"`
}

type DashboardRiskTaskSummary struct {
	TaskID                    string    `json:"taskId"`
	Title                     string    `json:"title"`
	Deadline                  string    `json:"deadline,omitempty"`
	RiskTypes                 []string  `json:"riskTypes"`
	UnfinishedDependencyCount int       `json:"unfinishedDependencyCount,omitempty"`
	SortDueDate               *string   `json:"-"`
	SortUpdatedAt             time.Time `json:"-"`
}

type DashboardRiskGroup struct {
	Key                     string                    `json:"key"`
	DisplayType             string                    `json:"displayType"`
	RequirementID           string                    `json:"requirementId"`
	RequirementTitle        string                    `json:"requirementTitle"`
	RiskTypes               []string                  `json:"riskTypes"`
	RequirementOverdue      bool                      `json:"requirementOverdue"`
	DeadlineTaskCount       int                       `json:"deadlineTaskCount"`
	DependencyBlockerCount  int                       `json:"dependencyBlockerCount"`
	RepresentativeTask      *DashboardRiskTaskSummary `json:"representativeTask,omitempty"`
	Summary                 string                    `json:"summary"`
	Deadline                string                    `json:"deadline"`
	Level                   string                    `json:"level"`
	Tone                    string                    `json:"tone"`
	AttentionScore          int                       `json:"attentionScore"`
	AttentionLevel          string                    `json:"attentionLevel"`
	ActionText              string                    `json:"actionText"`
	TargetURL               string                    `json:"targetUrl"`
	Navigation              DashboardNavigationTarget `json:"navigation"`
	SortHasOverdue          bool                      `json:"-"`
	SortEarliestOverdueDate *string                   `json:"-"`
	SortUpdatedAt           time.Time                 `json:"-"`
}

type Session struct {
	ID              string     `json:"id"`
	SessionRef      string     `json:"session_ref"`
	UserID          string     `json:"user_id"`
	UserName        string     `json:"user_name"`
	AgentType       string     `json:"agent_type"`
	StartedAt       time.Time  `json:"started_at"`
	EndedAt         *time.Time `json:"ended_at,omitempty"`
	DurationSecs    *int       `json:"duration_secs,omitempty"`
	Model           string     `json:"model"`
	Summary         *string    `json:"summary,omitempty"`
	ToolCallsJSON   any        `json:"tool_calls_json,omitempty"`
	GitCommits      []string   `json:"git_commits,omitempty"`
	TaskID          *string    `json:"task_id,omitempty"`
	TaskTitle       *string    `json:"task_title,omitempty"`
	RequirementID   *string    `json:"requirement_id,omitempty"`
	MatchConfidence *float64   `json:"match_confidence,omitempty"`
	RawLogURL       *string    `json:"raw_log_url,omitempty"`
	UploadedAt      time.Time  `json:"uploaded_at"`
}

type PaginatedSessions struct {
	Items    []Session `json:"items"`
	Total    int       `json:"total"`
	Page     int       `json:"page"`
	PageSize int       `json:"page_size"`
}

type TokenUsage struct {
	ID            string    `json:"id"`
	SessionID     string    `json:"session_id"`
	UserID        string    `json:"user_id"`
	TaskID        *string   `json:"task_id,omitempty"`
	RequirementID *string   `json:"requirement_id,omitempty"`
	AgentType     string    `json:"agent_type"`
	Model         string    `json:"model"`
	InputTokens   int64     `json:"input_tokens"`
	OutputTokens  int64     `json:"output_tokens"`
	TotalTokens   int64     `json:"total_tokens"`
	RecordedAt    time.Time `json:"recorded_at"`
}

type DailyReport struct {
	ID               string     `json:"id"`
	UserID           string     `json:"user_id"`
	UserName         string     `json:"user_name"`
	ReportDate       string     `json:"report_date"`
	Content          string     `json:"content"`
	SubmittedContent *string    `json:"submitted_content,omitempty"`
	Status           *string    `json:"status,omitempty"`
	SubmittedTo      *string    `json:"submitted_to,omitempty"`
	Edited           bool       `json:"edited"`
	FeishuDocURL     *string    `json:"feishu_doc_url,omitempty"`
	SessionIDs       []string   `json:"session_ids"`
	SavedAt          *time.Time `json:"saved_at,omitempty"`
	SubmittedAt      *time.Time `json:"submitted_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type DailyReportListItem struct {
	ID                 string     `json:"id"`
	UserID             string     `json:"user_id"`
	UserName           string     `json:"user_name"`
	ReportDate         string     `json:"report_date"`
	Status             *string    `json:"status,omitempty"`
	SubmittedTo        *string    `json:"submitted_to,omitempty"`
	Edited             bool       `json:"edited"`
	SourceSessionCount int        `json:"source_session_count"`
	SessionIDs         []string   `json:"session_ids"`
	SavedAt            *time.Time `json:"saved_at,omitempty"`
	SubmittedAt        *time.Time `json:"submitted_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type PaginatedDailyReports struct {
	Items    []DailyReportListItem `json:"items"`
	Total    int                   `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"page_size"`
}

// Request/Response types

type LoginRequest struct {
	EmployeeID string `json:"employee_id"`
	Password   string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type RegisterRequest struct {
	EmployeeID string `json:"employee_id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Password   string `json:"password"`
}

type AdminUpdateUserRequest struct {
	Role      *string `json:"role,omitempty"`
	TeamID    *string `json:"team_id,omitempty"`
	ClearTeam bool    `json:"clear_team,omitempty"`
}

type AdminResetPasswordRequest struct {
	Password string `json:"password"`
}

type CreateRequirementRequest struct {
	Title              string   `json:"title"`
	Description        string   `json:"description"`
	FeishuDocURL       *string  `json:"feishu_doc_url,omitempty"`
	Priority           string   `json:"priority"`
	Deadline           *string  `json:"deadline,omitempty"`
	TeamIDs            []string `json:"team_ids"`
	AcceptanceCriteria []string `json:"acceptance_criteria,omitempty"`
}

type UpdateRequirementRequest struct {
	Title              *string   `json:"title,omitempty"`
	Description        *string   `json:"description,omitempty"`
	FeishuDocURL       *string   `json:"feishu_doc_url,omitempty"`
	Priority           *string   `json:"priority,omitempty"`
	Status             *string   `json:"status,omitempty"`
	Deadline           *string   `json:"deadline,omitempty"`
	AcceptanceCriteria *[]string `json:"acceptance_criteria,omitempty"`
	BaseVersion        int64     `json:"base_version"`
}

type RequirementVersionRequest struct {
	BaseVersion int64 `json:"base_version"`
}

type RegenerateACRequest struct {
	BaseVersion int64 `json:"base_version"`
}

type CreateTaskRequest struct {
	RequirementID      string   `json:"requirement_id"`
	Title              string   `json:"title"`
	AcceptanceCriteria []string `json:"acceptance_criteria,omitempty"`
	AssigneeID         *string  `json:"assignee_id,omitempty"`
	Priority           string   `json:"priority"`
	DueDate            *string  `json:"due_date,omitempty"`
	DependsOnIDs       []string `json:"depends_on_ids,omitempty"`
}

type UpdateTaskRequest struct {
	Title              *string   `json:"title,omitempty"`
	AcceptanceCriteria *[]string `json:"acceptance_criteria,omitempty"`
	AssigneeID         *string   `json:"assignee_id,omitempty"`
	Status             *string   `json:"status,omitempty"`
	Priority           *string   `json:"priority,omitempty"`
	DueDate            *string   `json:"due_date,omitempty"`
	Progress           *int      `json:"progress,omitempty"`
	BaseVersion        int64     `json:"base_version"`
}

type UpdateTaskStatusRequest struct {
	Status      string `json:"status"`
	BaseVersion int64  `json:"base_version"`
}

type UpdateTaskProgressRequest struct {
	Progress    int   `json:"progress"`
	BaseVersion int64 `json:"base_version"`
}

type UpdateSessionRequirementRequest struct {
	RequirementID *string `json:"requirement_id"`
}

type AddDependencyRequest struct {
	DependsOnID string `json:"depends_on_id"`
	BaseVersion int64  `json:"base_version"`
}

type BatchSessionUpload struct {
	Sessions []SessionUpload `json:"sessions"`
}

type SessionUpload struct {
	SessionRef   string         `json:"session_ref"`
	AgentType    string         `json:"agent_type,omitempty"`
	StartedAt    time.Time      `json:"started_at"`
	EndedAt      *time.Time     `json:"ended_at,omitempty"`
	DurationSecs *int           `json:"duration_secs,omitempty"`
	Model        string         `json:"model"`
	Summary      *string        `json:"summary,omitempty"`
	ToolCalls    map[string]int `json:"tool_calls,omitempty"`
	GitCommits   []string       `json:"git_commits,omitempty"`
	TokenUsage   *TokenUpload   `json:"token_usage,omitempty"`
}

type TokenUpload struct {
	InputTokens         int64    `json:"input_tokens"`
	OutputTokens        int64    `json:"output_tokens"`
	CacheCreationTokens int64    `json:"cache_creation_tokens"`
	CacheReadTokens     int64    `json:"cache_read_tokens"`
	TotalTokens         int64    `json:"total_tokens"`
	Models              []string `json:"models,omitempty"`
}

type UpdateSessionTaskRequest struct {
	TaskID *string `json:"task_id"`
}

type UpdateReportRequest struct {
	Content      *string   `json:"content,omitempty"`
	FeishuDocURL *string   `json:"feishu_doc_url,omitempty"`
	SessionIDs   *[]string `json:"session_ids,omitempty"`
}

type SubmitReportRequest struct {
	Content    *string   `json:"content,omitempty"`
	SessionIDs *[]string `json:"session_ids,omitempty"`
}

type WeeklySessionSource struct {
	SessionID        string     `json:"session_id"`
	SessionRef       string     `json:"session_ref"`
	AgentType        string     `json:"agent_type"`
	StartedAt        time.Time  `json:"started_at"`
	EndedAt          *time.Time `json:"ended_at,omitempty"`
	Summary          string     `json:"summary"`
	TaskID           *string    `json:"task_id,omitempty"`
	TaskTitle        string     `json:"task_title,omitempty"`
	RequirementID    *string    `json:"requirement_id,omitempty"`
	RequirementTitle string     `json:"requirement_title,omitempty"`
	TotalTokens      int64      `json:"total_tokens"`
}

type PersonalWeeklyReportSources struct {
	UserID       string                    `json:"user_id"`
	UserName     string                    `json:"user_name"`
	WeekStart    string                    `json:"week_start"`
	WeekEnd      string                    `json:"week_end"`
	DailyReports []WeeklyDailyReportSource `json:"daily_reports"`
	DailyCount   int                       `json:"daily_count"`
}

type PersonalWeeklyReport struct {
	ID                   string     `json:"id"`
	UserID               string     `json:"user_id"`
	UserName             string     `json:"user_name"`
	WeekStart            string     `json:"week_start"`
	WeekEnd              string     `json:"week_end"`
	Content              string     `json:"content"`
	SubmittedContent     *string    `json:"submitted_content,omitempty"`
	Status               string     `json:"status"`
	SavedAt              *time.Time `json:"saved_at,omitempty"`
	SubmittedAt          *time.Time `json:"submitted_at,omitempty"`
	SubmittedTo          *string    `json:"submitted_to,omitempty"`
	SourceDailyReportIDs []string   `json:"source_daily_report_ids"`
	SourceSessionIDs     []string   `json:"source_session_ids"`
	SourceTaskIDs        []string   `json:"source_task_ids"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type PersonalWeeklyReportListItem struct {
	ID                 string     `json:"id"`
	UserID             string     `json:"user_id"`
	UserName           string     `json:"user_name"`
	WeekStart          string     `json:"week_start"`
	WeekEnd            string     `json:"week_end"`
	Status             string     `json:"status"`
	SavedAt            *time.Time `json:"saved_at,omitempty"`
	SubmittedAt        *time.Time `json:"submitted_at,omitempty"`
	SubmittedTo        *string    `json:"submitted_to,omitempty"`
	SourceDailyCount   int        `json:"source_daily_count"`
	SourceSessionCount int        `json:"source_session_count"`
	SourceTaskCount    int        `json:"source_task_count"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type PaginatedPersonalWeeklyReports struct {
	Items    []PersonalWeeklyReportListItem `json:"items"`
	Total    int                            `json:"total"`
	Page     int                            `json:"page"`
	PageSize int                            `json:"page_size"`
}

type GeneratePersonalWeeklyReportRequest struct {
	WeekStart            string   `json:"week_start"`
	SourceDailyReportIDs []string `json:"source_daily_report_ids"`
}

type PersonalWeeklyReportPreview struct {
	ReportMarkdown       string   `json:"report_markdown"`
	WeekStart            string   `json:"week_start"`
	WeekEnd              string   `json:"week_end"`
	SourceDailyReportIDs []string `json:"source_daily_report_ids"`
}

type SavePersonalWeeklyReportRequest struct {
	WeekStart            string   `json:"week_start"`
	Content              string   `json:"content"`
	SourceDailyReportIDs []string `json:"source_daily_report_ids"`
}

type GenerateReportDraftRequest struct {
	ReportDate          string   `json:"report_date"`
	SessionIDs          []string `json:"session_ids"`
	SkillID             string   `json:"skill_id"`
	SkillContent        string   `json:"skill_content,omitempty"`
	IncludeTaskProgress bool     `json:"include_task_progress"`
}

type ReportDraftSession struct {
	ID               string         `json:"id"`
	SessionRef       string         `json:"session_ref"`
	AgentType        string         `json:"agent_type"`
	StartedAt        time.Time      `json:"started_at"`
	EndedAt          *time.Time     `json:"ended_at,omitempty"`
	DurationSecs     *int           `json:"duration_secs,omitempty"`
	Model            string         `json:"model"`
	Summary          string         `json:"summary,omitempty"`
	ToolCallsJSON    map[string]int `json:"tool_calls_json,omitempty"`
	TaskID           *string        `json:"task_id,omitempty"`
	TaskTitle        string         `json:"task_title,omitempty"`
	RequirementID    *string        `json:"requirement_id,omitempty"`
	RequirementTitle string         `json:"requirement_title,omitempty"`
	InputTokens      int64          `json:"input_tokens"`
	OutputTokens     int64          `json:"output_tokens"`
	TotalTokens      int64          `json:"total_tokens"`
}

type ReportDraftTaskCandidate struct {
	TaskID           string `json:"task_id"`
	TaskTitle        string `json:"task_title"`
	RequirementID    string `json:"requirement_id"`
	RequirementTitle string `json:"requirement_title"`
	CurrentStatus    string `json:"current_status"`
	CurrentProgress  int    `json:"current_progress"`
	Owner            string `json:"owner"`
}

type ReportDraftGeneratorRequest struct {
	UserID              string                     `json:"user_id"`
	UserName            string                     `json:"user_name"`
	ReportDate          string                     `json:"report_date"`
	Sessions            []ReportDraftSession       `json:"sessions"`
	TaskCandidates      []ReportDraftTaskCandidate `json:"task_candidates"`
	SkillID             string                     `json:"skill_id"`
	SkillContent        string                     `json:"skill_content,omitempty"`
	IncludeTaskProgress bool                       `json:"include_task_progress"`
}

type TaskProgressSuggestion struct {
	TaskID                string   `json:"task_id"`
	TaskTitle             string   `json:"task_title"`
	RequirementID         string   `json:"requirement_id,omitempty"`
	RequirementTitle      string   `json:"requirement_title,omitempty"`
	SuggestedStatus       string   `json:"suggested_status"`
	SuggestedProgress     int      `json:"suggested_progress"`
	EvidenceSessionIDs    []string `json:"evidence_session_ids"`
	EvidenceSessionTitles []string `json:"evidence_session_titles"`
	Reason                string   `json:"reason"`
}

type GenerateReportDraftResponse struct {
	ReportMarkdown          string                   `json:"report_markdown"`
	SelectedSessionIDs      []string                 `json:"selected_session_ids"`
	SkillName               string                   `json:"skill_name"`
	TaskProgressSuggestions []TaskProgressSuggestion `json:"task_progress_suggestions"`
}

type TeamReport struct {
	ID                   string     `json:"id"`
	TeamID               string     `json:"team_id"`
	TeamName             string     `json:"team_name"`
	LeaderID             string     `json:"leader_id"`
	LeaderName           string     `json:"leader_name"`
	ReportDate           string     `json:"report_date"`
	Content              string     `json:"content"`
	SubmittedContent     *string    `json:"submitted_content,omitempty"`
	Status               *string    `json:"status,omitempty"`
	FeishuDocURL         *string    `json:"feishu_doc_url,omitempty"`
	MemberReportIDs      []string   `json:"member_report_ids"`
	SourceDailyReportIDs []string   `json:"source_daily_report_ids"`
	SessionIDs           []string   `json:"session_ids"`
	SavedAt              *time.Time `json:"saved_at,omitempty"`
	SubmittedAt          *time.Time `json:"submitted_at,omitempty"`
	SubmittedTo          *string    `json:"submitted_to,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

type TeamReportListItem struct {
	ID             string     `json:"id"`
	TeamID         string     `json:"team_id"`
	TeamName       string     `json:"team_name"`
	LeaderID       string     `json:"leader_id"`
	LeaderName     string     `json:"leader_name"`
	ReportDate     string     `json:"report_date"`
	MemberCount    int        `json:"member_count"`
	SubmittedCount int        `json:"submitted_count"`
	MissingCount   int        `json:"missing_count"`
	Status         *string    `json:"status,omitempty"`
	SavedAt        *time.Time `json:"saved_at,omitempty"`
	SubmittedAt    *time.Time `json:"submitted_at,omitempty"`
	SubmittedTo    *string    `json:"submitted_to,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type PaginatedTeamReports struct {
	Items    []TeamReportListItem `json:"items"`
	Total    int                  `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"page_size"`
}

type TeamMemberReport struct {
	UserID      string     `json:"user_id"`
	UserName    string     `json:"user_name"`
	ReportID    *string    `json:"report_id,omitempty"`
	Content     string     `json:"content"`
	SubmittedAt *time.Time `json:"submitted_at,omitempty"`
	HasReport   bool       `json:"has_report"`
}

type UpdateTeamReportRequest struct {
	Content      *string `json:"content,omitempty"`
	FeishuDocURL *string `json:"feishu_doc_url,omitempty"`
}

type SubmitTeamReportRequest struct {
	Content *string `json:"content,omitempty"`
}

type TeamReportSources struct {
	TeamID           string             `json:"team_id"`
	TeamName         string             `json:"team_name"`
	ReportDate       string             `json:"report_date"`
	Members          []TeamMemberReport `json:"members"`
	SubmittedReports []TeamMemberReport `json:"submitted_reports"`
	MissingMembers   []TeamMemberReport `json:"missing_members"`
	TotalMemberCount int                `json:"total_member_count"`
	Submitted        int                `json:"submitted"`
	SubmittedCount   int                `json:"submitted_count"`
	Missing          int                `json:"missing"`
	MissingCount     int                `json:"missing_count"`
}

type DepartmentTeamReportSource struct {
	TeamID         string     `json:"team_id"`
	TeamName       string     `json:"team_name"`
	LeaderID       *string    `json:"leader_id,omitempty"`
	LeaderName     string     `json:"leader_name"`
	TeamLeaderName string     `json:"team_leader_name"`
	ReportID       *string    `json:"report_id,omitempty"`
	TeamReportID   *string    `json:"team_report_id,omitempty"`
	Content        string     `json:"content"`
	SubmittedAt    *time.Time `json:"submitted_at,omitempty"`
	HasReport      bool       `json:"has_report"`
}

type DepartmentMissingTeam struct {
	TeamID   string `json:"team_id"`
	TeamName string `json:"team_name"`
}

type DepartmentReportSources struct {
	ReportDate           string                       `json:"report_date"`
	SubmittedTeamCount   int                          `json:"submitted_team_count"`
	TotalTeamCount       int                          `json:"total_team_count"`
	MissingTeamCount     int                          `json:"missing_team_count"`
	SubmittedTeamReports []DepartmentTeamReportSource `json:"submitted_team_reports"`
	MissingTeams         []DepartmentMissingTeam      `json:"missing_teams"`
}

type DepartmentReport struct {
	ID                  string     `json:"id"`
	ReportDate          string     `json:"report_date"`
	Content             string     `json:"content"`
	Status              *string    `json:"status,omitempty"`
	SourceTeamReportIDs []string   `json:"source_team_report_ids"`
	SavedAt             *time.Time `json:"saved_at,omitempty"`
	ArchivedAt          *time.Time `json:"archived_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type DepartmentReportListItem struct {
	ID                 string     `json:"id"`
	ReportDate         string     `json:"report_date"`
	TeamCount          int        `json:"team_count"`
	SubmittedTeamCount int        `json:"submitted_team_count"`
	MissingTeamCount   int        `json:"missing_team_count"`
	Status             *string    `json:"status,omitempty"`
	SavedAt            *time.Time `json:"saved_at,omitempty"`
	ArchivedAt         *time.Time `json:"archived_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type PaginatedDepartmentReports struct {
	Items    []DepartmentReportListItem `json:"items"`
	Total    int                        `json:"total"`
	Page     int                        `json:"page"`
	PageSize int                        `json:"page_size"`
}

type UpdateDepartmentReportRequest struct {
	Content *string `json:"content,omitempty"`
	Archive bool    `json:"archive,omitempty"`
}

type WeeklyDailyReportSource struct {
	ReportID   string `json:"report_id"`
	UserID     string `json:"user_id"`
	UserName   string `json:"user_name"`
	ReportDate string `json:"report_date"`
	Content    string `json:"content"`
}

type WeeklyTeamDailyReportSource struct {
	ReportID    string     `json:"report_id"`
	TeamID      string     `json:"team_id"`
	TeamName    string     `json:"team_name"`
	LeaderID    string     `json:"leader_id"`
	LeaderName  string     `json:"leader_name"`
	ReportDate  string     `json:"report_date"`
	Content     string     `json:"content"`
	SubmittedAt *time.Time `json:"submitted_at,omitempty"`
}

type WeeklyTaskSource struct {
	TaskID           string  `json:"task_id"`
	TaskTitle        string  `json:"task_title"`
	RequirementID    string  `json:"requirement_id"`
	RequirementTitle string  `json:"requirement_title"`
	AssigneeID       *string `json:"assignee_id,omitempty"`
	AssigneeName     string  `json:"assignee_name"`
	Status           string  `json:"status"`
	Priority         string  `json:"priority"`
	DueDate          *string `json:"due_date,omitempty"`
}

type TeamWeeklyReportSources struct {
	TeamID                         string                        `json:"team_id"`
	TeamName                       string                        `json:"team_name"`
	WeekStart                      string                        `json:"week_start"`
	WeekEnd                        string                        `json:"week_end"`
	SubmittedPersonalWeeklyReports []TeamPersonalWeeklySource    `json:"submitted_personal_weekly_reports"`
	MissingPeople                  []TeamWeeklyMissingPerson     `json:"missing_people"`
	SubmittedPersonalWeeklyCount   int                           `json:"submitted_personal_weekly_count"`
	MissingPeopleCount             int                           `json:"missing_people_count"`
	DailyReports                   []WeeklyDailyReportSource     `json:"daily_reports,omitempty"`
	TeamReports                    []WeeklyTeamDailyReportSource `json:"team_reports,omitempty"`
	Tasks                          []WeeklyTaskSource            `json:"tasks,omitempty"`
	SubmittedDailyCount            int                           `json:"submitted_daily_count,omitempty"`
	TeamReportCount                int                           `json:"team_report_count,omitempty"`
	TaskCount                      int                           `json:"task_count,omitempty"`
}

type TeamPersonalWeeklySource struct {
	ReportID         string     `json:"report_id"`
	UserID           string     `json:"user_id"`
	UserName         string     `json:"user_name"`
	SourceRole       string     `json:"source_role"`
	WeekStart        string     `json:"week_start"`
	WeekEnd          string     `json:"week_end"`
	SubmittedAt      *time.Time `json:"submitted_at,omitempty"`
	SubmittedContent string     `json:"submitted_content"`
}

type TeamWeeklyMissingPerson struct {
	UserID     string `json:"user_id"`
	UserName   string `json:"user_name"`
	SourceRole string `json:"source_role"`
}

type TeamWeeklyReport struct {
	ID                            string     `json:"id"`
	TeamID                        string     `json:"team_id"`
	TeamName                      string     `json:"team_name"`
	LeaderID                      string     `json:"leader_id"`
	LeaderName                    string     `json:"leader_name"`
	WeekStart                     string     `json:"week_start"`
	Content                       string     `json:"content"`
	SourceDailyReportIDs          []string   `json:"source_daily_report_ids"`
	SourceTeamReportIDs           []string   `json:"source_team_report_ids"`
	SourceTaskIDs                 []string   `json:"source_task_ids"`
	SourcePersonalWeeklyReportIDs []string   `json:"source_personal_weekly_report_ids"`
	SubmittedAt                   *time.Time `json:"submitted_at,omitempty"`
	CreatedAt                     time.Time  `json:"created_at"`
	UpdatedAt                     time.Time  `json:"updated_at"`
}

type GenerateTeamWeeklyReportRequest struct {
	WeekStart                     string   `json:"week_start"`
	SourcePersonalWeeklyReportIDs []string `json:"source_personal_weekly_report_ids"`
}

type TeamWeeklyReportPreview struct {
	ReportMarkdown                string   `json:"report_markdown"`
	WeekStart                     string   `json:"week_start"`
	WeekEnd                       string   `json:"week_end"`
	SourcePersonalWeeklyReportIDs []string `json:"source_personal_weekly_report_ids"`
}

type UpdateTeamWeeklyReportRequest struct {
	WeekStart                     string   `json:"week_start,omitempty"`
	Content                       *string  `json:"content,omitempty"`
	SourcePersonalWeeklyReportIDs []string `json:"source_personal_weekly_report_ids,omitempty"`
}

type DepartmentTeamWeeklyReportSource struct {
	TeamID      string     `json:"team_id"`
	TeamName    string     `json:"team_name"`
	LeaderID    *string    `json:"leader_id,omitempty"`
	LeaderName  string     `json:"leader_name"`
	ReportID    *string    `json:"report_id,omitempty"`
	Content     string     `json:"content"`
	SubmittedAt *time.Time `json:"submitted_at,omitempty"`
	HasReport   bool       `json:"has_report"`
}

type DepartmentWeeklyReportSources struct {
	WeekStart            string                             `json:"week_start"`
	WeekEnd              string                             `json:"week_end"`
	SubmittedTeamCount   int                                `json:"submitted_team_count"`
	TotalTeamCount       int                                `json:"total_team_count"`
	SubmittedTeamReports []DepartmentTeamWeeklyReportSource `json:"submitted_team_reports"`
	MissingTeams         []DepartmentMissingTeam            `json:"missing_teams"`
}

type DepartmentWeeklyReport struct {
	ID                        string     `json:"id"`
	WeekStart                 string     `json:"week_start"`
	Content                   string     `json:"content"`
	SourceTeamWeeklyReportIDs []string   `json:"source_team_weekly_report_ids"`
	ArchivedAt                *time.Time `json:"archived_at,omitempty"`
	CreatedAt                 time.Time  `json:"created_at"`
	UpdatedAt                 time.Time  `json:"updated_at"`
}

type UpdateDepartmentWeeklyReportRequest struct {
	Content *string `json:"content,omitempty"`
	Archive bool    `json:"archive,omitempty"`
}

type ACStatus struct {
	Index       int      `json:"index"`
	Text        string   `json:"text"`
	Completed   bool     `json:"completed"`
	LinkedTasks []string `json:"linked_tasks"`
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

type UpdateACRequest struct {
	AcceptanceCriteria []string `json:"acceptance_criteria"`
}

type TokenAggregation struct {
	Total            int64        `json:"total"`
	InputSum         int64        `json:"input_sum"`
	OutputSum        int64        `json:"output_sum"`
	CacheCreationSum int64        `json:"cache_creation_sum"`
	CacheReadSum     int64        `json:"cache_read_sum"`
	Groups           []TokenGroup `json:"groups"`
	Series           []TokenPoint `json:"series"`
	Period           string       `json:"period"`
	GroupBy          string       `json:"group_by"`
}

type SessionTokens struct {
	SessionID           string    `json:"session_id"`
	SessionRef          string    `json:"session_ref"`
	UserID              string    `json:"user_id"`
	UserName            string    `json:"user_name"`
	AgentType           string    `json:"agent_type"`
	Models              []string  `json:"models"`
	Summary             *string   `json:"summary,omitempty"`
	StartedAt           time.Time `json:"started_at"`
	InputTokens         int64     `json:"input_tokens"`
	OutputTokens        int64     `json:"output_tokens"`
	CacheCreationTokens int64     `json:"cache_creation_tokens"`
	CacheReadTokens     int64     `json:"cache_read_tokens"`
	TotalTokens         int64     `json:"total_tokens"`
}

type PaginatedSessionTokens struct {
	Items    []SessionTokens `json:"items"`
	Total    int             `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"page_size"`
}

type TokenGroup struct {
	Key     string  `json:"key"`
	Label   string  `json:"label"`
	Value   int64   `json:"value"`
	Percent float64 `json:"percent"`
}

type TokenPoint struct {
	Date  string `json:"date"`
	Value int64  `json:"value"`
}

type TeamActivity struct {
	Teams        []TeamStat    `json:"teams"`
	IdleWarnings []IdleWarning `json:"idle_warnings"`
}

type TeamStat struct {
	TeamID   string       `json:"team_id"`
	TeamName string       `json:"team_name"`
	Active   int          `json:"active"`
	Total    int          `json:"total"`
	Members  []MemberStat `json:"members"`
}

type MemberStat struct {
	UserID     string  `json:"user_id"`
	UserName   string  `json:"user_name"`
	Active     bool    `json:"active"`
	LastActive *string `json:"last_active,omitempty"`
	IdleDays   int     `json:"idle_days"`
}

type IdleWarning struct {
	UserID   string `json:"user_id"`
	UserName string `json:"user_name"`
	TeamName string `json:"team_name"`
	IdleDays int    `json:"idle_days"`
}
