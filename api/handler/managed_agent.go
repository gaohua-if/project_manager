package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
	"github.com/go-chi/chi/v5"
)

type ManagedAgentHandler struct {
	db     *sql.DB
	client *service.ManagedAgentClient
}

const defaultDailyReportModelID = "Kimi-K2.6"

func NewManagedAgentHandler(db *sql.DB, client *service.ManagedAgentClient) *ManagedAgentHandler {
	return &ManagedAgentHandler{db: db, client: client}
}

func (h *ManagedAgentHandler) ensureConfigured(w http.ResponseWriter) bool {
	if h.client == nil || !h.client.Configured() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "managed agent platform is not configured"})
		return false
	}
	return true
}

// proxyJSON runs the ensureConfigured + call + standard error/writeJSON sequence
// shared by every pass-through managed-agent endpoint.
func (h *ManagedAgentHandler) proxyJSON(w http.ResponseWriter, call func() (any, error)) {
	if !h.ensureConfigured(w) {
		return
	}
	resp, err := call()
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *ManagedAgentHandler) ListSkills(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	h.proxyJSON(w, func() (any, error) { return h.client.ListSkills(r.Context(), scope) })
}

func (h *ManagedAgentHandler) ListMCPEntries(w http.ResponseWriter, r *http.Request) {
	scope := r.URL.Query().Get("scope")
	h.proxyJSON(w, func() (any, error) { return h.client.ListMCPEntries(r.Context(), scope) })
}

func (h *ManagedAgentHandler) CreateMCPEntry(w http.ResponseWriter, r *http.Request) {
	var req model.CreateManagedMCPEntryRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if strings.TrimSpace(req.Slug) == "" || strings.TrimSpace(req.Version) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "slug and version are required"})
		return
	}
	h.proxyJSON(w, func() (any, error) { return h.client.CreateMCPEntry(r.Context(), req) })
}

func (h *ManagedAgentHandler) ListMyAgents(w http.ResponseWriter, r *http.Request) {
	h.proxyJSON(w, func() (any, error) { return h.client.ListMyAgents(r.Context()) })
}

func (h *ManagedAgentHandler) CreateMyAgent(w http.ResponseWriter, r *http.Request) {
	var req model.UpsertManagedAgentRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Engine) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and engine are required"})
		return
	}
	h.proxyJSON(w, func() (any, error) { return h.client.CreateMyAgent(r.Context(), req) })
}

func (h *ManagedAgentHandler) UpdateMyAgent(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "agentId")
	var req model.UpsertManagedAgentRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	h.proxyJSON(w, func() (any, error) { return h.client.UpdateMyAgent(r.Context(), agentID, req) })
}

func (h *ManagedAgentHandler) StartAgentRun(w http.ResponseWriter, r *http.Request) {
	if !h.ensureConfigured(w) {
		return
	}
	u := getUser(r)
	agentID := chi.URLParam(r, "agentId")
	var req model.ManagedAgentManualRunRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	req.Message = strings.TrimSpace(req.Message)
	if agentID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id is required"})
		return
	}
	req.ModelID = strings.TrimSpace(req.ModelID)

	params := map[string]string{}
	for key, value := range req.Params {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		params[key] = strings.TrimSpace(value)
	}
	if req.Message != "" {
		params["message"] = req.Message
	}
	if len(params) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message or params is required"})
		return
	}
	submitResp, err := h.client.SubmitTask(r.Context(), service.SubmitManagedTaskRequest{
		AgentID: agentID,
		ModelID: req.ModelID,
		Params:  params,
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	inputRef := map[string]any{
		"message":        req.Message,
		"params":         req.Params,
		"trigger_source": "manual",
	}
	runID, err := h.insertAIRun(u.ID, "manual_agent_run", agentID, submitResp, req.ModelID, inputRef)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	run, err := h.loadAIRun(runID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) GetAgentRun(w http.ResponseWriter, r *http.Request) {
	if !h.ensureConfigured(w) {
		return
	}
	u := getUser(r)
	runID := chi.URLParam(r, "runId")
	run, err := h.loadAIRun(runID, u.ID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if run.ExternalTaskID != nil && (!isTerminalManagedStatus(run.Status) || (run.Status == "succeeded" && run.Result == "")) {
		refreshed, err := h.refreshAIRun(r, run)
		if err != nil {
			msg := err.Error()
			run.ErrorMessage = &msg
			writeJSON(w, http.StatusOK, run)
			return
		}
		run = refreshed
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) ListAgentRuns(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	agentID := strings.TrimSpace(r.URL.Query().Get("agent_id"))
	businessType := strings.TrimSpace(r.URL.Query().Get("business_type"))
	_, limit := parsePagination(r, 50, 100)

	query := aiRunSelectColumns + " WHERE user_id = $1"
	args := []any{u.ID}
	argIdx := 2
	if agentID != "" {
		query += fmt.Sprintf(" AND agent_id = $%d", argIdx)
		args = append(args, agentID)
		argIdx++
	}
	if businessType != "" {
		query += fmt.Sprintf(" AND business_type = $%d", argIdx)
		args = append(args, businessType)
		argIdx++
	}
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argIdx)
	args = append(args, limit)

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	runs := []model.AIRun{}
	for rows.Next() {
		run, err := scanAIRun(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		runs = append(runs, *run)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"runs": runs})
}

func (h *ManagedAgentHandler) DailyReportIntegration(w http.ResponseWriter, r *http.Request) {
	mcpURL := absoluteRequestURL(r, "/api/v1/mcp/daily-report")
	writeJSON(w, http.StatusOK, map[string]any{
		"mcp": map[string]any{
			"name":        "Aida Daily Report MCP",
			"url":         mcpURL,
			"transport":   "http",
			"description": "Provides daily report context and draft saving tools for Managed Agents.",
			"tools": []string{
				"aida_daily_report_get_context",
				"aida_daily_report_save_draft",
			},
		},
		"skill": map[string]string{
			"slug":     service.DailyReportSkillSlug,
			"version":  service.DailyReportSkillVersion,
			"name":     service.DailyReportSkillName,
			"skill_md": service.DailyReportSkillMarkdown(mcpURL),
		},
	})
}

func (h *ManagedAgentHandler) ListAgentSchedules(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	rows, err := h.db.Query(managedAgentScheduleSelectColumns+" WHERE user_id = $1 ORDER BY created_at DESC", u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	items := []model.ManagedAgentSchedule{}
	for rows.Next() {
		item, err := scanManagedAgentSchedule(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"schedules": items})
}

func (h *ManagedAgentHandler) CreateAgentSchedule(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	var req model.UpsertManagedAgentScheduleRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	normalized, err := normalizeManagedAgentScheduleRequest(req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	paramsJSON, _ := json.Marshal(normalized.Params)
	weekdaysJSON, _ := json.Marshal(normalized.Weekdays)

	var id string
	err = h.db.QueryRow(`
		INSERT INTO managed_agent_schedules (
			user_id, name, agent_id, model_id, message, params_json,
			schedule_type, weekdays_json, time_of_day, timezone, enabled
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id::text`,
		u.ID, normalized.Name, normalized.AgentID, nullString(&normalized.ModelID),
		normalized.Message, paramsJSON, normalized.ScheduleType, weekdaysJSON,
		normalized.TimeOfDay, normalized.Timezone, normalized.Enabled,
	).Scan(&id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	schedule, err := h.loadManagedAgentSchedule(id, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, schedule)
}

func (h *ManagedAgentHandler) UpdateAgentSchedule(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	scheduleID := chi.URLParam(r, "scheduleId")
	var req model.UpsertManagedAgentScheduleRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	normalized, err := normalizeManagedAgentScheduleRequest(req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	paramsJSON, _ := json.Marshal(normalized.Params)
	weekdaysJSON, _ := json.Marshal(normalized.Weekdays)

	res, err := h.db.Exec(`
		UPDATE managed_agent_schedules
		SET name = $1, agent_id = $2, model_id = $3, message = $4,
			params_json = $5, schedule_type = $6, weekdays_json = $7,
			time_of_day = $8, timezone = $9, enabled = $10, updated_at = now()
		WHERE id = $11 AND user_id = $12`,
		normalized.Name, normalized.AgentID, nullString(&normalized.ModelID),
		normalized.Message, paramsJSON, normalized.ScheduleType, weekdaysJSON,
		normalized.TimeOfDay, normalized.Timezone, normalized.Enabled, scheduleID, u.ID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	schedule, err := h.loadManagedAgentSchedule(scheduleID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, schedule)
}

func (h *ManagedAgentHandler) DeleteAgentSchedule(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	scheduleID := chi.URLParam(r, "scheduleId")
	res, err := h.db.Exec(`DELETE FROM managed_agent_schedules WHERE id = $1 AND user_id = $2`, scheduleID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *ManagedAgentHandler) RunAgentScheduleNow(w http.ResponseWriter, r *http.Request) {
	if !h.ensureConfigured(w) {
		return
	}
	u := getUser(r)
	scheduleID := chi.URLParam(r, "scheduleId")
	schedule, err := h.loadManagedAgentSchedule(scheduleID, u.ID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	params := map[string]string{"message": schedule.Message, "trigger_source": "manual", "schedule_id": schedule.ID}
	for key, value := range schedule.Params {
		params[key] = value
	}
	modelID := ""
	if schedule.ModelID != nil {
		modelID = *schedule.ModelID
	}
	submitResp, err := h.client.SubmitTask(r.Context(), service.SubmitManagedTaskRequest{
		AgentID: schedule.AgentID,
		ModelID: modelID,
		Params:  params,
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	inputRef := map[string]any{
		"schedule_id":    schedule.ID,
		"schedule_name":  schedule.Name,
		"message":        schedule.Message,
		"params":         schedule.Params,
		"trigger_source": "manual",
	}
	runID, err := h.insertAIRun(u.ID, "manual_agent_run", schedule.AgentID, submitResp, modelID, inputRef)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	_, _ = h.db.Exec(`
		UPDATE managed_agent_schedules
		SET last_run_at = now(), last_ai_run_id = $1, updated_at = now()
		WHERE id = $2 AND user_id = $3`, runID, schedule.ID, u.ID)
	run, err := h.loadAIRun(runID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) StartDailyReportRun(w http.ResponseWriter, r *http.Request) {
	if !h.ensureConfigured(w) {
		return
	}
	u := getUser(r)
	var req model.ManagedReportRunRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	req.SessionIDs = uniqueStringsPreserveOrder(req.SessionIDs)
	if strings.TrimSpace(req.AgentID) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "agent_id is required"})
		return
	}
	if len(req.SessionIDs) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "session_ids is required"})
		return
	}
	reportDate := req.ReportDate
	if reportDate == "" {
		reportDate = service.TodayInLocalDate()
	}

	sessions, err := loadDraftSessions(h.db, u.ID, req.SessionIDs)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if len(sessions) != len(req.SessionIDs) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "one or more sessions are not accessible"})
		return
	}
	sessionURLs := dailyReportSessionLogURLs(r, orderDraftSessions(sessions, req.SessionIDs))
	urlsJSON, _ := json.Marshal(sessionURLs)
	req.ModelID = strings.TrimSpace(req.ModelID)
	if req.ModelID == "" {
		req.ModelID = defaultDailyReportModelID
	}

	submitResp, err := h.client.SubmitTask(r.Context(), service.SubmitManagedTaskRequest{
		AgentID: req.AgentID,
		ModelID: req.ModelID,
		Params: map[string]string{
			"urls":            string(urlsJSON),
			"output_contract": service.DailyReportOutputContract(),
			"report_date":     reportDate,
		},
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	inputRef := map[string]any{
		"report_date": reportDate,
		"session_ids": req.SessionIDs,
		"urls":        sessionURLs,
	}
	runID, err := h.insertAIRun(u.ID, "daily_report", req.AgentID, submitResp, req.ModelID, inputRef)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	run, err := h.loadAIRun(runID, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) GetDailyReportRun(w http.ResponseWriter, r *http.Request) {
	if !h.ensureConfigured(w) {
		return
	}
	u := getUser(r)
	runID := chi.URLParam(r, "runId")
	run, err := h.loadAIRun(runID, u.ID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if run.ExternalTaskID != nil && (!isTerminalManagedStatus(run.Status) || (run.Status == "succeeded" && run.Draft == nil)) {
		run, err = h.refreshAIRun(r, run)
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
			return
		}
	}
	writeJSON(w, http.StatusOK, run)
}

func (h *ManagedAgentHandler) refreshAIRun(r *http.Request, run *model.AIRun) (*model.AIRun, error) {
	task, err := h.client.GetTaskResult(r.Context(), *run.ExternalTaskID)
	if err != nil {
		return nil, err
	}
	status := normalizeManagedRunStatus(task.Status)
	output := map[string]any{
		"task_id":  task.TaskID,
		"status":   task.Status,
		"progress": task.Progress,
		"result":   task.Result,
	}
	if task.Error != "" {
		output["error"] = task.Error
	}
	if len(task.Raw) > 0 {
		var raw any
		if json.Unmarshal(task.Raw, &raw) == nil {
			output["raw"] = raw
		}
	}

	var draft *model.GenerateReportDraftResponse
	var errMsg *string
	if status == "succeeded" && run.BusinessType == "daily_report" {
		parsed, err := service.ParseManagedReportDraft(task.Result)
		if err != nil {
			status = "failed"
			msg := "managed agent result parse failed: " + err.Error()
			errMsg = &msg
		} else {
			selected := []string{}
			if run.InputRef != nil {
				if rawIDs, ok := run.InputRef["session_ids"].([]any); ok {
					for _, rawID := range rawIDs {
						if id, ok := rawID.(string); ok {
							selected = append(selected, id)
						}
					}
				}
			}
			tasks, _ := loadDraftTaskCandidates(h.db, run.UserID)
			sessions, _ := loadDraftSessions(h.db, run.UserID, selected)
			normalized := service.NormalizeDraftResponse(parsed, orderDraftSessions(sessions, selected), tasks, true)
			normalized.ManagedAgentRunID = run.ID
			normalized.AgentID = run.AgentID
			normalized.AgentVersionID = run.AgentVersionID
			if run.ModelID != nil {
				normalized.ModelID = *run.ModelID
			} else {
				normalized.ModelID = task.ModelID
			}
			normalized.Status = status
			draft = &normalized
			output["draft"] = normalized
		}
	} else if status == "failed" && task.Error != "" {
		errMsg = &task.Error
	}

	outputJSON, _ := json.Marshal(output)
	sets := []string{"status = $1", "output_ref_json = $2", "agent_version_id = $3"}
	args := []any{status, outputJSON, nullableInt(task.AgentVersionID)}
	argIdx := 4
	if task.ModelID != "" {
		sets = append(sets, fmt.Sprintf("model_id = $%d", argIdx))
		args = append(args, task.ModelID)
		argIdx++
	}
	if errMsg != nil {
		sets = append(sets, fmt.Sprintf("error_message = $%d", argIdx))
		args = append(args, *errMsg)
		argIdx++
	}
	if isTerminalManagedStatus(status) {
		sets = append(sets, "finished_at = now()")
	}
	args = append(args, run.ID)
	if _, err := h.db.Exec(fmt.Sprintf("UPDATE ai_runs SET %s WHERE id = $%d", joinWithCommas(sets), argIdx), args...); err != nil {
		return nil, err
	}

	refreshed, err := h.loadAIRun(run.ID, run.UserID)
	if err != nil {
		return nil, err
	}
	refreshed.Draft = draft
	return refreshed, nil
}

// insertAIRun persists a freshly submitted managed-agent task as an ai_runs row
// and returns the new run id. Shared by the manual-agent and daily-report runs.
func (h *ManagedAgentHandler) insertAIRun(userID, businessType, agentID string, submit *service.SubmitManagedTaskResponse, modelID string, inputRef map[string]any) (string, error) {
	inputJSON, _ := json.Marshal(inputRef)
	var runID string
	err := h.db.QueryRow(`
		INSERT INTO ai_runs (
			user_id, business_type, runtime_type, agent_id, external_task_id,
			model_id, status, input_ref_json, started_at
		)
		VALUES ($1, $2, 'managed_task', $3, $4, $5, $6, $7, now())
		RETURNING id::text`,
		userID, businessType, agentID, submit.TaskID, nullableString(modelID), normalizeManagedRunStatus(submit.Status), inputJSON,
	).Scan(&runID)
	return runID, err
}

const aiRunSelectColumns = `SELECT id::text, user_id::text, business_type, business_id::text, runtime_type,
			agent_id, agent_version_id, external_task_id, external_session_id, model_id,
			status, input_ref_json, output_ref_json, error_message, started_at, finished_at, created_at
		FROM ai_runs`

// scanAIRun scans one ai_runs row (from *sql.Row or *sql.Rows) into a model.AIRun.
// Shared by loadAIRun (point lookup) and ListAgentRuns (batch) so the column
// list and the scan cannot drift apart.
func scanAIRun(row rowScanner) (*model.AIRun, error) {
	var run model.AIRun
	var businessID, externalTaskID, externalSessionID, modelID, errMsg sql.NullString
	var agentVersionID sql.NullInt64
	var startedAt, finishedAt sql.NullTime
	var inputRaw, outputRaw []byte
	if err := row.Scan(
		&run.ID, &run.UserID, &run.BusinessType, &businessID, &run.RuntimeType,
		&run.AgentID, &agentVersionID, &externalTaskID, &externalSessionID, &modelID,
		&run.Status, &inputRaw, &outputRaw, &errMsg, &startedAt, &finishedAt, &run.CreatedAt,
	); err != nil {
		return nil, err
	}
	run.BusinessID = nullStringPtr(businessID)
	run.ExternalTaskID = nullStringPtr(externalTaskID)
	run.ExternalSessionID = nullStringPtr(externalSessionID)
	run.ModelID = nullStringPtr(modelID)
	run.ErrorMessage = nullStringPtr(errMsg)
	if agentVersionID.Valid {
		v := int(agentVersionID.Int64)
		run.AgentVersionID = &v
	}
	if startedAt.Valid {
		run.StartedAt = &startedAt.Time
	}
	if finishedAt.Valid {
		run.FinishedAt = &finishedAt.Time
	}
	_ = json.Unmarshal(inputRaw, &run.InputRef)
	_ = json.Unmarshal(outputRaw, &run.OutputRef)
	if result, ok := run.OutputRef["result"].(string); ok {
		run.Result = result
	}
	if draftRaw, ok := run.OutputRef["draft"]; ok {
		if b, err := json.Marshal(draftRaw); err == nil {
			var draft model.GenerateReportDraftResponse
			if json.Unmarshal(b, &draft) == nil && draft.ReportMarkdown != "" {
				run.Draft = &draft
			}
		}
	}
	return &run, nil
}

func (h *ManagedAgentHandler) loadAIRun(runID, userID string) (*model.AIRun, error) {
	return scanAIRun(h.db.QueryRow(aiRunSelectColumns+" WHERE id = $1 AND user_id = $2", runID, userID))
}

const managedAgentScheduleSelectColumns = `SELECT id::text, user_id::text, name, agent_id, model_id, message,
			params_json, schedule_type, weekdays_json, time_of_day, timezone, enabled,
			last_run_at, last_ai_run_id::text, created_at, updated_at
		FROM managed_agent_schedules`

type normalizedManagedAgentScheduleRequest struct {
	Name         string
	AgentID      string
	ModelID      string
	Message      string
	Params       map[string]string
	ScheduleType string
	Weekdays     []int
	TimeOfDay    string
	Timezone     string
	Enabled      bool
}

func normalizeManagedAgentScheduleRequest(req model.UpsertManagedAgentScheduleRequest) (normalizedManagedAgentScheduleRequest, error) {
	normalized := normalizedManagedAgentScheduleRequest{
		Name:         strings.TrimSpace(req.Name),
		AgentID:      strings.TrimSpace(req.AgentID),
		ModelID:      strings.TrimSpace(req.ModelID),
		Message:      strings.TrimSpace(req.Message),
		ScheduleType: strings.TrimSpace(req.ScheduleType),
		TimeOfDay:    strings.TrimSpace(req.TimeOfDay),
		Timezone:     strings.TrimSpace(req.Timezone),
		Enabled:      true,
		Params:       map[string]string{},
	}
	if req.Enabled != nil {
		normalized.Enabled = *req.Enabled
	}
	if normalized.ScheduleType == "" {
		normalized.ScheduleType = "daily"
	}
	if normalized.Timezone == "" {
		normalized.Timezone = "Asia/Shanghai"
	}
	for key, value := range req.Params {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		normalized.Params[key] = strings.TrimSpace(value)
	}

	if normalized.Name == "" {
		return normalized, fmt.Errorf("name is required")
	}
	if normalized.AgentID == "" {
		return normalized, fmt.Errorf("agent_id is required")
	}
	if normalized.Message == "" {
		return normalized, fmt.Errorf("message is required")
	}
	if _, err := time.Parse("15:04", normalized.TimeOfDay); err != nil {
		return normalized, fmt.Errorf("time_of_day must use HH:mm")
	}
	if _, err := time.LoadLocation(normalized.Timezone); err != nil {
		return normalized, fmt.Errorf("timezone is invalid")
	}

	switch normalized.ScheduleType {
	case "daily":
		normalized.Weekdays = []int{}
	case "weekly":
		seen := map[int]bool{}
		for _, weekday := range req.Weekdays {
			if weekday < 1 || weekday > 7 {
				return normalized, fmt.Errorf("weekdays must be between 1 and 7")
			}
			if !seen[weekday] {
				normalized.Weekdays = append(normalized.Weekdays, weekday)
				seen[weekday] = true
			}
		}
		if len(normalized.Weekdays) == 0 {
			return normalized, fmt.Errorf("weekdays is required for weekly schedules")
		}
	default:
		return normalized, fmt.Errorf("schedule_type must be daily or weekly")
	}
	return normalized, nil
}

func scanManagedAgentSchedule(row rowScanner) (model.ManagedAgentSchedule, error) {
	var schedule model.ManagedAgentSchedule
	var modelID, lastRunID sql.NullString
	var paramsRaw, weekdaysRaw []byte
	var lastRunAt sql.NullTime
	if err := row.Scan(
		&schedule.ID, &schedule.UserID, &schedule.Name, &schedule.AgentID, &modelID,
		&schedule.Message, &paramsRaw, &schedule.ScheduleType, &weekdaysRaw,
		&schedule.TimeOfDay, &schedule.Timezone, &schedule.Enabled, &lastRunAt,
		&lastRunID, &schedule.CreatedAt, &schedule.UpdatedAt,
	); err != nil {
		return schedule, err
	}
	schedule.ModelID = nullStringPtr(modelID)
	schedule.LastAIRunID = nullStringPtr(lastRunID)
	if lastRunAt.Valid {
		schedule.LastRunAt = &lastRunAt.Time
	}
	_ = json.Unmarshal(paramsRaw, &schedule.Params)
	_ = json.Unmarshal(weekdaysRaw, &schedule.Weekdays)
	if schedule.Params == nil {
		schedule.Params = map[string]string{}
	}
	return schedule, nil
}

func (h *ManagedAgentHandler) loadManagedAgentSchedule(scheduleID, userID string) (model.ManagedAgentSchedule, error) {
	return scanManagedAgentSchedule(h.db.QueryRow(managedAgentScheduleSelectColumns+" WHERE id = $1 AND user_id = $2", scheduleID, userID))
}

func normalizeManagedRunStatus(status string) string {
	switch strings.ToLower(status) {
	case "completed", "complete", "done", "success", "succeeded":
		return "succeeded"
	case "failed", "error", "cancelled", "canceled":
		return "failed"
	case "timeout", "timed_out":
		return "timeout"
	case "running", "in_progress", "processing":
		return "running"
	default:
		return "pending"
	}
}

func isTerminalManagedStatus(status string) bool {
	return status == "succeeded" || status == "failed" || status == "timeout"
}

func nullableString(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func nullableInt(v int) any {
	if v == 0 {
		return nil
	}
	return v
}

func absoluteRequestURL(r *http.Request, path string) string {
	proto := r.Header.Get("X-Forwarded-Proto")
	if proto == "" {
		proto = "http"
		if r.TLS != nil {
			proto = "https"
		}
	}
	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}
	return proto + "://" + host + path
}

func dailyReportSessionLogURLs(r *http.Request, sessions []model.ReportDraftSession) []string {
	urls := make([]string, 0, len(sessions))
	for _, session := range sessions {
		urls = append(urls, absoluteRequestURL(r, "/api/v1/sessions/"+url.PathEscape(session.ID)+"/log"))
	}
	return urls
}
