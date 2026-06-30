package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
	"github.com/lib/pq"
)

const (
	mcpProtocolFallback      = "2024-11-05"
	dailyReportContextTool   = "aida_daily_report_get_context"
	dailyReportSaveDraftTool = "aida_daily_report_save_draft"
	reportGetContextTool     = "get_report_context"
	reportWriteResultTool    = "write_report_result"
	reportWriteFailureTool   = "write_report_failure"
	reportTypePersonalDaily  = "personal_daily"
	reportEditConflictCode   = "REPORT_EDIT_CONFLICT"
)

type DailyReportMCPHandler struct {
	db *sql.DB
}

func NewDailyReportMCPHandler(db *sql.DB) *DailyReportMCPHandler {
	return &DailyReportMCPHandler{db: db}
}

type mcpRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type mcpResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Result  any             `json:"result,omitempty"`
	Error   *mcpError       `json:"error,omitempty"`
}

type mcpError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type mcpToolCallParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

func (h *DailyReportMCPHandler) Serve(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, false)
}

func (h *DailyReportMCPHandler) ServeReports(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, true)
}

func (h *DailyReportMCPHandler) serve(w http.ResponseWriter, r *http.Request, reportMode bool) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	var req mcpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeMCPError(w, nil, -32700, "invalid JSON")
		return
	}
	if len(req.ID) == 0 && strings.HasPrefix(req.Method, "notifications/") {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var result any
	var err error
	switch req.Method {
	case "initialize":
		result = h.initializeResult(req.Params, reportMode)
	case "ping":
		result = map[string]any{}
	case "tools/list":
		if reportMode {
			result = map[string]any{"tools": reportMCPTools()}
		} else {
			result = map[string]any{"tools": dailyReportMCPTools()}
		}
	case "tools/call":
		if reportMode {
			result, err = h.callReportTool(r, req.Params)
		} else {
			result, err = h.callTool(r, req.Params)
		}
	default:
		writeMCPError(w, req.ID, -32601, "method not found")
		return
	}
	if err != nil {
		writeMCPError(w, req.ID, -32000, err.Error())
		return
	}
	writeMCPResult(w, req.ID, result)
}

func (h *DailyReportMCPHandler) initializeResult(params json.RawMessage, reportMode bool) map[string]any {
	protocolVersion := mcpProtocolFallback
	var initParams struct {
		ProtocolVersion string `json:"protocolVersion"`
	}
	if len(params) > 0 && json.Unmarshal(params, &initParams) == nil && initParams.ProtocolVersion != "" {
		protocolVersion = initParams.ProtocolVersion
	}
	name := "aida-daily-report-mcp"
	if reportMode {
		name = "aida-report-mcp"
	}
	return map[string]any{
		"protocolVersion": protocolVersion,
		"capabilities":    map[string]any{"tools": map[string]any{}},
		"serverInfo": map[string]string{
			"name":    name,
			"version": "1.0.0",
		},
	}
}

func (h *DailyReportMCPHandler) callTool(r *http.Request, rawParams json.RawMessage) (any, error) {
	var params mcpToolCallParams
	if err := json.Unmarshal(rawParams, &params); err != nil {
		return nil, fmt.Errorf("invalid tool call params")
	}
	switch params.Name {
	case dailyReportContextTool:
		return h.getDailyReportContext(r, params.Arguments)
	case dailyReportSaveDraftTool:
		return h.saveDailyReportDraft(r, params.Arguments)
	default:
		return nil, fmt.Errorf("unknown tool: %s", params.Name)
	}
}

func (h *DailyReportMCPHandler) callReportTool(r *http.Request, rawParams json.RawMessage) (any, error) {
	var params mcpToolCallParams
	if err := json.Unmarshal(rawParams, &params); err != nil {
		return nil, fmt.Errorf("invalid tool call params")
	}
	switch params.Name {
	case reportGetContextTool:
		return h.getReportContext(r, params.Arguments)
	case reportWriteResultTool:
		return h.writeReportResult(r, params.Arguments)
	case reportWriteFailureTool:
		return h.writeReportFailure(r, params.Arguments)
	default:
		return nil, fmt.Errorf("unknown tool: %s", params.Name)
	}
}

type dailyReportContextArgs struct {
	ReportDate          string   `json:"report_date"`
	SessionIDs          []string `json:"session_ids"`
	IncludeTaskProgress *bool    `json:"include_task_progress,omitempty"`
}

func (h *DailyReportMCPHandler) getDailyReportContext(r *http.Request, rawArgs json.RawMessage) (any, error) {
	u := getUser(r)
	if u == nil {
		return nil, fmt.Errorf("missing authenticated user")
	}
	var args dailyReportContextArgs
	if len(rawArgs) > 0 {
		if err := json.Unmarshal(rawArgs, &args); err != nil {
			return nil, fmt.Errorf("invalid arguments")
		}
	}
	reportDate := strings.TrimSpace(args.ReportDate)
	if reportDate == "" {
		reportDate = service.TodayInLocalDate()
	}
	sessionIDs := uniqueStringsPreserveOrder(args.SessionIDs)
	var err error
	if len(sessionIDs) == 0 {
		sessionIDs, err = h.loadDailyReportSessionIDs(u.ID, reportDate)
		if err != nil {
			return nil, err
		}
	}

	sessions, err := loadDraftSessions(h.db, u.ID, sessionIDs)
	if err != nil {
		return nil, err
	}
	if len(sessions) != len(sessionIDs) {
		return nil, fmt.Errorf("one or more sessions are not accessible")
	}
	tasks := []model.ReportDraftTaskCandidate{}
	includeTasks := true
	if args.IncludeTaskProgress != nil {
		includeTasks = *args.IncludeTaskProgress
	}
	if includeTasks {
		tasks, err = loadDraftTaskCandidates(h.db, u.ID)
		if err != nil {
			return nil, err
		}
	}

	payload := map[string]any{
		"user": map[string]string{
			"id":   u.ID,
			"name": u.Name,
			"role": u.Role,
		},
		"report_date":          reportDate,
		"selected_session_ids": sessionIDs,
		"sessions":             orderDraftSessions(sessions, sessionIDs),
		"task_candidates":      tasks,
		"output_contract":      service.DailyReportOutputContract(),
	}
	return mcpTextResult(payload, false), nil
}

type reportPeriodArgs struct {
	Date      string `json:"date"`
	WeekStart string `json:"week_start,omitempty"`
}

type reportContextArgs struct {
	ReportType string           `json:"report_type"`
	Period     reportPeriodArgs `json:"period"`
	RunID      string           `json:"run_id,omitempty"`
}

type reportWriteResultArgs struct {
	ReportType     string           `json:"report_type"`
	Period         reportPeriodArgs `json:"period"`
	RunID          string           `json:"run_id"`
	Content        string           `json:"content"`
	ReportMarkdown string           `json:"report_markdown"`
	Summary        string           `json:"summary,omitempty"`
}

type reportWriteFailureArgs struct {
	ReportType   string           `json:"report_type"`
	Period       reportPeriodArgs `json:"period"`
	RunID        string           `json:"run_id"`
	ErrorCode    string           `json:"error_code,omitempty"`
	ErrorMessage string           `json:"error_message"`
}

type reportAIRun struct {
	ID        string
	AgentID   string
	ModelID   *string
	CreatedAt time.Time
}

type personalDailyReportSnapshot struct {
	ID                string
	Content           string
	Edited            bool
	GenerationMode    string
	ManagedAgentRunID *string
	AgentID           *string
	ModelID           *string
	CreatedAt         time.Time
	UpdatedAt         time.Time
	GeneratedAt       *time.Time
}

func (h *DailyReportMCPHandler) getReportContext(r *http.Request, rawArgs json.RawMessage) (any, error) {
	u := getUser(r)
	if u == nil {
		return nil, fmt.Errorf("missing authenticated user")
	}
	var args reportContextArgs
	if len(rawArgs) == 0 || json.Unmarshal(rawArgs, &args) != nil {
		return nil, fmt.Errorf("invalid arguments")
	}
	if err := validatePersonalDailyReportArgs(args.ReportType); err != nil {
		return nil, err
	}
	reportDate, err := requireReportDate(args.Period)
	if err != nil {
		return nil, err
	}
	runID := strings.TrimSpace(args.RunID)
	if runID != "" {
		if _, err := h.loadAIRunForUser(runID, u.ID); err != nil {
			return nil, err
		}
	}

	sessionIDs, err := h.loadDailyReportSessionIDs(u.ID, reportDate)
	if err != nil {
		return nil, err
	}
	sessions, err := loadDraftSessions(h.db, u.ID, sessionIDs)
	if err != nil {
		return nil, err
	}
	tasks, err := loadDraftTaskCandidates(h.db, u.ID)
	if err != nil {
		return nil, err
	}
	currentReport, err := h.loadPersonalDailyReport(u.ID, reportDate)
	if err != nil {
		return nil, err
	}

	userPayload := map[string]any{
		"id":      u.ID,
		"name":    u.Name,
		"role":    u.Role,
		"team_id": nullableStringPtrValue(u.TeamID),
	}
	payload := map[string]any{
		"report": map[string]any{
			"report_type":    reportTypePersonalDaily,
			"period":         map[string]any{"date": reportDate},
			"product_status": personalDailyProductStatus(currentReport),
			"current_report": personalDailyReportPayload(currentReport),
		},
		"actor":          userPayload,
		"current_user":   userPayload,
		"source_summary": map[string]any{"source_total": len(sessions), "usable_count": len(sessions), "missing_count": 0},
		"sources":        []any{},
		"context": map[string]any{
			"work_records": orderDraftSessions(sessions, sessionIDs),
			"sessions":     orderDraftSessions(sessions, sessionIDs),
			"tasks":        tasks,
			"requirements": requirementsFromTaskCandidates(tasks),
		},
		"constraints": map[string]any{
			"must_not_invent_facts": true,
			"output_language":       "zh-CN",
			"output_format":         "markdown",
		},
		"output_contract": service.DailyReportOutputContract(),
	}
	return mcpTextResult(payload, false), nil
}

func (h *DailyReportMCPHandler) writeReportResult(r *http.Request, rawArgs json.RawMessage) (any, error) {
	u := getUser(r)
	if u == nil {
		return nil, fmt.Errorf("missing authenticated user")
	}
	var args reportWriteResultArgs
	if len(rawArgs) == 0 || json.Unmarshal(rawArgs, &args) != nil {
		return nil, fmt.Errorf("invalid arguments")
	}
	if err := validatePersonalDailyReportArgs(args.ReportType); err != nil {
		return nil, err
	}
	reportDate, err := requireReportDate(args.Period)
	if err != nil {
		return nil, err
	}
	runID := strings.TrimSpace(args.RunID)
	if runID == "" {
		return nil, fmt.Errorf("run_id is required")
	}
	run, err := h.loadAIRunForUser(runID, u.ID)
	if err != nil {
		return nil, err
	}
	content := strings.TrimSpace(args.Content)
	if content == "" {
		content = strings.TrimSpace(args.ReportMarkdown)
	}
	if content == "" {
		return nil, fmt.Errorf("content is required")
	}

	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	existing, err := h.loadPersonalDailyReportForUpdate(r, tx, u.ID, reportDate)
	if err != nil {
		return nil, err
	}
	if existing != nil && existing.Edited && existing.UpdatedAt.After(run.CreatedAt) {
		message := "报告已被用户编辑，AI 回写已取消"
		if err := h.markAIRunFailedTx(r, tx, run.ID, u.ID, reportEditConflictCode, message); err != nil {
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("%s: %s", reportEditConflictCode, message)
	}

	var reportID string
	err = tx.QueryRowContext(r.Context(), `
		INSERT INTO daily_reports (
			user_id, report_date, content, edited,
			generation_mode, managed_agent_run_id, agent_id, model_id, status, saved_at
		)
		VALUES ($1, $2, $3, false, 'managed_agent', $4, $5, $6, 'saved', now())
		ON CONFLICT (user_id, report_date) DO UPDATE
		SET content = EXCLUDED.content,
			edited = false,
			generation_mode = 'managed_agent',
			managed_agent_run_id = EXCLUDED.managed_agent_run_id,
			agent_id = EXCLUDED.agent_id,
			model_id = EXCLUDED.model_id,
			status = 'saved',
			saved_at = now(),
			updated_at = now()
		RETURNING id::text`,
		u.ID, reportDate, content, run.ID, nullableStringValue(run.AgentID), nullableStringPtrValue(run.ModelID),
	).Scan(&reportID)
	if err != nil {
		return nil, err
	}
	outputRef, _ := json.Marshal(map[string]any{
		"report_type": reportTypePersonalDaily,
		"report_date": reportDate,
		"summary":     args.Summary,
	})
	if _, err := tx.ExecContext(r.Context(), `
		UPDATE ai_runs
		SET status = 'succeeded',
			business_id = $1,
			output_ref_json = $2,
			error_message = NULL,
			finished_at = now()
		WHERE id = $3 AND user_id = $4`, reportID, outputRef, run.ID, u.ID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return mcpTextResult(map[string]any{
		"status":               "saved",
		"report_id":            reportID,
		"report_type":          reportTypePersonalDaily,
		"report_date":          reportDate,
		"product_status":       "ai_generated",
		"origin":               "ai",
		"updated_by_user":      false,
		"agent_run_id":         run.ID,
		"managed_agent_run_id": run.ID,
		"usable_for_rollup":    true,
	}, false), nil
}

func (h *DailyReportMCPHandler) writeReportFailure(r *http.Request, rawArgs json.RawMessage) (any, error) {
	u := getUser(r)
	if u == nil {
		return nil, fmt.Errorf("missing authenticated user")
	}
	var args reportWriteFailureArgs
	if len(rawArgs) == 0 || json.Unmarshal(rawArgs, &args) != nil {
		return nil, fmt.Errorf("invalid arguments")
	}
	if err := validatePersonalDailyReportArgs(args.ReportType); err != nil {
		return nil, err
	}
	if _, err := requireReportDate(args.Period); err != nil {
		return nil, err
	}
	runID := strings.TrimSpace(args.RunID)
	if runID == "" {
		return nil, fmt.Errorf("run_id is required")
	}
	errorMessage := strings.TrimSpace(args.ErrorMessage)
	if errorMessage == "" {
		errorMessage = "Agent 生成失败"
	}
	errorCode := strings.TrimSpace(args.ErrorCode)
	if _, err := h.loadAIRunForUser(runID, u.ID); err != nil {
		return nil, err
	}
	if err := h.markAIRunFailed(r, runID, u.ID, errorCode, errorMessage); err != nil {
		return nil, err
	}
	return mcpTextResult(map[string]any{
		"run_id":    runID,
		"status":    "failed",
		"retryable": true,
	}, false), nil
}

func (h *DailyReportMCPHandler) loadDailyReportSessionIDs(userID, reportDate string) ([]string, error) {
	rows, err := h.db.Query(`
		SELECT id::text
		FROM sessions
		WHERE user_id = $1 AND DATE(started_at) = $2
		ORDER BY started_at`, userID, reportDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ids := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

type dailyReportSaveDraftArgs struct {
	ReportDate         string   `json:"report_date"`
	ReportMarkdown     string   `json:"report_markdown"`
	SelectedSessionIDs []string `json:"selected_session_ids"`
	SessionIDs         []string `json:"session_ids"`
	ExternalTaskID     string   `json:"external_task_id,omitempty"`
	AgentID            string   `json:"agent_id,omitempty"`
	ModelID            string   `json:"model_id,omitempty"`
}

func (h *DailyReportMCPHandler) saveDailyReportDraft(r *http.Request, rawArgs json.RawMessage) (any, error) {
	u := getUser(r)
	if u == nil {
		return nil, fmt.Errorf("missing authenticated user")
	}
	var args dailyReportSaveDraftArgs
	if len(rawArgs) == 0 || json.Unmarshal(rawArgs, &args) != nil {
		return nil, fmt.Errorf("invalid arguments")
	}
	reportMarkdown := strings.TrimSpace(args.ReportMarkdown)
	if reportMarkdown == "" {
		return nil, fmt.Errorf("report_markdown is required")
	}
	reportDate := strings.TrimSpace(args.ReportDate)
	if reportDate == "" {
		reportDate = service.TodayInLocalDate()
	}
	sessionIDs := uniqueStringsPreserveOrder(args.SelectedSessionIDs)
	if len(sessionIDs) == 0 {
		sessionIDs = uniqueStringsPreserveOrder(args.SessionIDs)
	}
	if err := h.validateSessionIDs(u.ID, sessionIDs); err != nil {
		return nil, err
	}

	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var runID any
	var runIDString string
	if strings.TrimSpace(args.ExternalTaskID) != "" && strings.TrimSpace(args.AgentID) != "" {
		inputRef, _ := json.Marshal(map[string]any{
			"trigger_source": "mcp",
			"report_date":    reportDate,
			"session_ids":    sessionIDs,
		})
		outputRef, _ := json.Marshal(map[string]any{
			"result": reportMarkdown,
		})
		if err := tx.QueryRowContext(r.Context(), `
			INSERT INTO ai_runs (
				user_id, business_type, runtime_type, agent_id, external_task_id,
				model_id, status, input_ref_json, output_ref_json, started_at, finished_at
			)
			VALUES ($1, 'daily_report', 'managed_task', $2, $3, $4, 'succeeded', $5, $6, now(), now())
			RETURNING id::text`,
			u.ID, strings.TrimSpace(args.AgentID), strings.TrimSpace(args.ExternalTaskID),
			nullableStringValue(strings.TrimSpace(args.ModelID)), inputRef, outputRef,
		).Scan(&runIDString); err != nil {
			return nil, err
		}
		runID = runIDString
	}

	var reportID string
	err = tx.QueryRowContext(r.Context(), `
		INSERT INTO daily_reports (
			user_id, report_date, content, edited, session_ids,
			generation_mode, managed_agent_run_id, agent_id, model_id
		)
		VALUES ($1, $2, $3, false, $4, 'managed_agent', $5, $6, $7)
		ON CONFLICT (user_id, report_date) DO UPDATE
		SET content = EXCLUDED.content,
			edited = false,
			session_ids = EXCLUDED.session_ids,
			generation_mode = 'managed_agent',
			managed_agent_run_id = EXCLUDED.managed_agent_run_id,
			agent_id = EXCLUDED.agent_id,
			model_id = EXCLUDED.model_id,
			updated_at = now()
		RETURNING id::text`,
		u.ID, reportDate, reportMarkdown, pq.Array(sessionIDs), runID,
		nullableStringValue(strings.TrimSpace(args.AgentID)),
		nullableStringValue(strings.TrimSpace(args.ModelID)),
	).Scan(&reportID)
	if err != nil {
		return nil, err
	}
	if runIDString != "" {
		if _, err := tx.ExecContext(r.Context(), `UPDATE ai_runs SET business_id = $1 WHERE id = $2`, reportID, runIDString); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return mcpTextResult(map[string]any{
		"status":                 "saved",
		"report_id":              reportID,
		"report_date":            reportDate,
		"managed_agent_run_id":   runIDString,
		"selected_session_count": len(sessionIDs),
	}, false), nil
}

func (h *DailyReportMCPHandler) validateSessionIDs(userID string, sessionIDs []string) error {
	if len(sessionIDs) == 0 {
		return nil
	}
	var count int
	if err := h.db.QueryRow(`
		SELECT COUNT(*)
		FROM sessions
		WHERE user_id = $1 AND id::text = ANY($2)`, userID, pq.Array(sessionIDs)).Scan(&count); err != nil {
		return err
	}
	if count != len(sessionIDs) {
		return fmt.Errorf("one or more sessions are not accessible")
	}
	return nil
}

func validatePersonalDailyReportArgs(reportType string) error {
	if strings.TrimSpace(reportType) != reportTypePersonalDaily {
		if strings.TrimSpace(reportType) == "" {
			return fmt.Errorf("report_type is required")
		}
		return fmt.Errorf("unsupported report_type: %s", strings.TrimSpace(reportType))
	}
	return nil
}

func requireReportDate(period reportPeriodArgs) (string, error) {
	reportDate := strings.TrimSpace(period.Date)
	if reportDate == "" {
		return "", fmt.Errorf("period.date is required")
	}
	if _, err := time.Parse("2006-01-02", reportDate); err != nil {
		return "", fmt.Errorf("period.date must be YYYY-MM-DD")
	}
	return reportDate, nil
}

func (h *DailyReportMCPHandler) loadAIRunForUser(runID, userID string) (*reportAIRun, error) {
	var run reportAIRun
	var modelID sql.NullString
	err := h.db.QueryRow(`
		SELECT id::text, COALESCE(agent_id, ''), model_id, created_at
		FROM ai_runs
		WHERE id::text = $1 AND user_id = $2`, strings.TrimSpace(runID), userID).
		Scan(&run.ID, &run.AgentID, &modelID, &run.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("invalid run_id")
	}
	if err != nil {
		return nil, err
	}
	run.ModelID = nullStringPtr(modelID)
	return &run, nil
}

func (h *DailyReportMCPHandler) loadPersonalDailyReport(userID, reportDate string) (*personalDailyReportSnapshot, error) {
	var report personalDailyReportSnapshot
	var managedAgentRunID, agentID, modelID sql.NullString
	var generatedAt sql.NullTime
	err := h.db.QueryRow(`
		SELECT dr.id::text, dr.content, dr.edited, COALESCE(dr.generation_mode, ''),
			dr.managed_agent_run_id::text, dr.agent_id, dr.model_id,
			dr.created_at, dr.updated_at, ar.finished_at
		FROM daily_reports dr
		LEFT JOIN ai_runs ar ON ar.id = dr.managed_agent_run_id
		WHERE dr.user_id = $1 AND dr.report_date = $2`, userID, reportDate).
		Scan(&report.ID, &report.Content, &report.Edited, &report.GenerationMode,
			&managedAgentRunID, &agentID, &modelID, &report.CreatedAt, &report.UpdatedAt, &generatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	report.ManagedAgentRunID = nullStringPtr(managedAgentRunID)
	report.AgentID = nullStringPtr(agentID)
	report.ModelID = nullStringPtr(modelID)
	report.GeneratedAt = nullTimePtr(generatedAt)
	return &report, nil
}

func (h *DailyReportMCPHandler) loadPersonalDailyReportForUpdate(r *http.Request, tx *sql.Tx, userID, reportDate string) (*personalDailyReportSnapshot, error) {
	var report personalDailyReportSnapshot
	var managedAgentRunID, agentID, modelID sql.NullString
	var generatedAt sql.NullTime
	err := tx.QueryRowContext(r.Context(), `
		SELECT dr.id::text, dr.content, dr.edited, COALESCE(dr.generation_mode, ''),
			dr.managed_agent_run_id::text, dr.agent_id, dr.model_id,
			dr.created_at, dr.updated_at, ar.finished_at
		FROM daily_reports dr
		LEFT JOIN ai_runs ar ON ar.id = dr.managed_agent_run_id
		WHERE dr.user_id = $1 AND dr.report_date = $2
		FOR UPDATE OF dr`, userID, reportDate).
		Scan(&report.ID, &report.Content, &report.Edited, &report.GenerationMode,
			&managedAgentRunID, &agentID, &modelID, &report.CreatedAt, &report.UpdatedAt, &generatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	report.ManagedAgentRunID = nullStringPtr(managedAgentRunID)
	report.AgentID = nullStringPtr(agentID)
	report.ModelID = nullStringPtr(modelID)
	report.GeneratedAt = nullTimePtr(generatedAt)
	return &report, nil
}

func personalDailyProductStatus(report *personalDailyReportSnapshot) string {
	if report == nil {
		return "missing"
	}
	if report.GenerationMode == "managed_agent" && !report.Edited {
		return "ai_generated"
	}
	if report.GenerationMode == "managed_agent" && report.Edited {
		return "modified"
	}
	return "manual"
}

func personalDailyReportPayload(report *personalDailyReportSnapshot) any {
	if report == nil {
		return nil
	}
	origin := "manual"
	if report.GenerationMode == "managed_agent" {
		origin = "ai"
	}
	return map[string]any{
		"id":                   report.ID,
		"content":              report.Content,
		"product_status":       personalDailyProductStatus(report),
		"origin":               origin,
		"updated_by_user":      report.Edited,
		"generated_at":         report.GeneratedAt,
		"agent_run_id":         report.ManagedAgentRunID,
		"managed_agent_run_id": report.ManagedAgentRunID,
		"agent_id":             report.AgentID,
		"model_id":             report.ModelID,
		"created_at":           report.CreatedAt,
		"updated_at":           report.UpdatedAt,
	}
}

func requirementsFromTaskCandidates(tasks []model.ReportDraftTaskCandidate) []map[string]any {
	seen := map[string]bool{}
	requirements := []map[string]any{}
	for _, task := range tasks {
		if task.RequirementID == "" || seen[task.RequirementID] {
			continue
		}
		seen[task.RequirementID] = true
		requirements = append(requirements, map[string]any{
			"id":    task.RequirementID,
			"title": task.RequirementTitle,
		})
	}
	return requirements
}

func (h *DailyReportMCPHandler) markAIRunFailed(r *http.Request, runID, userID, errorCode, message string) error {
	_, err := h.db.ExecContext(r.Context(), `
		UPDATE ai_runs
		SET status = 'failed',
			error_message = $1,
			finished_at = now()
		WHERE id::text = $2 AND user_id = $3`, formatReportMCPErrorMessage(errorCode, message), runID, userID)
	return err
}

func (h *DailyReportMCPHandler) markAIRunFailedTx(r *http.Request, tx *sql.Tx, runID, userID, errorCode, message string) error {
	_, err := tx.ExecContext(r.Context(), `
		UPDATE ai_runs
		SET status = 'failed',
			error_message = $1,
			finished_at = now()
		WHERE id::text = $2 AND user_id = $3`, formatReportMCPErrorMessage(errorCode, message), runID, userID)
	return err
}

func formatReportMCPErrorMessage(errorCode, message string) string {
	errorCode = strings.TrimSpace(errorCode)
	message = strings.TrimSpace(message)
	if errorCode == "" {
		return message
	}
	if message == "" {
		return errorCode
	}
	return errorCode + ": " + message
}

func nullableStringPtrValue(value *string) any {
	if value == nil || strings.TrimSpace(*value) == "" {
		return nil
	}
	return *value
}

func reportMCPTools() []map[string]any {
	return []map[string]any{
		{
			"name":        reportGetContextTool,
			"description": "Read personal daily report context for the authenticated Aida user.",
			"inputSchema": map[string]any{
				"type":     "object",
				"required": []string{"report_type", "period"},
				"properties": map[string]any{
					"report_type": map[string]any{"type": "string", "enum": []string{reportTypePersonalDaily}},
					"period": map[string]any{
						"type":       "object",
						"required":   []string{"date"},
						"properties": map[string]any{"date": map[string]string{"type": "string"}},
					},
					"run_id": map[string]string{"type": "string"},
				},
			},
		},
		{
			"name":        reportWriteResultTool,
			"description": "Write generated personal daily report content for the authenticated Aida user.",
			"inputSchema": map[string]any{
				"type":     "object",
				"required": []string{"report_type", "period", "run_id", "content"},
				"properties": map[string]any{
					"report_type": map[string]any{"type": "string", "enum": []string{reportTypePersonalDaily}},
					"period": map[string]any{
						"type":       "object",
						"required":   []string{"date"},
						"properties": map[string]any{"date": map[string]string{"type": "string"}},
					},
					"run_id":  map[string]string{"type": "string"},
					"content": map[string]string{"type": "string"},
					"summary": map[string]string{"type": "string"},
				},
			},
		},
		{
			"name":        reportWriteFailureTool,
			"description": "Record personal daily report generation failure without changing report content.",
			"inputSchema": map[string]any{
				"type":     "object",
				"required": []string{"report_type", "period", "run_id", "error_message"},
				"properties": map[string]any{
					"report_type": map[string]any{"type": "string", "enum": []string{reportTypePersonalDaily}},
					"period": map[string]any{
						"type":       "object",
						"required":   []string{"date"},
						"properties": map[string]any{"date": map[string]string{"type": "string"}},
					},
					"run_id":        map[string]string{"type": "string"},
					"error_code":    map[string]string{"type": "string"},
					"error_message": map[string]string{"type": "string"},
				},
			},
		},
	}
}

func dailyReportMCPTools() []map[string]any {
	return []map[string]any{
		{
			"name":        dailyReportContextTool,
			"description": "Read Aida daily report context for the authenticated user.",
			"inputSchema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"report_date":           map[string]string{"type": "string", "description": "Date in YYYY-MM-DD. Defaults to today."},
					"session_ids":           map[string]any{"type": "array", "items": map[string]string{"type": "string"}},
					"include_task_progress": map[string]string{"type": "boolean"},
				},
			},
		},
		{
			"name":        dailyReportSaveDraftTool,
			"description": "Save a generated Aida daily report draft for the authenticated user.",
			"inputSchema": map[string]any{
				"type":     "object",
				"required": []string{"report_markdown"},
				"properties": map[string]any{
					"report_date":          map[string]string{"type": "string", "description": "Date in YYYY-MM-DD. Defaults to today."},
					"report_markdown":      map[string]string{"type": "string"},
					"selected_session_ids": map[string]any{"type": "array", "items": map[string]string{"type": "string"}},
					"external_task_id":     map[string]string{"type": "string"},
					"agent_id":             map[string]string{"type": "string"},
					"model_id":             map[string]string{"type": "string"},
				},
			},
		},
	}
}

func mcpTextResult(value any, isError bool) map[string]any {
	payload, _ := json.Marshal(value)
	return map[string]any{
		"content": []map[string]string{
			{"type": "text", "text": string(payload)},
		},
		"isError": isError,
	}
}

func writeMCPResult(w http.ResponseWriter, id json.RawMessage, result any) {
	writeJSON(w, http.StatusOK, mcpResponse{JSONRPC: "2.0", ID: id, Result: result})
}

func writeMCPError(w http.ResponseWriter, id json.RawMessage, code int, message string) {
	writeJSON(w, http.StatusOK, mcpResponse{JSONRPC: "2.0", ID: id, Error: &mcpError{Code: code, Message: message}})
}

func nullableStringValue(value string) any {
	if value == "" {
		return nil
	}
	return value
}
