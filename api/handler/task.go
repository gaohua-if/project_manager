package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/aidashboard/api/model"
	"github.com/go-chi/chi/v5"
)

type TaskHandler struct {
	db *sql.DB
}

func NewTaskHandler(db *sql.DB) *TaskHandler {
	return &TaskHandler{db: db}
}

func (h *TaskHandler) List(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	query := `
		SELECT t.id, t.requirement_id, r.title as req_title, t.title,
			t.acceptance_criteria_ids, t.assignee_id, COALESCE(a.name,''),
			t.creator_tl_id, t.status, t.priority, t.due_date,
			t.created_at, t.updated_at
		FROM tasks t
		JOIN requirements r ON r.id = t.requirement_id
		LEFT JOIN users a ON a.id = t.assignee_id
		WHERE 1=1`
	args := []any{}
	argIdx := 1

	if reqID := r.URL.Query().Get("requirement_id"); reqID != "" {
		query += fmt.Sprintf(" AND t.requirement_id = $%d", argIdx)
		args = append(args, reqID)
		argIdx++
	}

	if assignee := r.URL.Query().Get("assignee_id"); assignee != "" {
		query += fmt.Sprintf(" AND t.assignee_id = $%d", argIdx)
		args = append(args, assignee)
		argIdx++
	}

	if status := r.URL.Query().Get("status"); status != "" {
		query += fmt.Sprintf(" AND t.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	switch u.Role {
	case "team_leader":
		if u.TeamID != nil {
			query += fmt.Sprintf(" AND (t.assignee_id IN (SELECT id FROM users WHERE team_id = $%d) OR t.creator_tl_id = $%d)", argIdx, argIdx)
			args = append(args, *u.TeamID)
			argIdx++
		}
	case "employee":
		query += fmt.Sprintf(" AND t.assignee_id = $%d", argIdx)
		args = append(args, u.ID)
	}

	query += " ORDER BY t.created_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	var tasks []model.Task
	for rows.Next() {
		var t model.Task
		var acStr string
		var dueDate sql.NullString
		var assigneeID sql.NullString
		var assigneeName sql.NullString
		rows.Scan(&t.ID, &t.RequirementID, &t.RequirementTitle, &t.Title,
			&acStr, &assigneeID, &assigneeName,
			&t.CreatorTLID, &t.Status, &t.Priority, &dueDate,
			&t.CreatedAt, &t.UpdatedAt)
		t.AcceptanceCriteriaIDs = parseIntArray(acStr)
		t.AssigneeID = nullStringPtr(assigneeID)
		t.AssigneeName = nullStringPtr(assigneeName)
		t.DueDate = nullStringPtr(dueDate)
		tasks = append(tasks, t)
	}

	writeJSON(w, http.StatusOK, tasks)
}

func (h *TaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var t model.Task
	var acStr string
	var dueDate sql.NullString
	var assigneeID sql.NullString
	var assigneeName sql.NullString

	err := h.db.QueryRow(`
		SELECT t.id, t.requirement_id, r.title, t.title,
			t.acceptance_criteria_ids, t.assignee_id, COALESCE(a.name,''),
			t.creator_tl_id, t.status, t.priority, t.due_date,
			t.created_at, t.updated_at
		FROM tasks t
		JOIN requirements r ON r.id = t.requirement_id
		LEFT JOIN users a ON a.id = t.assignee_id
		WHERE t.id = $1`, id).Scan(
		&t.ID, &t.RequirementID, &t.RequirementTitle, &t.Title,
		&acStr, &assigneeID, &assigneeName,
		&t.CreatorTLID, &t.Status, &t.Priority, &dueDate,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	t.AcceptanceCriteriaIDs = parseIntArray(acStr)
	t.AssigneeID = nullStringPtr(assigneeID)
	t.AssigneeName = nullStringPtr(assigneeName)
	t.DueDate = nullStringPtr(dueDate)

	h.loadDeps(&t)
	writeJSON(w, http.StatusOK, t)
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	if u.Role != "team_leader" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only team leaders can create tasks"})
		return
	}

	var req model.CreateTaskRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if req.RequirementID == "" || req.Title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "requirement_id and title required"})
		return
	}

	var taskID string
	err := h.db.QueryRow(`
		INSERT INTO tasks (requirement_id, title, acceptance_criteria_ids, assignee_id, creator_tl_id, priority, due_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		req.RequirementID, req.Title, intArrayToPG(req.AcceptanceCriteriaIDs),
		nullString(req.AssigneeID), u.ID, req.Priority, nullString(req.DueDate),
	).Scan(&taskID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	for _, depID := range req.DependsOnIDs {
		h.db.Exec("INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2)", taskID, depID)
	}

	writeJSON(w, http.StatusCreated, map[string]string{"id": taskID, "status": "created"})
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateTaskRequest
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
	if req.AssigneeID != nil {
		sets = append(sets, fmt.Sprintf("assignee_id = $%d", argIdx))
		args = append(args, nullString(req.AssigneeID))
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
	if req.DueDate != nil {
		sets = append(sets, fmt.Sprintf("due_date = $%d", argIdx))
		args = append(args, nullString(req.DueDate))
		argIdx++
	}
	if req.AcceptanceCriteriaIDs != nil {
		sets = append(sets, fmt.Sprintf("acceptance_criteria_ids = $%d", argIdx))
		args = append(args, intArrayToPG(*req.AcceptanceCriteriaIDs))
		argIdx++
	}

	if len(sets) == 0 {
		h.Get(w, r)
		return
	}

	sets = append(sets, "updated_at = now()")
	args = append(args, id)
	query := fmt.Sprintf("UPDATE tasks SET %s WHERE id = $%d", strings.Join(sets, ", "), argIdx)

	res, err := h.db.Exec(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	if req.Status != nil && *req.Status == "done" {
		h.updateRequirementProgress(id)
	}

	h.Get(w, r)
}

func (h *TaskHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateTaskStatusRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	validStatuses := map[string]bool{"todo": true, "in_progress": true, "done": true, "blocked": true}
	if !validStatuses[req.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status"})
		return
	}

	res, err := h.db.Exec("UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2", req.Status, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	if req.Status == "done" {
		h.updateRequirementProgress(id)
	}

	h.Get(w, r)
}

func (h *TaskHandler) AddDependency(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	var req model.AddDependencyRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	_, err := h.db.Exec("INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2)", taskID, req.DependsOnID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	h.Get(w, r)
}

func (h *TaskHandler) RemoveDependency(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	depID := chi.URLParam(r, "dep_id")

	_, err := h.db.Exec("DELETE FROM task_dependencies WHERE task_id = $1 AND depends_on_id = $2", taskID, depID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	h.Get(w, r)
}

func (h *TaskHandler) loadDeps(t *model.Task) {
	rows, _ := h.db.Query(`
		SELECT td.depends_on_id, t.title, t.status
		FROM task_dependencies td
		JOIN tasks t ON t.id = td.depends_on_id
		WHERE td.task_id = $1`, t.ID)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var d model.TaskDep
			rows.Scan(&d.TaskID, &d.TaskTitle, &d.Status)
			t.Dependencies = append(t.Dependencies, d)
		}
	}

	rows, _ = h.db.Query(`
		SELECT td.task_id, t.title, t.status
		FROM task_dependencies td
		JOIN tasks t ON t.id = td.task_id
		WHERE td.depends_on_id = $1`, t.ID)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var d model.TaskDep
			rows.Scan(&d.TaskID, &d.TaskTitle, &d.Status)
			t.Blocking = append(t.Blocking, d)
		}
	}
}

func (h *TaskHandler) updateRequirementProgress(taskID string) {
	var reqID string
	h.db.QueryRow("SELECT requirement_id FROM tasks WHERE id = $1", taskID).Scan(&reqID)
	if reqID == "" {
		return
	}

	var acStr string
	h.db.QueryRow("SELECT acceptance_criteria FROM requirements WHERE id = $1", reqID).Scan(&acStr)
	acItems := parseTextArray(acStr)
	if len(acItems) == 0 {
		return
	}

	completed := 0
	for i := range acItems {
		var allDone bool
		err := h.db.QueryRow(`
			SELECT COALESCE(
				EXISTS(SELECT 1 FROM tasks WHERE requirement_id = $1 AND $2 = ANY(acceptance_criteria_ids) AND status != 'done'),
				NOT EXISTS(SELECT 1 FROM tasks WHERE requirement_id = $1 AND $2 = ANY(acceptance_criteria_ids))
			) = false AND EXISTS(SELECT 1 FROM tasks WHERE requirement_id = $1 AND $2 = ANY(acceptance_criteria_ids))`,
			reqID, i).Scan(&allDone)
		if err == nil && allDone {
			completed++
		}
	}

	progress := completed * 100 / len(acItems)
	status := "active"
	if progress == 100 {
		status = "completed"
	}
	h.db.Exec("UPDATE requirements SET progress = $1, status = $2, updated_at = now() WHERE id = $3", progress, status, reqID)
}

func parseIntArray(pgArray string) []int {
	if pgArray == "" || pgArray == "{}" || pgArray == "NULL" {
		return nil
	}
	s := strings.Trim(pgArray, "{}")
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	result := make([]int, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" && p != "NULL" {
			var v int
			fmt.Sscanf(p, "%d", &v)
			result = append(result, v)
		}
	}
	return result
}

func intArrayToPG(ids []int) string {
	if len(ids) == 0 {
		return "{}"
	}
	parts := make([]string, len(ids))
	for i, v := range ids {
		parts[i] = fmt.Sprintf("%d", v)
	}
	return "{" + strings.Join(parts, ",") + "}"
}
