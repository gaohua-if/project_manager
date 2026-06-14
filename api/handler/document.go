package handler

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/aidashboard/api/model"
	"github.com/go-chi/chi/v5"
)

type DocumentHandler struct {
	db *sql.DB
}

func NewDocumentHandler(db *sql.DB) *DocumentHandler {
	return &DocumentHandler{db: db}
}

func (h *DocumentHandler) List(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	query := `
		SELECT d.id, d.user_id, u.name, d.title, d.url, d.description,
			d.task_id, COALESCE(t.title,''), d.requirement_id, d.uploaded_at
		FROM documents d
		JOIN users u ON u.id = d.user_id
		LEFT JOIN tasks t ON t.id = d.task_id
		WHERE 1=1`
	args := []any{}
	argIdx := 1

	if date := r.URL.Query().Get("date"); date != "" {
		query += fmt.Sprintf(" AND DATE(d.uploaded_at) = $%d", argIdx)
		args = append(args, date)
		argIdx++
	}

	switch u.Role {
	case "employee":
		query += fmt.Sprintf(" AND d.user_id = $%d", argIdx)
		args = append(args, u.ID)
		argIdx++
	case "team_leader", "pm":
		if u.TeamID != nil {
			query += fmt.Sprintf(" AND d.user_id IN (SELECT id FROM users WHERE team_id = $%d)", argIdx)
			args = append(args, *u.TeamID)
			argIdx++
		}
	}

	query += " ORDER BY d.uploaded_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	docs := []model.Document{}
	for rows.Next() {
		var d model.Document
		var desc sql.NullString
		var taskID, reqID sql.NullString
		var taskTitle sql.NullString

		rows.Scan(&d.ID, &d.UserID, &d.UserName, &d.Title, &d.URL, &desc,
			&taskID, &taskTitle, &reqID, &d.UploadedAt)

		d.Description = nullStringPtr(desc)
		d.TaskID = nullStringPtr(taskID)
		d.TaskTitle = nullStringPtr(taskTitle)
		d.RequirementID = nullStringPtr(reqID)
		docs = append(docs, d)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, docs)
}

func (h *DocumentHandler) Create(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	var req model.CreateDocumentRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if req.Title == "" || req.URL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title and url are required"})
		return
	}

	var reqID *string
	if req.TaskID != nil && *req.TaskID != "" {
		h.db.QueryRow("SELECT requirement_id FROM tasks WHERE id = $1", *req.TaskID).Scan(&reqID)
	}

	var d model.Document
	err := h.db.QueryRow(`
		INSERT INTO documents (user_id, title, url, description, task_id, requirement_id)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, uploaded_at`,
		u.ID, req.Title, req.URL, req.Description, req.TaskID, reqID,
	).Scan(&d.ID, &d.UploadedAt)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	d.UserID = u.ID
	d.UserName = u.Name
	d.Title = req.Title
	d.URL = req.URL
	d.Description = req.Description
	d.TaskID = req.TaskID
	d.RequirementID = reqID

	writeJSON(w, http.StatusOK, d)
}

func (h *DocumentHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	u := getUser(r)

	var req model.UpdateDocumentRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	var ownerID string
	err := h.db.QueryRow("SELECT user_id FROM documents WHERE id = $1", id).Scan(&ownerID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if u.Role != "director" && u.Role != "team_leader" && u.ID != ownerID {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
		return
	}

	if req.TaskID != nil {
		var reqID *string
		if *req.TaskID != "" {
			h.db.QueryRow("SELECT requirement_id FROM tasks WHERE id = $1", *req.TaskID).Scan(&reqID)
		}
		h.db.Exec("UPDATE documents SET task_id = $1, requirement_id = $2 WHERE id = $3", req.TaskID, reqID, id)
	}
	if req.Title != nil {
		h.db.Exec("UPDATE documents SET title = $1 WHERE id = $2", *req.Title, id)
	}
	if req.URL != nil {
		h.db.Exec("UPDATE documents SET url = $1 WHERE id = $2", *req.URL, id)
	}
	if req.Description != nil {
		h.db.Exec("UPDATE documents SET description = $1 WHERE id = $2", *req.Description, id)
	}

	h.List(w, r)
}

func (h *DocumentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	u := getUser(r)

	var ownerID string
	err := h.db.QueryRow("SELECT user_id FROM documents WHERE id = $1", id).Scan(&ownerID)
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

	res, err := h.db.Exec("DELETE FROM documents WHERE id = $1", id)
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
