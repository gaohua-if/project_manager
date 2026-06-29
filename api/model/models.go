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
	CanDelete          bool                   `json:"can_delete"`
	CompletedAt        *time.Time             `json:"completed_at,omitempty"`
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
}

type Task struct {
	ID                 string     `json:"id"`
	RequirementID      string     `json:"requirement_id"`
	RequirementTitle   string     `json:"requirement_title,omitempty"`
	Title              string     `json:"title"`
	AcceptanceCriteria []string   `json:"acceptance_criteria"`
	AssigneeID         *string    `json:"assignee_id,omitempty"`
	AssigneeName       *string    `json:"assignee_name,omitempty"`
	CreatorTLID        string     `json:"creator_tl_id"`
	Status             string     `json:"status"`
	DisplayStatus      string     `json:"display_status"`
	Priority           string     `json:"priority"`
	Progress           int        `json:"progress"`
	DueDate            *string    `json:"due_date,omitempty"`
	Dependencies       []TaskDep  `json:"dependencies,omitempty"`
	Blocking           []TaskDep  `json:"blocking,omitempty"`
	RiskTypes          []string   `json:"risk_types"`
	TokenSourceIDs     []string   `json:"token_source_ids"`
	IsFollowed         bool       `json:"is_followed"`
	CompletedAt        *time.Time `json:"completed_at,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
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
	Key           string                    `json:"key"`
	Type          string                    `json:"type"`
	Title         string                    `json:"title"`
	Requirement   string                    `json:"requirement,omitempty"`
	RequirementID string                    `json:"requirementId"`
	TaskID        *string                   `json:"taskId,omitempty"`
	Owner         string                    `json:"owner"`
	Status        string                    `json:"status"`
	Deadline      string                    `json:"deadline"`
	Risk          string                    `json:"risk"`
	Dependency    string                    `json:"dependency,omitempty"`
	Activity      string                    `json:"activity,omitempty"`
	Navigation    DashboardNavigationTarget `json:"navigation"`
}

type DashboardRiskItem struct {
	Key               string                    `json:"key"`
	RiskType          string                    `json:"riskType"`
	Title             string                    `json:"title"`
	Source            string                    `json:"source"`
	Target            string                    `json:"target"`
	RelatedObjectType string                    `json:"relatedObjectType"`
	RequirementID     string                    `json:"requirementId"`
	TaskID            string                    `json:"taskId"`
	Owner             string                    `json:"owner"`
	Deadline          string                    `json:"deadline"`
	Reason            string                    `json:"reason"`
	Level             string                    `json:"level"`
	Tone              string                    `json:"tone"`
	ActionText        string                    `json:"actionText"`
	TargetURL         string                    `json:"targetUrl"`
	Navigation        DashboardNavigationTarget `json:"navigation"`
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
	ID                string    `json:"id"`
	UserID            string    `json:"user_id"`
	UserName          string    `json:"user_name"`
	ReportDate        string    `json:"report_date"`
	Content           string    `json:"content"`
	Edited            bool      `json:"edited"`
	FeishuDocURL      *string   `json:"feishu_doc_url,omitempty"`
	SessionIDs        []string  `json:"session_ids"`
	GenerationMode    string    `json:"generation_mode,omitempty"`
	ManagedAgentRunID *string   `json:"managed_agent_run_id,omitempty"`
	AgentID           *string   `json:"agent_id,omitempty"`
	AgentVersionID    *int      `json:"agent_version_id,omitempty"`
	ModelID           *string   `json:"model_id,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
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
}

type UpdateTaskStatusRequest struct {
	Status string `json:"status"`
}

type UpdateTaskProgressRequest struct {
	Progress int `json:"progress"`
}

type UpdateSessionRequirementRequest struct {
	RequirementID *string `json:"requirement_id"`
}

type AddDependencyRequest struct {
	DependsOnID string `json:"depends_on_id"`
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
	Content           *string   `json:"content,omitempty"`
	FeishuDocURL      *string   `json:"feishu_doc_url,omitempty"`
	SessionIDs        *[]string `json:"session_ids,omitempty"`
	ManagedAgentRunID *string   `json:"managed_agent_run_id,omitempty"`
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
	ManagedAgentRunID       string                   `json:"managed_agent_run_id,omitempty"`
	AgentID                 string                   `json:"agent_id,omitempty"`
	AgentVersionID          *int                     `json:"agent_version_id,omitempty"`
	ModelID                 string                   `json:"model_id,omitempty"`
	Status                  string                   `json:"status,omitempty"`
}

type ManagedScope string

const (
	ManagedScopeMine   ManagedScope = "mine"
	ManagedScopePublic ManagedScope = "public"
	ManagedScopeAll    ManagedScope = "all"
)

type ManagedSkill struct {
	SkillID     string `json:"skill_id"`
	Owner       string `json:"owner,omitempty"`
	Slug        string `json:"slug"`
	Version     string `json:"version"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	SHA256      string `json:"sha256,omitempty"`
	SizeBytes   int64  `json:"size_bytes,omitempty"`
	Archived    bool   `json:"archived"`
	CreatedAt   int64  `json:"created_at,omitempty"`
}

type ManagedMCPEntry struct {
	EntryID            string            `json:"entry_id,omitempty"`
	Owner              string            `json:"owner,omitempty"`
	Slug               string            `json:"slug"`
	Version            string            `json:"version"`
	Name               string            `json:"name"`
	Description        string            `json:"description,omitempty"`
	Transport          string            `json:"transport"`
	Command            string            `json:"command,omitempty"`
	Args               []string          `json:"args,omitempty"`
	URL                string            `json:"url,omitempty"`
	Headers            map[string]string `json:"headers,omitempty"`
	Env                map[string]string `json:"env,omitempty"`
	RequiresCredential bool              `json:"requires_credential"`
	CredentialEnv      string            `json:"credential_env,omitempty"`
	AuthScheme         string            `json:"auth_scheme,omitempty"`
	AuthHeader         string            `json:"auth_header,omitempty"`
	Archived           bool              `json:"archived"`
	CreatedAt          int64             `json:"created_at,omitempty"`
}

type ManagedSkillRef struct {
	Owner   string `json:"owner,omitempty"`
	Slug    string `json:"slug"`
	Version string `json:"version"`
}

type ManagedMCPBinding struct {
	Owner          string `json:"owner,omitempty"`
	Slug           string `json:"slug"`
	Version        string `json:"version"`
	CredentialSlot string `json:"credential_slot,omitempty"`
}

type ManagedAgent struct {
	AgentID             string              `json:"agent_id"`
	Name                string              `json:"name"`
	Description         string              `json:"description,omitempty"`
	Engine              string              `json:"engine"`
	Instructions        string              `json:"instructions,omitempty"`
	DefaultModelID      string              `json:"default_model_id,omitempty"`
	StartPromptTemplate string              `json:"start_prompt_template,omitempty"`
	CurrentVersionID    int                 `json:"current_version_id,omitempty"`
	ManagedVersion      int                 `json:"managed_version,omitempty"`
	Archived            bool                `json:"archived"`
	IsPublic            bool                `json:"is_public"`
	Skills              []ManagedSkillRef   `json:"skills,omitempty"`
	MCPBindings         []ManagedMCPBinding `json:"mcp_bindings,omitempty"`
	CreatedAt           int64               `json:"created_at,omitempty"`
}

type ListManagedSkillsResponse struct {
	Skills []ManagedSkill `json:"skills"`
}

type ListManagedMCPEntriesResponse struct {
	Entries []ManagedMCPEntry `json:"entries"`
}

type ListManagedAgentsResponse struct {
	Agents []ManagedAgent `json:"agents"`
}

type UpsertManagedAgentRequest struct {
	AgentID             string              `json:"agent_id,omitempty"`
	Name                string              `json:"name"`
	Description         string              `json:"description,omitempty"`
	Engine              string              `json:"engine"`
	Instructions        string              `json:"instructions,omitempty"`
	DefaultModelID      string              `json:"default_model_id,omitempty"`
	StartPromptTemplate string              `json:"start_prompt_template,omitempty"`
	Skills              []ManagedSkillRef   `json:"skills,omitempty"`
	MCPBindings         []ManagedMCPBinding `json:"mcp_bindings,omitempty"`
}

type UpsertManagedAgentResponse struct {
	AgentID        string `json:"agent_id"`
	ManagedVersion int    `json:"managed_version,omitempty"`
}

type CreateManagedMCPEntryRequest = ManagedMCPEntry

type ManagedReportRunRequest struct {
	ReportDate string   `json:"report_date"`
	SessionIDs []string `json:"session_ids"`
	AgentID    string   `json:"agent_id"`
	ModelID    string   `json:"model_id,omitempty"`
}

type ManagedAgentManualRunRequest struct {
	Message string            `json:"message"`
	ModelID string            `json:"model_id,omitempty"`
	Params  map[string]string `json:"params,omitempty"`
}

type ManagedAgentSchedule struct {
	ID           string            `json:"id"`
	UserID       string            `json:"user_id"`
	Name         string            `json:"name"`
	AgentID      string            `json:"agent_id"`
	ModelID      *string           `json:"model_id,omitempty"`
	Message      string            `json:"message"`
	Params       map[string]string `json:"params,omitempty"`
	ScheduleType string            `json:"schedule_type"`
	Weekdays     []int             `json:"weekdays"`
	TimeOfDay    string            `json:"time_of_day"`
	Timezone     string            `json:"timezone"`
	Enabled      bool              `json:"enabled"`
	LastRunAt    *time.Time        `json:"last_run_at,omitempty"`
	LastAIRunID  *string           `json:"last_ai_run_id,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

type UpsertManagedAgentScheduleRequest struct {
	Name         string            `json:"name"`
	AgentID      string            `json:"agent_id"`
	ModelID      string            `json:"model_id,omitempty"`
	Message      string            `json:"message"`
	Params       map[string]string `json:"params,omitempty"`
	ScheduleType string            `json:"schedule_type"`
	Weekdays     []int             `json:"weekdays,omitempty"`
	TimeOfDay    string            `json:"time_of_day"`
	Timezone     string            `json:"timezone,omitempty"`
	Enabled      *bool             `json:"enabled,omitempty"`
}

type AIRun struct {
	ID                string                       `json:"id"`
	UserID            string                       `json:"user_id"`
	BusinessType      string                       `json:"business_type"`
	BusinessID        *string                      `json:"business_id,omitempty"`
	RuntimeType       string                       `json:"runtime_type"`
	AgentID           string                       `json:"agent_id"`
	AgentVersionID    *int                         `json:"agent_version_id,omitempty"`
	ExternalTaskID    *string                      `json:"external_task_id,omitempty"`
	ExternalSessionID *string                      `json:"external_session_id,omitempty"`
	ModelID           *string                      `json:"model_id,omitempty"`
	Status            string                       `json:"status"`
	InputRef          map[string]any               `json:"input_ref_json,omitempty"`
	OutputRef         map[string]any               `json:"output_ref_json,omitempty"`
	Result            string                       `json:"result,omitempty"`
	ErrorMessage      *string                      `json:"error_message,omitempty"`
	Draft             *GenerateReportDraftResponse `json:"draft,omitempty"`
	StartedAt         *time.Time                   `json:"started_at,omitempty"`
	FinishedAt        *time.Time                   `json:"finished_at,omitempty"`
	CreatedAt         time.Time                    `json:"created_at"`
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
	UserID    string  `json:"user_id"`
	UserName  string  `json:"user_name"`
	ReportID  *string `json:"report_id,omitempty"`
	Content   string  `json:"content"`
	HasReport bool    `json:"has_report"`
}

type UpdateTeamReportRequest struct {
	Content      *string `json:"content,omitempty"`
	FeishuDocURL *string `json:"feishu_doc_url,omitempty"`
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
	StartedAt           time.Time `json:"started_at"`
	InputTokens         int64     `json:"input_tokens"`
	OutputTokens        int64     `json:"output_tokens"`
	CacheCreationTokens int64     `json:"cache_creation_tokens"`
	CacheReadTokens     int64     `json:"cache_read_tokens"`
	TotalTokens         int64     `json:"total_tokens"`
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
