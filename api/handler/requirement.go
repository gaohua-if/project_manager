package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/aidashboard/api/model"
	"github.com/go-chi/chi/v5"
)

type RequirementHandler struct {
	db *sql.DB
}

func NewRequirementHandler(db *sql.DB) *RequirementHandler {
	return &RequirementHandler{db: db}
}

func (h *RequirementHandler) List(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	query := `
		SELECT r.id, r.title, r.description, r.feishu_doc_url, r.acceptance_criteria,
			r.creator_id, COALESCE(u.name,''), r.creator_role, r.status, r.priority,
			r.progress, r.deadline, r.created_at, r.updated_at
		FROM requirements r
		JOIN users u ON u.id = r.creator_id
		WHERE 1=1`
	args := []any{}
	argIdx := 1

	if status := r.URL.Query().Get("status"); status != "" {
		query += fmt.Sprintf(" AND r.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	if teamID := r.URL.Query().Get("team_id"); teamID != "" {
		query += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM requirement_teams rt WHERE rt.requirement_id = r.id AND rt.team_id = $%d)", argIdx)
		args = append(args, teamID)
		argIdx++
	}

	if u.Role == "team_leader" && u.TeamID != nil {
		query += fmt.Sprintf(" AND EXISTS (SELECT 1 FROM requirement_teams rt WHERE rt.requirement_id = r.id AND rt.team_id = $%d)", argIdx)
		args = append(args, *u.TeamID)
		argIdx++
	}

	query += " ORDER BY r.created_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	reqs := []model.Requirement{}
	for rows.Next() {
		var req model.Requirement
		var acStr string
		var deadline sql.NullString
		var feishuURL sql.NullString
		rows.Scan(&req.ID, &req.Title, &req.Description, &feishuURL, &acStr,
			&req.CreatorID, &req.CreatorName, &req.CreatorRole, &req.Status, &req.Priority,
			&req.Progress, &deadline, &req.CreatedAt, &req.UpdatedAt)
		req.FeishuDocURL = nullStringPtr(feishuURL)
		req.Deadline = nullStringPtr(deadline)
		req.AcceptanceCriteria = parseTextArray(acStr)
		reqs = append(reqs, req)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	for i := range reqs {
		h.loadTeams(&reqs[i])
	}

	writeJSON(w, http.StatusOK, reqs)
}

func (h *RequirementHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.Requirement
	var acStr string
	var deadline sql.NullString
	var feishuURL sql.NullString

	err := h.db.QueryRow(`
		SELECT r.id, r.title, r.description, r.feishu_doc_url, r.acceptance_criteria,
			r.creator_id, COALESCE(u.name,''), r.creator_role, r.status, r.priority,
			r.progress, r.deadline, r.created_at, r.updated_at
		FROM requirements r
		JOIN users u ON u.id = r.creator_id
		WHERE r.id = $1`, id).Scan(
		&req.ID, &req.Title, &req.Description, &feishuURL, &acStr,
		&req.CreatorID, &req.CreatorName, &req.CreatorRole, &req.Status, &req.Priority,
		&req.Progress, &deadline, &req.CreatedAt, &req.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	req.FeishuDocURL = nullStringPtr(feishuURL)
	req.Deadline = nullStringPtr(deadline)
	req.AcceptanceCriteria = parseTextArray(acStr)
	h.loadTeams(&req)
	writeJSON(w, http.StatusOK, req)
}

func (h *RequirementHandler) Create(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	var req model.CreateRequirementRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if req.Title == "" || req.Description == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title and description required"})
		return
	}
	if len(req.TeamIDs) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "at least one team_id required"})
		return
	}

	ac := []string{"(AI will generate acceptance criteria)"}

	var reqID string
	err := h.db.QueryRow(`
		INSERT INTO requirements (title, description, feishu_doc_url, acceptance_criteria, creator_id, creator_role, priority, deadline)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
		req.Title, req.Description, nullString(req.FeishuDocURL),
		arrayToTextArray(ac), u.ID, u.Role, req.Priority, nullString(req.Deadline),
	).Scan(&reqID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	for _, tid := range req.TeamIDs {
		h.db.Exec("INSERT INTO requirement_teams (requirement_id, team_id) VALUES ($1, $2)", reqID, tid)
	}

	var result model.Requirement
	var acStr string
	var deadline sql.NullString
	var feishuURL sql.NullString
	err = h.db.QueryRow(`
		SELECT r.id, r.title, r.description, r.feishu_doc_url, r.acceptance_criteria,
			r.creator_id, COALESCE(u.name,''), r.creator_role, r.status, r.priority,
			r.progress, r.deadline, r.created_at, r.updated_at
		FROM requirements r JOIN users u ON u.id = r.creator_id WHERE r.id = $1`, reqID).Scan(
		&result.ID, &result.Title, &result.Description, &feishuURL, &acStr,
		&result.CreatorID, &result.CreatorName, &result.CreatorRole, &result.Status, &result.Priority,
		&result.Progress, &deadline, &result.CreatedAt, &result.UpdatedAt,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	result.FeishuDocURL = nullStringPtr(feishuURL)
	result.Deadline = nullStringPtr(deadline)
	result.AcceptanceCriteria = parseTextArray(acStr)
	h.loadTeams(&result)
	writeJSON(w, http.StatusCreated, result)
}

func (h *RequirementHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateRequirementRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	sets := []string{}
	args := []any{}
	argIdx := 1

	if req.Title != nil {
		sets = append(sets, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, *req.Title)
		argIdx++
	}
	if req.Description != nil {
		sets = append(sets, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *req.Description)
		argIdx++
	}
	if req.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *req.Status)
		argIdx++
	}
	if req.Priority != nil {
		sets = append(sets, fmt.Sprintf("priority = $%d", argIdx))
		args = append(args, *req.Priority)
		argIdx++
	}
	if req.Deadline != nil {
		sets = append(sets, fmt.Sprintf("deadline = $%d", argIdx))
		args = append(args, *req.Deadline)
		argIdx++
	}
	if req.FeishuDocURL != nil {
		sets = append(sets, fmt.Sprintf("feishu_doc_url = $%d", argIdx))
		args = append(args, *req.FeishuDocURL)
		argIdx++
	}

	if len(sets) == 0 {
		h.Get(w, r)
		return
	}

	sets = append(sets, "updated_at = now()")
	args = append(args, id)
	query := fmt.Sprintf("UPDATE requirements SET %s WHERE id = $%d", strings.Join(sets, ", "), argIdx)

	_, err := h.db.Exec(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	h.Get(w, r)
}

func (h *RequirementHandler) GetAC(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var acStr string
	err := h.db.QueryRow("SELECT acceptance_criteria FROM requirements WHERE id = $1", id).Scan(&acStr)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	acItems := parseTextArray(acStr)
	statuses := []model.ACStatus{}

	for i, text := range acItems {
		rows, err := h.db.Query(`
			SELECT t.id, t.title, t.status
			FROM tasks t
			WHERE t.requirement_id = $1 AND $2 = ANY(t.acceptance_criteria_ids)
			ORDER BY t.created_at`, id, i)
		if err != nil {
			statuses = append(statuses, model.ACStatus{Index: i, Text: text, Completed: false})
			continue
		}

		allDone := true
		hasTasks := false
		var taskIDs []string
		for rows.Next() {
			var tid, title, status string
			rows.Scan(&tid, &title, &status)
			taskIDs = append(taskIDs, title)
			hasTasks = true
			if status != "done" {
				allDone = false
			}
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			statuses = append(statuses, model.ACStatus{Index: i, Text: text, Completed: false})
			continue
		}
		rows.Close()

		completed := hasTasks && allDone
		statuses = append(statuses, model.ACStatus{
			Index:       i,
			Text:        text,
			Completed:   completed,
			LinkedTasks: taskIDs,
		})
	}

	writeJSON(w, http.StatusOK, statuses)
}

func (h *RequirementHandler) loadTeams(req *model.Requirement) {
	rows, err := h.db.Query(`
		SELECT t.id, t.name FROM teams t
		JOIN requirement_teams rt ON rt.team_id = t.id
		WHERE rt.requirement_id = $1`, req.ID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id, name string
		rows.Scan(&id, &name)
		req.TeamIDs = append(req.TeamIDs, id)
		req.TeamNames = append(req.TeamNames, name)
	}
}

func parseTextArray(pgArray string) []string {
	if pgArray == "" || pgArray == "{}" || pgArray == "{NULL}" {
		return nil
	}
	s := strings.Trim(pgArray, "{}")
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.Trim(strings.TrimSpace(p), "\"")
		if p != "" && p != "NULL" {
			result = append(result, p)
		}
	}
	return result
}

func arrayToTextArray(items []string) string {
	if len(items) == 0 {
		return "{}"
	}
	escaped := make([]string, len(items))
	for i, s := range items {
		s = strings.ReplaceAll(s, `"`, `\"`)
		escaped[i] = `"` + s + `"`
	}
	return "{" + strings.Join(escaped, ",") + "}"
}
