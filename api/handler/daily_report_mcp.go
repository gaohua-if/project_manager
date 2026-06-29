package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
	"github.com/lib/pq"
)

const (
	mcpProtocolFallback      = "2024-11-05"
	dailyReportContextTool   = "aida_daily_report_get_context"
	dailyReportSaveDraftTool = "aida_daily_report_save_draft"
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
		result = h.initializeResult(req.Params)
	case "ping":
		result = map[string]any{}
	case "tools/list":
		result = map[string]any{"tools": dailyReportMCPTools()}
	case "tools/call":
		result, err = h.callTool(r, req.Params)
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

func (h *DailyReportMCPHandler) initializeResult(params json.RawMessage) map[string]any {
	protocolVersion := mcpProtocolFallback
	var initParams struct {
		ProtocolVersion string `json:"protocolVersion"`
	}
	if len(params) > 0 && json.Unmarshal(params, &initParams) == nil && initParams.ProtocolVersion != "" {
		protocolVersion = initParams.ProtocolVersion
	}
	return map[string]any{
		"protocolVersion": protocolVersion,
		"capabilities":    map[string]any{"tools": map[string]any{}},
		"serverInfo": map[string]string{
			"name":    "aida-daily-report-mcp",
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
