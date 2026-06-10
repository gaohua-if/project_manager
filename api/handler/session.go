package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/aidashboard/api/model"
	"github.com/go-chi/chi/v5"
)

type SessionHandler struct {
	db *sql.DB
}

func NewSessionHandler(db *sql.DB) *SessionHandler {
	return &SessionHandler{db: db}
}

func (h *SessionHandler) List(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	query := `
		SELECT s.id, s.session_ref, s.user_id, s.agent_type, s.started_at, s.ended_at,
			s.duration_secs, s.model, s.summary, s.tool_calls_json, s.git_commits,
			s.task_id, COALESCE(t.title,''), s.requirement_id, s.match_confidence,
			s.raw_log_url, s.uploaded_at
		FROM sessions s
		LEFT JOIN tasks t ON t.id = s.task_id
		WHERE 1=1`
	args := []any{}
	argIdx := 1

	if date := r.URL.Query().Get("date"); date != "" {
		query += fmt.Sprintf(" AND DATE(s.started_at) = $%d", argIdx)
		args = append(args, date)
		argIdx++
	}

	switch u.Role {
	case "employee":
		query += fmt.Sprintf(" AND s.user_id = $%d", argIdx)
		args = append(args, u.ID)
		argIdx++
	case "team_leader":
		if u.TeamID != nil {
			query += fmt.Sprintf(" AND s.user_id IN (SELECT id FROM users WHERE team_id = $%d)", argIdx)
			args = append(args, *u.TeamID)
			argIdx++
		}
	}

	query += " ORDER BY s.started_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	var sessions []model.Session
	for rows.Next() {
		var s model.Session
		var endedAt, rawLogURL sql.NullString
		var durationSecs sql.NullInt64
		var summary sql.NullString
		var taskID, reqID sql.NullString
		var taskTitle sql.NullString
		var confidence sql.NullFloat64
		var toolCallsJSON []byte
		var gitCommits string

		rows.Scan(&s.ID, &s.SessionRef, &s.UserID, &s.AgentType, &s.StartedAt, &endedAt,
			&durationSecs, &s.Model, &summary, &toolCallsJSON, &gitCommits,
			&taskID, &taskTitle, &reqID, &confidence,
			&rawLogURL, &s.UploadedAt)

		if endedAt.Valid {
			s.EndedAt = parseTimePtr(endedAt.String)
		}
		if durationSecs.Valid {
			ds := int(durationSecs.Int64)
			s.DurationSecs = &ds
		}
		s.Summary = nullStringPtr(summary)
		if len(toolCallsJSON) > 0 {
			json.Unmarshal(toolCallsJSON, &s.ToolCallsJSON)
		}
		s.TaskID = nullStringPtr(taskID)
		s.TaskTitle = nullStringPtr(taskTitle)
		s.RequirementID = nullStringPtr(reqID)
		if confidence.Valid {
			s.MatchConfidence = &confidence.Float64
		}
		sessions = append(sessions, s)
	}

	writeJSON(w, http.StatusOK, sessions)
}

func (h *SessionHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var s model.Session
	var endedAt, rawLogURL sql.NullString
	var durationSecs sql.NullInt64
	var summary sql.NullString
	var taskID, reqID sql.NullString
	var taskTitle sql.NullString
	var confidence sql.NullFloat64
	var toolCallsJSON []byte
	var gitCommits string

	err := h.db.QueryRow(`
		SELECT s.id, s.session_ref, s.user_id, s.agent_type, s.started_at, s.ended_at,
			s.duration_secs, s.model, s.summary, s.tool_calls_json, s.git_commits,
			s.task_id, COALESCE(t.title,''), s.requirement_id, s.match_confidence,
			s.raw_log_url, s.uploaded_at
		FROM sessions s
		LEFT JOIN tasks t ON t.id = s.task_id
		WHERE s.id = $1`, id).Scan(
		&s.ID, &s.SessionRef, &s.UserID, &s.AgentType, &s.StartedAt, &endedAt,
		&durationSecs, &s.Model, &summary, &toolCallsJSON, &gitCommits,
		&taskID, &taskTitle, &reqID, &confidence,
		&rawLogURL, &s.UploadedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	if endedAt.Valid {
		s.EndedAt = parseTimePtr(endedAt.String)
	}
	if durationSecs.Valid {
		ds := int(durationSecs.Int64)
		s.DurationSecs = &ds
	}
	s.Summary = nullStringPtr(summary)
	if len(toolCallsJSON) > 0 {
		json.Unmarshal(toolCallsJSON, &s.ToolCallsJSON)
	}
	s.TaskID = nullStringPtr(taskID)
	s.TaskTitle = nullStringPtr(taskTitle)
	s.RequirementID = nullStringPtr(reqID)
	if confidence.Valid {
		s.MatchConfidence = &confidence.Float64
	}

	writeJSON(w, http.StatusOK, s)
}

func (h *SessionHandler) BatchUpload(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	var batch model.BatchSessionUpload
	if err := readJSON(r, &batch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	type result struct {
		SessionRef string `json:"session_ref"`
		ID         string `json:"id"`
		Status     string `json:"status"`
	}
	var results []result

	for _, su := range batch.Sessions {
		var existingID string
		err := h.db.QueryRow(
			"SELECT id FROM sessions WHERE session_ref = $1 AND user_id = $2",
			su.SessionRef, u.ID).Scan(&existingID)

		if err == sql.ErrNoRows {
			toolCallsJSON, _ := json.Marshal(su.ToolCalls)
			gitCommits := arrayToTextArray(su.GitCommits)

			var sessionID string
			err := h.db.QueryRow(`
				INSERT INTO sessions (session_ref, user_id, agent_type, started_at, ended_at, duration_secs, model, summary, tool_calls_json, git_commits)
				VALUES ($1, $2, 'claude_code', $3, $4, $5, $6, $7, $8, $9)
				RETURNING id`,
				su.SessionRef, u.ID, su.StartedAt, su.EndedAt, su.DurationSecs,
				su.Model, su.Summary, toolCallsJSON, gitCommits,
			).Scan(&sessionID)
			if err != nil {
				results = append(results, result{SessionRef: su.SessionRef, Status: "error: " + err.Error()})
				continue
			}

			if su.TokenUsage != nil {
				var reqID *string
				h.db.QueryRow("SELECT requirement_id FROM tasks WHERE id IN (SELECT task_id FROM sessions WHERE id = $1)", sessionID).Scan(&reqID)

				h.db.Exec(`
					INSERT INTO token_usage (session_id, user_id, task_id, requirement_id, agent_type, model, input_tokens, output_tokens, total_tokens)
					VALUES ($1, $2, NULL, NULL, 'claude_code', $3, $4, $5, $6)`,
					sessionID, u.ID, su.Model,
					su.TokenUsage.InputTokens, su.TokenUsage.OutputTokens, su.TokenUsage.TotalTokens,
				)
			}

			results = append(results, result{SessionRef: su.SessionRef, ID: sessionID, Status: "created"})
		} else if err == nil {
			results = append(results, result{SessionRef: su.SessionRef, ID: existingID, Status: "duplicate"})
		} else {
			results = append(results, result{SessionRef: su.SessionRef, Status: "error: " + err.Error()})
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"total":   len(batch.Sessions),
		"results": results,
	})
}

func (h *SessionHandler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateSessionTaskRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	var reqID *string
	if req.TaskID != nil && *req.TaskID != "" {
		h.db.QueryRow("SELECT requirement_id FROM tasks WHERE id = $1", *req.TaskID).Scan(&reqID)
	}

	_, err := h.db.Exec("UPDATE sessions SET task_id = $1, requirement_id = $2 WHERE id = $3",
		req.TaskID, reqID, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	h.Get(w, r)
}

func (h *SessionHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	res, err := h.db.Exec("DELETE FROM sessions WHERE id = $1", id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "withdrawn"})
}
