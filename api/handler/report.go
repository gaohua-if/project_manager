package handler

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
)

type ReportHandler struct {
	db                 *sql.DB
	reportGeneratorURL string
}

func NewReportHandler(db *sql.DB, reportGeneratorURL string) *ReportHandler {
	return &ReportHandler{db: db, reportGeneratorURL: reportGeneratorURL}
}

func (h *ReportHandler) List(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	query := reportSelectColumns + " WHERE 1=1"
	args := []any{}
	argIdx := 1

	if u.Role == "employee" {
		query += fmt.Sprintf(" AND dr.user_id = $%d", argIdx)
		args = append(args, u.ID)
		argIdx++
	} else if (u.Role == "team_leader" || u.Role == "pm") && u.TeamID != nil {
		query += fmt.Sprintf(" AND dr.user_id IN (SELECT id FROM users WHERE team_id = $%d)", argIdx)
		args = append(args, *u.TeamID)
		argIdx++
	}

	if from := r.URL.Query().Get("from"); from != "" {
		query += fmt.Sprintf(" AND dr.report_date >= $%d", argIdx)
		args = append(args, from)
		argIdx++
	}
	if to := r.URL.Query().Get("to"); to != "" {
		query += fmt.Sprintf(" AND dr.report_date <= $%d", argIdx)
		args = append(args, to)
		argIdx++
	}

	query += " ORDER BY dr.report_date DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	reports := []model.DailyReport{}
	for rows.Next() {
		dr, err := scanDailyReport(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		reports = append(reports, dr)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, reports)
}

func (h *ReportHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	dr, err := scanDailyReport(h.db.QueryRow(reportSelectColumns+" WHERE dr.id = $1", id))
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, dr)
}

func (h *ReportHandler) GetOrCreateToday(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	today := time.Now().Format("2006-01-02")

	dr, err := scanDailyReport(h.db.QueryRow(reportSelectColumns+" WHERE dr.user_id = $1 AND dr.report_date = $2", u.ID, today))
	if err == sql.ErrNoRows {
		content := h.generateReportContent(u.ID, today)
		var reportID string
		if err := h.db.QueryRow(`
			INSERT INTO daily_reports (user_id, report_date, content)
			VALUES ($1, $2, $3) RETURNING id`, u.ID, today, content).Scan(&reportID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		dr = model.DailyReport{
			ID:         reportID,
			UserID:     u.ID,
			UserName:   u.Name,
			ReportDate: today,
			Content:    content,
		}
	} else if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, dr)
}

func (h *ReportHandler) GenerateToday(w http.ResponseWriter, r *http.Request) {
	if h.reportGeneratorURL == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "report generator is not configured"})
		return
	}

	u := getUser(r)
	today := time.Now().Format("2006-01-02")

	body, _ := json.Marshal(map[string]string{
		"user_id":     u.ID,
		"report_date": today,
	})
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, h.reportGeneratorURL+"/reports/generate", bytes.NewReader(body))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "report generator request failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("report generator returned HTTP %d: %s", resp.StatusCode, truncateForError(string(respBody), 200))})
		return
	}

	dr, err := h.getReportByUserDate(u.ID, today)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, dr)
}

func (h *ReportHandler) GenerateTodayDraft(w http.ResponseWriter, r *http.Request) {
	var req model.GenerateReportDraftRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	sessionIDs := uniqueStringsPreserveOrder(req.SessionIDs)
	if len(sessionIDs) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "session_ids is required"})
		return
	}
	if err := service.ValidateDraftSkillID(req.SkillID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if h.reportGeneratorURL == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "report generator is not configured"})
		return
	}

	u := getUser(r)
	reportDate := req.ReportDate
	if reportDate == "" {
		reportDate = service.TodayInLocalDate()
	}
	skillID := req.SkillID
	if skillID == "" {
		skillID = service.DefaultDailyReportSkillID
	}

	sessions, err := loadDraftSessions(h.db, u.ID, sessionIDs)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if len(sessions) != len(sessionIDs) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "one or more sessions are not accessible"})
		return
	}

	tasks, err := loadDraftTaskCandidates(h.db, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	generatorReq := model.ReportDraftGeneratorRequest{
		UserID:              u.ID,
		UserName:            u.Name,
		ReportDate:          reportDate,
		Sessions:            orderDraftSessions(sessions, sessionIDs),
		TaskCandidates:      tasks,
		SkillID:             skillID,
		SkillContent:        req.SkillContent,
		IncludeTaskProgress: req.IncludeTaskProgress,
	}

	body, _ := json.Marshal(generatorReq)
	httpReq, err := http.NewRequestWithContext(r.Context(), http.MethodPost, h.reportGeneratorURL+"/reports/draft", bytes.NewReader(body))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "report generator request failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("report generator returned HTTP %d: %s", resp.StatusCode, truncateForError(string(respBody), 300))})
		return
	}

	var draftResp model.GenerateReportDraftResponse
	if err := json.Unmarshal(respBody, &draftResp); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "report generator returned invalid response"})
		return
	}
	if draftResp.ReportMarkdown == "" {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "report generator returned empty report_markdown"})
		return
	}

	draftResp = service.NormalizeDraftResponse(draftResp, generatorReq.Sessions, tasks, req.IncludeTaskProgress)
	writeJSON(w, http.StatusOK, draftResp)
}

func loadDraftSessions(db *sql.DB, userID string, sessionIDs []string) ([]model.ReportDraftSession, error) {
	rows, err := db.Query(`
		SELECT s.id::text, s.session_ref, s.agent_type, s.started_at, s.ended_at, s.duration_secs,
			COALESCE(s.model, ''), COALESCE(s.summary, ''), COALESCE(s.tool_calls_json::text, '{}'),
			s.task_id::text, COALESCE(t.title, ''), s.requirement_id::text, COALESCE(r.title, ''),
			COALESCE(tu.input_tokens, 0), COALESCE(tu.output_tokens, 0), COALESCE(tu.total_tokens, 0)
		FROM sessions s
		LEFT JOIN tasks t ON t.id = s.task_id
		LEFT JOIN requirements r ON r.id = s.requirement_id
		LEFT JOIN (
			SELECT session_id, SUM(input_tokens) input_tokens, SUM(output_tokens) output_tokens, SUM(total_tokens) total_tokens
			FROM token_usage
			GROUP BY session_id
		) tu ON tu.session_id = s.id
		WHERE s.user_id = $1 AND s.id::text = ANY($2)
		ORDER BY s.started_at`, userID, pq.Array(sessionIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := []model.ReportDraftSession{}
	for rows.Next() {
		var s model.ReportDraftSession
		var endedAt sql.NullTime
		var durationSecs sql.NullInt64
		var toolCallsRaw string
		var taskID, requirementID sql.NullString
		if err := rows.Scan(&s.ID, &s.SessionRef, &s.AgentType, &s.StartedAt, &endedAt, &durationSecs,
			&s.Model, &s.Summary, &toolCallsRaw,
			&taskID, &s.TaskTitle, &requirementID, &s.RequirementTitle,
			&s.InputTokens, &s.OutputTokens, &s.TotalTokens); err != nil {
			return nil, err
		}
		if endedAt.Valid {
			s.EndedAt = &endedAt.Time
		}
		if durationSecs.Valid {
			v := int(durationSecs.Int64)
			s.DurationSecs = &v
		}
		if toolCallsRaw != "" {
			_ = json.Unmarshal([]byte(toolCallsRaw), &s.ToolCallsJSON)
		}
		s.TaskID = nullStringPtr(taskID)
		s.RequirementID = nullStringPtr(requirementID)
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

func loadDraftTaskCandidates(db *sql.DB, userID string) ([]model.ReportDraftTaskCandidate, error) {
	rows, err := db.Query(`
		SELECT t.id::text, t.title, r.id::text, r.title, t.status, t.progress, COALESCE(u.name, '')
		FROM tasks t
		JOIN requirements r ON r.id = t.requirement_id
		LEFT JOIN users u ON u.id = t.assignee_id
		WHERE t.assignee_id = $1 AND t.status IN ('todo', 'in_progress')
		ORDER BY t.updated_at DESC, t.created_at DESC
		LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := []model.ReportDraftTaskCandidate{}
	for rows.Next() {
		var task model.ReportDraftTaskCandidate
		if err := rows.Scan(&task.TaskID, &task.TaskTitle, &task.RequirementID, &task.RequirementTitle,
			&task.CurrentStatus, &task.CurrentProgress, &task.Owner); err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (h *ReportHandler) getReportByUserDate(userID, reportDate string) (*model.DailyReport, error) {
	dr, err := scanDailyReport(h.db.QueryRow(reportSelectColumns+" WHERE dr.user_id = $1 AND dr.report_date = $2", userID, reportDate))
	if err != nil {
		return nil, err
	}
	return &dr, nil
}

func (h *ReportHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	u := getUser(r)
	var req model.UpdateReportRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if req.SessionIDs != nil {
		sessionIDs := uniqueStringsPreserveOrder(*req.SessionIDs)
		if err := h.validateReportSessionIDs(u.ID, sessionIDs); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
			return
		}
		req.SessionIDs = &sessionIDs
	}
	var runMeta *reportRunMeta
	if req.ManagedAgentRunID != nil && *req.ManagedAgentRunID != "" {
		meta, err := h.loadReportRunMeta(u.ID, *req.ManagedAgentRunID)
		if err != nil {
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "managed agent run is not accessible"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		runMeta = meta
	}

	sets := []string{"updated_at = now()"}
	args := []any{}
	argIdx := 1

	if req.Content != nil {
		sets = append(sets, fmt.Sprintf("content = $%d, edited = true", argIdx))
		args = append(args, *req.Content)
		argIdx++
	}
	if req.FeishuDocURL != nil {
		sets = append(sets, fmt.Sprintf("feishu_doc_url = $%d", argIdx))
		args = append(args, *req.FeishuDocURL)
		argIdx++
	}
	if req.SessionIDs != nil {
		sets = append(sets, fmt.Sprintf("session_ids = $%d", argIdx))
		args = append(args, pq.Array(*req.SessionIDs))
		argIdx++
	}
	if runMeta != nil {
		sets = append(sets, "generation_mode = 'managed_agent'")
		sets = append(sets, fmt.Sprintf("managed_agent_run_id = $%d", argIdx))
		args = append(args, runMeta.RunID)
		argIdx++
		sets = append(sets, fmt.Sprintf("agent_id = $%d", argIdx))
		args = append(args, runMeta.AgentID)
		argIdx++
		if runMeta.AgentVersionID != nil {
			sets = append(sets, fmt.Sprintf("agent_version_id = $%d", argIdx))
			args = append(args, *runMeta.AgentVersionID)
			argIdx++
		}
		if runMeta.ModelID != nil {
			sets = append(sets, fmt.Sprintf("model_id = $%d", argIdx))
			args = append(args, *runMeta.ModelID)
			argIdx++
		}
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE daily_reports SET %s WHERE id = $%d", joinWithCommas(sets), argIdx)

	res, err := h.db.Exec(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if runMeta != nil {
		_, _ = h.db.Exec(`UPDATE ai_runs SET business_id = $1 WHERE id = $2 AND user_id = $3`, id, runMeta.RunID, u.ID)
	}

	h.Get(w, r)
}

type reportRunMeta struct {
	RunID          string
	AgentID        string
	AgentVersionID *int
	ModelID        *string
}

func (h *ReportHandler) loadReportRunMeta(userID, runID string) (*reportRunMeta, error) {
	var meta reportRunMeta
	var agentVersionID sql.NullInt64
	var modelID sql.NullString
	err := h.db.QueryRow(`
		SELECT id::text, agent_id, agent_version_id, model_id
		FROM ai_runs
		WHERE id = $1 AND user_id = $2 AND business_type = 'daily_report' AND status = 'succeeded'`,
		runID, userID).Scan(&meta.RunID, &meta.AgentID, &agentVersionID, &modelID)
	if err != nil {
		return nil, err
	}
	if agentVersionID.Valid {
		v := int(agentVersionID.Int64)
		meta.AgentVersionID = &v
	}
	meta.ModelID = nullStringPtr(modelID)
	return &meta, nil
}

func (h *ReportHandler) validateReportSessionIDs(userID string, sessionIDs []string) error {
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

func (h *ReportHandler) generateReportContent(userID, date string) string {
	rows, err := h.db.Query(`
		SELECT s.session_ref, s.started_at, s.ended_at, s.model, s.summary,
			s.task_id, COALESCE(t.title,'')
		FROM sessions s
		LEFT JOIN tasks t ON t.id = s.task_id
		WHERE s.user_id = $1 AND DATE(s.started_at) = $2
		ORDER BY s.started_at`, userID, date)
	if err != nil {
		return fmt.Sprintf("# 日报 %s\n\n暂无 session 数据。", date)
	}
	defer rows.Close()

	content := fmt.Sprintf("# 日报 %s\n\n## 今日 Session\n\n", date)
	count := 0
	for rows.Next() {
		var ref, model string
		var startedAt, endedAt sql.NullString
		var summary, taskID, taskTitle sql.NullString
		rows.Scan(&ref, &startedAt, &endedAt, &model, &summary, &taskID, &taskTitle)
		count++
		taskInfo := ""
		if taskTitle.Valid && taskTitle.String != "" {
			taskInfo = fmt.Sprintf(" [%s]", taskTitle.String)
		}
		summaryText := "无摘要"
		if summary.Valid && summary.String != "" {
			summaryText = summary.String
		}
		content += fmt.Sprintf("%d. `%s` (%s)%s - %s\n", count, ref[:12], model, taskInfo, summaryText)
	}

	if count == 0 {
		content += "暂无 session 数据。\n"
	}

	var totalTokens int64
	h.db.QueryRow(`
		SELECT COALESCE(SUM(total_tokens), 0) FROM token_usage
		WHERE user_id = $1 AND DATE(recorded_at) = $2`, userID, date).Scan(&totalTokens)

	content += fmt.Sprintf("\n## Token 消耗\n\n今日合计: %d tokens\n", totalTokens)
	return content
}

func (h *ReportHandler) ListTeamMemberReports(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	if u.Role != "team_leader" && u.Role != "pm" && u.Role != "director" && u.Role != "admin" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "access denied"})
		return
	}

	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	teamID := u.TeamID
	if u.Role == "director" || u.Role == "admin" {
		if tid := r.URL.Query().Get("team_id"); tid != "" {
			teamID = &tid
		}
	}
	if teamID == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no team specified"})
		return
	}

	rows, err := h.db.Query(`
		SELECT u.id, u.name,
			dr.id, dr.content,
			CASE WHEN dr.id IS NOT NULL THEN true ELSE false END
		FROM users u
		LEFT JOIN daily_reports dr ON dr.user_id = u.id AND dr.report_date = $1
		WHERE u.team_id = $2 AND u.role = 'employee'
		ORDER BY u.name`, date, *teamID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	reports := []model.TeamMemberReport{}
	for rows.Next() {
		var tmr model.TeamMemberReport
		var reportID, content sql.NullString
		rows.Scan(&tmr.UserID, &tmr.UserName, &reportID, &content, &tmr.HasReport)
		tmr.ReportID = nullStringPtr(reportID)
		if content.Valid {
			tmr.Content = content.String
		}
		reports = append(reports, tmr)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, reports)
}

func (h *ReportHandler) GetTeamReportToday(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	if u.TeamID == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no team"})
		return
	}
	today := time.Now().Format("2006-01-02")
	tr, err := h.getTeamReportByTeamDate(*u.TeamID, today)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusOK, tr)
}

func (h *ReportHandler) GenerateTeamReport(w http.ResponseWriter, r *http.Request) {
	if h.reportGeneratorURL == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "report generator is not configured"})
		return
	}

	u := getUser(r)
	if u.Role != "team_leader" || u.TeamID == nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only team leaders can generate team reports"})
		return
	}
	today := time.Now().Format("2006-01-02")

	body, _ := json.Marshal(map[string]string{
		"team_id":     *u.TeamID,
		"leader_id":   u.ID,
		"report_date": today,
	})
	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, h.reportGeneratorURL+"/reports/team/generate", bytes.NewReader(body))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "report generator request failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": fmt.Sprintf("report generator returned HTTP %d: %s", resp.StatusCode, truncateForError(string(respBody), 200))})
		return
	}

	var genResp struct {
		ReportID string `json:"report_id"`
	}
	if err := json.Unmarshal(respBody, &genResp); err != nil || genResp.ReportID == "" {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "report generator returned invalid response"})
		return
	}

	tr, err := h.getTeamReportByID(genResp.ReportID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, tr)
}

func (h *ReportHandler) ListTeamReports(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	if u.Role != "team_leader" && u.Role != "pm" && u.Role != "director" && u.Role != "admin" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "access denied"})
		return
	}

	query := `
		SELECT tr.id, tr.team_id, t.name, tr.leader_id, u.name,
			tr.report_date, tr.content, tr.feishu_doc_url,
			tr.member_report_ids, tr.session_ids, tr.created_at, tr.updated_at
		FROM team_reports tr
		JOIN teams t ON t.id = tr.team_id
		JOIN users u ON u.id = tr.leader_id
		WHERE 1=1`
	args := []any{}
	argIdx := 1

	if u.Role == "team_leader" || u.Role == "pm" {
		if u.TeamID == nil {
			writeJSON(w, http.StatusOK, []model.TeamReport{})
			return
		}
		query += fmt.Sprintf(" AND tr.team_id = $%d", argIdx)
		args = append(args, *u.TeamID)
		argIdx++
	}

	if from := r.URL.Query().Get("from"); from != "" {
		query += fmt.Sprintf(" AND tr.report_date >= $%d", argIdx)
		args = append(args, from)
		argIdx++
	}
	if to := r.URL.Query().Get("to"); to != "" {
		query += fmt.Sprintf(" AND tr.report_date <= $%d", argIdx)
		args = append(args, to)
		argIdx++
	}

	query += " ORDER BY tr.report_date DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	reports := []model.TeamReport{}
	for rows.Next() {
		var tr model.TeamReport
		var feishuURL sql.NullString
		var memberIDsStr, sessionIDsStr string
		rows.Scan(&tr.ID, &tr.TeamID, &tr.TeamName, &tr.LeaderID, &tr.LeaderName,
			&tr.ReportDate, &tr.Content, &feishuURL,
			&memberIDsStr, &sessionIDsStr, &tr.CreatedAt, &tr.UpdatedAt)
		tr.FeishuDocURL = nullStringPtr(feishuURL)
		tr.MemberReportIDs = parseUUIDArray(memberIDsStr)
		tr.SessionIDs = parseUUIDArray(sessionIDsStr)
		reports = append(reports, tr)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, reports)
}

func (h *ReportHandler) UpdateTeamReport(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	u := getUser(r)
	if u.Role != "team_leader" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only team leaders can update team reports"})
		return
	}

	var req model.UpdateTeamReportRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	sets := []string{"updated_at = now()"}
	args := []any{}
	argIdx := 1

	if req.Content != nil {
		sets = append(sets, fmt.Sprintf("content = $%d", argIdx))
		args = append(args, *req.Content)
		argIdx++
	}
	if req.FeishuDocURL != nil {
		sets = append(sets, fmt.Sprintf("feishu_doc_url = $%d", argIdx))
		args = append(args, *req.FeishuDocURL)
		argIdx++
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE team_reports SET %s WHERE id = $%d", joinWithCommas(sets), argIdx)

	res, err := h.db.Exec(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	tr, err := h.getTeamReportByID(id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, tr)
}

func (h *ReportHandler) getTeamReportByTeamDate(teamID, reportDate string) (*model.TeamReport, error) {
	var tr model.TeamReport
	var feishuURL sql.NullString
	var memberIDsStr, sessionIDsStr string
	err := h.db.QueryRow(`
		SELECT tr.id, tr.team_id, t.name, tr.leader_id, u.name,
			tr.report_date, tr.content, tr.feishu_doc_url,
			tr.member_report_ids, tr.session_ids, tr.created_at, tr.updated_at
		FROM team_reports tr
		JOIN teams t ON t.id = tr.team_id
		JOIN users u ON u.id = tr.leader_id
		WHERE tr.team_id = $1 AND tr.report_date = $2`, teamID, reportDate).Scan(
		&tr.ID, &tr.TeamID, &tr.TeamName, &tr.LeaderID, &tr.LeaderName,
		&tr.ReportDate, &tr.Content, &feishuURL,
		&memberIDsStr, &sessionIDsStr, &tr.CreatedAt, &tr.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	tr.FeishuDocURL = nullStringPtr(feishuURL)
	tr.MemberReportIDs = parseUUIDArray(memberIDsStr)
	tr.SessionIDs = parseUUIDArray(sessionIDsStr)
	return &tr, nil
}

func (h *ReportHandler) getTeamReportByID(id string) (*model.TeamReport, error) {
	var tr model.TeamReport
	var feishuURL sql.NullString
	var memberIDsStr, sessionIDsStr string
	err := h.db.QueryRow(`
		SELECT tr.id, tr.team_id, t.name, tr.leader_id, u.name,
			tr.report_date, tr.content, tr.feishu_doc_url,
			tr.member_report_ids, tr.session_ids, tr.created_at, tr.updated_at
		FROM team_reports tr
		JOIN teams t ON t.id = tr.team_id
		JOIN users u ON u.id = tr.leader_id
		WHERE tr.id = $1`, id).Scan(
		&tr.ID, &tr.TeamID, &tr.TeamName, &tr.LeaderID, &tr.LeaderName,
		&tr.ReportDate, &tr.Content, &feishuURL,
		&memberIDsStr, &sessionIDsStr, &tr.CreatedAt, &tr.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	tr.FeishuDocURL = nullStringPtr(feishuURL)
	tr.MemberReportIDs = parseUUIDArray(memberIDsStr)
	tr.SessionIDs = parseUUIDArray(sessionIDsStr)
	return &tr, nil
}

func parseUUIDArray(pgArray string) []string {
	return parseTextArray(pgArray)
}

// reportSelectColumns is the shared column list + FROM/JOIN for daily_reports.
// Every daily-report read path uses it so the SELECT and the scan in
// scanDailyReport cannot drift apart when a column is added.
const reportSelectColumns = `SELECT dr.id, dr.user_id, u.name, dr.report_date, dr.content, dr.edited,
			dr.feishu_doc_url, dr.session_ids, dr.generation_mode, dr.managed_agent_run_id::text,
			dr.agent_id, dr.agent_version_id, dr.model_id, dr.created_at, dr.updated_at
		FROM daily_reports dr
		JOIN users u ON u.id = dr.user_id`

// scanDailyReport scans one daily_reports row (from *sql.Row or *sql.Rows) into
// a model.DailyReport, normalizing the nullable/encoded columns.
func scanDailyReport(row rowScanner) (model.DailyReport, error) {
	var dr model.DailyReport
	var feishuURL sql.NullString
	var sessionIDsStr string
	var managedRunID, agentID, modelID sql.NullString
	var agentVersionID sql.NullInt64
	if err := row.Scan(&dr.ID, &dr.UserID, &dr.UserName, &dr.ReportDate, &dr.Content, &dr.Edited,
		&feishuURL, &sessionIDsStr, &dr.GenerationMode, &managedRunID,
		&agentID, &agentVersionID, &modelID, &dr.CreatedAt, &dr.UpdatedAt); err != nil {
		return dr, err
	}
	dr.FeishuDocURL = nullStringPtr(feishuURL)
	dr.SessionIDs = parseUUIDArray(sessionIDsStr)
	dr.ManagedAgentRunID = nullStringPtr(managedRunID)
	dr.AgentID = nullStringPtr(agentID)
	dr.ModelID = nullStringPtr(modelID)
	if agentVersionID.Valid {
		v := int(agentVersionID.Int64)
		dr.AgentVersionID = &v
	}
	return dr, nil
}

func joinWithCommas(items []string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += ", "
		}
		result += item
	}
	return result
}

func uniqueStringsPreserveOrder(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func orderDraftSessions(sessions []model.ReportDraftSession, orderedIDs []string) []model.ReportDraftSession {
	byID := make(map[string]model.ReportDraftSession, len(sessions))
	for _, session := range sessions {
		byID[session.ID] = session
	}
	ordered := make([]model.ReportDraftSession, 0, len(sessions))
	for _, id := range orderedIDs {
		if session, ok := byID[id]; ok {
			ordered = append(ordered, session)
		}
	}
	return ordered
}
