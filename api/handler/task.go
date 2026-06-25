package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
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
			COALESCE(t.acceptance_criteria, ARRAY[]::text[]), t.assignee_id, COALESCE(a.name,''),
			t.creator_tl_id, t.status, t.priority, t.progress, t.due_date, t.completed_at,
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
		if r.URL.Query().Get("scope") != "requirements" {
			query += fmt.Sprintf(" AND t.assignee_id = $%d", argIdx)
			args = append(args, u.ID)
		}
	}

	query += " ORDER BY t.created_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	tasks := []model.Task{}
	for rows.Next() {
		var t model.Task
		var ac pq.StringArray
		var dueDate sql.NullString
		var assigneeID sql.NullString
		var assigneeName sql.NullString
		var completedAt sql.NullTime
		if err := rows.Scan(&t.ID, &t.RequirementID, &t.RequirementTitle, &t.Title,
			&ac, &assigneeID, &assigneeName,
			&t.CreatorTLID, &t.Status, &t.Priority, &t.Progress, &dueDate, &completedAt,
			&t.CreatedAt, &t.UpdatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		t.AcceptanceCriteria = []string(ac)
		t.AssigneeID = nullStringPtr(assigneeID)
		t.AssigneeName = nullStringPtr(assigneeName)
		t.DueDate = nullStringPtr(dueDate)
		t.CompletedAt = nullTimePtr(completedAt)
		h.enrichTask(&t, u.ID)
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, tasks)
}

func (h *TaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var t model.Task
	var ac pq.StringArray
	var dueDate sql.NullString
	var assigneeID sql.NullString
	var assigneeName sql.NullString
	var completedAt sql.NullTime

	err := h.db.QueryRow(`
		SELECT t.id, t.requirement_id, r.title, t.title,
			COALESCE(t.acceptance_criteria, ARRAY[]::text[]), t.assignee_id, COALESCE(a.name,''),
			t.creator_tl_id, t.status, t.priority, t.progress, t.due_date, t.completed_at,
			t.created_at, t.updated_at
		FROM tasks t
		JOIN requirements r ON r.id = t.requirement_id
		LEFT JOIN users a ON a.id = t.assignee_id
		WHERE t.id = $1`, id).Scan(
		&t.ID, &t.RequirementID, &t.RequirementTitle, &t.Title,
		&ac, &assigneeID, &assigneeName,
		&t.CreatorTLID, &t.Status, &t.Priority, &t.Progress, &dueDate, &completedAt,
		&t.CreatedAt, &t.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	t.AcceptanceCriteria = []string(ac)
	t.AssigneeID = nullStringPtr(assigneeID)
	t.AssigneeName = nullStringPtr(assigneeName)
	t.DueDate = nullStringPtr(dueDate)
	t.CompletedAt = nullTimePtr(completedAt)
	h.enrichTask(&t, getUser(r).ID)
	writeJSON(w, http.StatusOK, t)
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	if u == nil || (u.Role != "admin" && u.Role != "director" && u.Role != "pm" && u.Role != "team_leader") {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions to create tasks"})
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
	if req.AssigneeID == nil || *req.AssigneeID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "assignee_id is required"})
		return
	}
	if req.Priority == "" {
		req.Priority = "medium"
	}

	var assigneeOK bool
	var err error
	if u.Role == "team_leader" {
		if u.TeamID == nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "team leader must belong to a team"})
			return
		}
		err = h.db.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM users
				WHERE id = $1 AND role = 'employee' AND team_id = $2
			)`, *req.AssigneeID, *u.TeamID).Scan(&assigneeOK)
	} else {
		err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", *req.AssigneeID).Scan(&assigneeOK)
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if !assigneeOK {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "assignee must be an employee in your team"})
		return
	}

	var requirementOK bool
	if u.Role == "team_leader" {
		err = h.db.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM requirement_teams
				WHERE requirement_id = $1 AND team_id = $2
			)`, req.RequirementID, *u.TeamID).Scan(&requirementOK)
	} else {
		err = h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM requirements WHERE id = $1)", req.RequirementID).Scan(&requirementOK)
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if !requirementOK {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "requirement is not assigned to your team"})
		return
	}
	for _, depID := range req.DependsOnIDs {
		if err := h.validateDependency(req.RequirementID, "", depID); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
	}

	var taskID string
	err = h.db.QueryRow(`
		INSERT INTO tasks (requirement_id, title, acceptance_criteria, assignee_id, creator_tl_id, priority, due_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		req.RequirementID, req.Title, pq.Array(req.AcceptanceCriteria),
		nullString(req.AssigneeID), u.ID, req.Priority, nullString(req.DueDate),
	).Scan(&taskID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	for _, depID := range req.DependsOnIDs {
		if _, err := h.db.Exec("INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", taskID, depID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}
	h.updateRequirementProgress(taskID)

	writeJSON(w, http.StatusCreated, map[string]string{"id": taskID, "status": "created"})
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateTaskRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if req.Status != nil && !isStoredTaskStatus(*req.Status) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status; blocked is derived from dependencies"})
		return
	}
	if req.Progress != nil && (*req.Progress < 0 || *req.Progress > 100) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "progress must be between 0 and 100"})
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
		if *req.Status == "done" {
			sets = append(sets, "progress = 100", "completed_at = now()")
		} else {
			sets = append(sets, "completed_at = NULL")
		}
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
	if req.AcceptanceCriteria != nil {
		sets = append(sets, fmt.Sprintf("acceptance_criteria = $%d", argIdx))
		args = append(args, pq.Array(*req.AcceptanceCriteria))
		argIdx++
	}
	if req.Progress != nil && (req.Status == nil || *req.Status != "done") {
		sets = append(sets, fmt.Sprintf("progress = $%d", argIdx))
		args = append(args, *req.Progress)
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

	h.updateRequirementProgress(id)

	h.Get(w, r)
}

func (h *TaskHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateTaskStatusRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if !isStoredTaskStatus(req.Status) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status; blocked is derived from dependencies"})
		return
	}

	res, err := h.db.Exec(`
		UPDATE tasks
		SET status = $1,
			progress = CASE WHEN $1 = 'done' THEN 100 ELSE progress END,
			completed_at = CASE WHEN $1 = 'done' THEN now() ELSE NULL END,
			updated_at = now()
		WHERE id = $2`, req.Status, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	h.updateRequirementProgress(id)

	h.Get(w, r)
}

func (h *TaskHandler) UpdateProgress(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateTaskProgressRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if req.Progress < 0 || req.Progress > 100 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "progress must be between 0 and 100"})
		return
	}
	res, err := h.db.Exec("UPDATE tasks SET progress = $1, updated_at = now() WHERE id = $2", req.Progress, id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	h.updateRequirementProgress(id)
	h.Get(w, r)
}

func (h *TaskHandler) AddDependency(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	var req model.AddDependencyRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	var requirementID string
	if err := h.db.QueryRow("SELECT requirement_id FROM tasks WHERE id = $1", taskID).Scan(&requirementID); err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "task not found"})
		return
	} else if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if err := h.validateDependency(requirementID, taskID, req.DependsOnID); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	_, err := h.db.Exec("INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", taskID, req.DependsOnID)
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

func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	u := getUser(r)
	if u == nil || (u.Role != "admin" && u.Role != "director" && u.Role != "pm" && u.Role != "team_leader") {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions to delete tasks"})
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	var requirementID string
	var creatorTL string
	var assigneeID sql.NullString
	err = tx.QueryRow(`SELECT requirement_id, creator_tl_id, assignee_id FROM tasks WHERE id = $1 FOR UPDATE`, id).
		Scan(&requirementID, &creatorTL, &assigneeID)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if u.Role == "team_leader" {
		if u.TeamID == nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "team leader must belong to a team"})
			return
		}
		var allowed bool
		if err := tx.QueryRow(`
			SELECT (
				$1 = $2
				OR EXISTS(SELECT 1 FROM users WHERE id = $3 AND team_id = $4)
			)`, creatorTL, u.ID, assigneeID, *u.TeamID).Scan(&allowed); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !allowed {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "task is not within your team"})
			return
		}
	}

	if _, err := tx.Exec(`SELECT id FROM requirements WHERE id = $1 FOR UPDATE`, requirementID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if _, err := tx.Exec(`UPDATE sessions SET task_id = NULL WHERE task_id = $1`, id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if _, err := tx.Exec(`UPDATE token_usage SET task_id = NULL WHERE task_id = $1`, id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if _, err := tx.Exec(`UPDATE documents SET task_id = NULL WHERE task_id = $1`, id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if _, err := tx.Exec(`DELETE FROM user_follows WHERE target_type = 'task' AND target_id = $1`, id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if _, err := tx.Exec(`DELETE FROM tasks WHERE id = $1`, id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if _, err := tx.Exec(`
		UPDATE requirements
		SET progress = COALESCE((
			SELECT FLOOR(AVG(progress))::int FROM tasks WHERE requirement_id = $1
		), 0), updated_at = now()
		WHERE id = $1`, requirementID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if err := tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
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

func (h *TaskHandler) enrichTask(t *model.Task, userID string) {
	h.loadDeps(t)
	t.RiskTypes = service.DeriveTaskRisks(*t, time.Now())
	t.DisplayStatus = service.DisplayTaskStatus(*t)
	if t.RiskTypes == nil {
		t.RiskTypes = []string{}
	}
	rows, err := h.db.Query(`
		SELECT DISTINCT s.id
		FROM sessions s
		JOIN token_usage tu ON tu.session_id = s.id
		WHERE s.task_id = $1
		ORDER BY s.id`, t.ID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var id string
			if rows.Scan(&id) == nil {
				t.TokenSourceIDs = append(t.TokenSourceIDs, id)
			}
		}
	}
	_ = h.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM user_follows
			WHERE user_id = $1 AND target_type = 'task' AND target_id = $2
		)`, userID, t.ID).Scan(&t.IsFollowed)
}

func (h *TaskHandler) validateDependency(requirementID, taskID, dependsOnID string) error {
	if dependsOnID == "" {
		return fmt.Errorf("depends_on_id is required")
	}
	if taskID != "" && taskID == dependsOnID {
		return fmt.Errorf("task cannot depend on itself")
	}
	var dependencyRequirementID string
	if err := h.db.QueryRow("SELECT requirement_id FROM tasks WHERE id = $1", dependsOnID).Scan(&dependencyRequirementID); err == sql.ErrNoRows {
		return fmt.Errorf("dependency task not found")
	} else if err != nil {
		return err
	}
	if dependencyRequirementID != requirementID {
		return fmt.Errorf("dependencies must belong to the same requirement")
	}
	if taskID == "" {
		return nil
	}
	var createsCycle bool
	if err := h.db.QueryRow(`
		WITH RECURSIVE upstream(id) AS (
			SELECT depends_on_id FROM task_dependencies WHERE task_id = $1
			UNION
			SELECT td.depends_on_id
			FROM task_dependencies td
			JOIN upstream u ON td.task_id = u.id
		)
		SELECT EXISTS(SELECT 1 FROM upstream WHERE id = $2)`, dependsOnID, taskID).Scan(&createsCycle); err != nil {
		return err
	}
	if createsCycle {
		return fmt.Errorf("dependency would create a cycle")
	}
	return nil
}

func (h *TaskHandler) updateRequirementProgress(taskID string) {
	var reqID string
	_ = h.db.QueryRow("SELECT requirement_id FROM tasks WHERE id = $1", taskID).Scan(&reqID)
	if reqID == "" {
		return
	}
	_, _ = h.db.Exec(`
		UPDATE requirements
		SET progress = COALESCE((
			SELECT FLOOR(AVG(progress))::int FROM tasks WHERE requirement_id = $1
		), 0), updated_at = now()
	WHERE id = $1`, reqID)
}

func isStoredTaskStatus(status string) bool {
	return status == "todo" || status == "in_progress" || status == "done"
}

func nullTimePtr(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}
