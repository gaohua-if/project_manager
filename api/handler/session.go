package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/storage"
	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
)

type SessionHandler struct {
	db    *sql.DB
	store *storage.MinioStorage
}

func NewSessionHandler(db *sql.DB, store *storage.MinioStorage) *SessionHandler {
	return &SessionHandler{db: db, store: store}
}

func (h *SessionHandler) List(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	query := `
		SELECT s.id, s.session_ref, s.user_id, COALESCE(u.name,''), s.agent_type, s.started_at, s.ended_at,
			s.duration_secs, s.model, s.summary, s.tool_calls_json, s.git_commits,
			s.task_id, COALESCE(t.title,''), s.requirement_id, s.match_confidence,
			s.raw_log_url, s.uploaded_at
		FROM sessions s
		LEFT JOIN users u ON u.id = s.user_id
		LEFT JOIN tasks t ON t.id = s.task_id
		WHERE 1=1`
	args := []any{}
	argIdx := 1

	if date := r.URL.Query().Get("date"); date != "" {
		query += fmt.Sprintf(" AND DATE(s.uploaded_at) = $%d", argIdx)
		args = append(args, date)
		argIdx++
	}

	switch u.Role {
	case "employee":
		query += fmt.Sprintf(" AND s.user_id = $%d", argIdx)
		args = append(args, u.ID)
		argIdx++
	case "team_leader", "pm":
		if u.TeamID != nil {
			query += fmt.Sprintf(" AND s.user_id IN (SELECT id FROM users WHERE team_id = $%d)", argIdx)
			args = append(args, *u.TeamID)
			argIdx++
		}
	}

	query += " ORDER BY s.uploaded_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	sessions := []model.Session{}
	for rows.Next() {
		var s model.Session
		var endedAt, rawLogURL sql.NullString
		var durationSecs sql.NullInt64
		var summary sql.NullString
		var taskID, reqID sql.NullString
		var taskTitle sql.NullString
		var confidence sql.NullFloat64
		var toolCallsJSON []byte
		var gitCommits pq.StringArray

		if err := rows.Scan(&s.ID, &s.SessionRef, &s.UserID, &s.UserName, &s.AgentType, &s.StartedAt, &endedAt,
			&durationSecs, &s.Model, &summary, &toolCallsJSON, &gitCommits,
			&taskID, &taskTitle, &reqID, &confidence,
			&rawLogURL, &s.UploadedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
		if len(gitCommits) > 0 {
			s.GitCommits = []string(gitCommits)
		}
		s.TaskID = nullStringPtr(taskID)
		s.TaskTitle = nullStringPtr(taskTitle)
		s.RequirementID = nullStringPtr(reqID)
		if confidence.Valid {
			s.MatchConfidence = &confidence.Float64
		}
		s.RawLogURL = nullStringPtr(rawLogURL)
		sessions = append(sessions, s)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
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
	var gitCommits pq.StringArray

	err := h.db.QueryRow(`
		SELECT s.id, s.session_ref, s.user_id, COALESCE(u.name,''), s.agent_type, s.started_at, s.ended_at,
			s.duration_secs, s.model, s.summary, s.tool_calls_json, s.git_commits,
			s.task_id, COALESCE(t.title,''), s.requirement_id, s.match_confidence,
			s.raw_log_url, s.uploaded_at
		FROM sessions s
		LEFT JOIN users u ON u.id = s.user_id
		LEFT JOIN tasks t ON t.id = s.task_id
		WHERE s.id = $1`, id).Scan(
		&s.ID, &s.SessionRef, &s.UserID, &s.UserName, &s.AgentType, &s.StartedAt, &endedAt,
		&durationSecs, &s.Model, &summary, &toolCallsJSON, &gitCommits,
		&taskID, &taskTitle, &reqID, &confidence,
		&rawLogURL, &s.UploadedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
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
	if len(gitCommits) > 0 {
		s.GitCommits = []string(gitCommits)
	}
	s.TaskID = nullStringPtr(taskID)
	s.TaskTitle = nullStringPtr(taskTitle)
	s.RequirementID = nullStringPtr(reqID)
	if confidence.Valid {
		s.MatchConfidence = &confidence.Float64
	}
	s.RawLogURL = nullStringPtr(rawLogURL)

	writeJSON(w, http.StatusOK, s)
}

func (h *SessionHandler) BatchUpload(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)

	if err := r.ParseMultipartForm(64 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid multipart request: " + err.Error()})
		return
	}

	metadataPart := r.FormValue("metadata")
	if metadataPart == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing metadata field"})
		return
	}

	var batch model.BatchSessionUpload
	if err := json.Unmarshal([]byte(metadataPart), &batch); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid metadata JSON: " + err.Error()})
		return
	}

	type result struct {
		SessionRef string `json:"session_ref"`
		ID         string `json:"id"`
		Status     string `json:"status"`
	}
	var results []result

	for _, su := range batch.Sessions {
		if su.SessionRef == "" {
			results = append(results, result{Status: "error: missing session_ref"})
			continue
		}

		toolCallsJSON, _ := json.Marshal(su.ToolCalls)
		gitCommits := arrayToTextArray(su.GitCommits)

		var existingID string
		err := h.db.QueryRow(
			"SELECT id FROM sessions WHERE session_ref = $1 AND user_id = $2",
			su.SessionRef, u.ID).Scan(&existingID)

		status := "created"
		sessionID := existingID

		if err == sql.ErrNoRows {
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
		} else if err == nil {
			status = "updated"
			_, err := h.db.Exec(`
				UPDATE sessions
				SET started_at = $3, ended_at = $4, duration_secs = $5, model = $6,
					summary = $7, tool_calls_json = $8, git_commits = $9, uploaded_at = now()
				WHERE id = $1 AND user_id = $2`,
				sessionID, u.ID, su.StartedAt, su.EndedAt, su.DurationSecs,
				su.Model, su.Summary, toolCallsJSON, gitCommits,
			)
			if err != nil {
				results = append(results, result{SessionRef: su.SessionRef, ID: sessionID, Status: "error: " + err.Error()})
				continue
			}
		} else {
			results = append(results, result{SessionRef: su.SessionRef, Status: "error: " + err.Error()})
			continue
		}

		// Upload raw JSONL to MinIO if file is provided and storage is available
		fileKey := "file_" + su.SessionRef
		file, header, err := r.FormFile(fileKey)
		if err == nil {
			objectName := fmt.Sprintf("sessions/%s/%s.jsonl", u.ID, su.SessionRef)
			ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
			uploadErr := h.store.Upload(ctx, objectName, file, header.Size, "application/x-jsonlines")
			cancel()
			file.Close()
			if uploadErr != nil {
				results = append(results, result{SessionRef: su.SessionRef, ID: sessionID, Status: "warning: uploaded metadata but log upload failed: " + uploadErr.Error()})
				continue
			}
			_, err = h.db.Exec("UPDATE sessions SET raw_log_url = $1 WHERE id = $2", objectName, sessionID)
			if err != nil {
				results = append(results, result{SessionRef: su.SessionRef, ID: sessionID, Status: "warning: log uploaded but url save failed"})
				continue
			}
		}

		if su.TokenUsage != nil {
			if err := h.replaceTokenUsage(sessionID, u.ID, su); err != nil {
				results = append(results, result{SessionRef: su.SessionRef, ID: sessionID, Status: "error: token_usage: " + err.Error()})
				continue
			}
		}

		results = append(results, result{SessionRef: su.SessionRef, ID: sessionID, Status: status})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"total":   len(batch.Sessions),
		"results": results,
	})
}

func (h *SessionHandler) replaceTokenUsage(sessionID, userID string, su model.SessionUpload) error {
	tx, err := h.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM token_usage WHERE session_id = $1", sessionID); err != nil {
		return err
	}
	if _, err := tx.Exec(`
		INSERT INTO token_usage (session_id, user_id, task_id, requirement_id, agent_type, model, input_tokens, output_tokens, total_tokens)
		SELECT $1, $2, s.task_id, s.requirement_id, 'claude_code', $3, $4, $5, $6
		FROM sessions s
		WHERE s.id = $1`,
		sessionID, userID, su.Model,
		su.TokenUsage.InputTokens, su.TokenUsage.OutputTokens, su.TokenUsage.TotalTokens,
	); err != nil {
		return err
	}
	return tx.Commit()
}

func (h *SessionHandler) DownloadLog(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	u := getUser(r)

	var rawLogURL sql.NullString
	var ownerID string
	err := h.db.QueryRow("SELECT raw_log_url, user_id FROM sessions WHERE id = $1", id).Scan(&rawLogURL, &ownerID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "session not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if u.Role != "director" && u.ID != ownerID {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	if !rawLogURL.Valid || rawLogURL.String == "" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no raw log available"})
		return
	}

	if h.store == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "raw log storage not configured"})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	stream, err := h.store.Download(ctx, rawLogURL.String)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "download failed: " + err.Error()})
		return
	}
	defer stream.Close()

	w.Header().Set("Content-Type", "application/x-jsonlines")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+id+".jsonl\"")
	io.Copy(w, stream)
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
	u := getUser(r)

	var ownerID string
	err := h.db.QueryRow("SELECT user_id FROM sessions WHERE id = $1", id).Scan(&ownerID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if u.Role != "director" && u.ID != ownerID {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	res, err := h.db.Exec("DELETE FROM sessions WHERE id = $1 AND user_id = $2", id, ownerID)
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
