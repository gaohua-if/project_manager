package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
	"github.com/lib/pq"
)

type DashboardHandler struct {
	db *sql.DB
}

func NewDashboardHandler(db *sql.DB) *DashboardHandler {
	return &DashboardHandler{db: db}
}

func (h *DashboardHandler) Follows(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	rows, err := h.db.Query(`
		SELECT target_type, target_id
		FROM user_follows
		WHERE user_id = $1
		ORDER BY created_at DESC`, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	type target struct{ targetType, targetID string }
	targets := []target{}
	for rows.Next() {
		var item target
		if err := rows.Scan(&item.targetType, &item.targetID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		targets = append(targets, item)
	}

	items := []model.DashboardFollowItem{}
	for _, target := range targets {
		if target.targetType == "requirement" {
			item, ok := h.requirementFollowItem(target.targetID, u.ID)
			if ok {
				items = append(items, item)
			}
			continue
		}
		item, ok := h.taskFollowItem(target.targetID, u.ID)
		if ok {
			items = append(items, item)
		}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *DashboardHandler) Risks(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	query := `
		SELECT t.id, t.requirement_id, r.title, t.title,
			COALESCE(t.acceptance_criteria, ARRAY[]::text[]), t.assignee_id, COALESCE(a.name, ''),
			t.creator_tl_id, t.status, t.priority, t.progress, t.due_date,
			t.completed_at, t.created_at, t.updated_at
		FROM tasks t
		JOIN requirements r ON r.id = t.requirement_id
		LEFT JOIN users a ON a.id = t.assignee_id
		WHERE t.status <> 'done' AND r.status NOT IN ('completed', 'cancelled')`
	args := []any{}
	if u.Role == "employee" {
		query += ` AND (
			t.assignee_id = $1
			OR EXISTS (SELECT 1 FROM user_follows f WHERE f.user_id = $1 AND f.target_type = 'task' AND f.target_id = t.id)
			OR EXISTS (SELECT 1 FROM user_follows f WHERE f.user_id = $1 AND f.target_type = 'requirement' AND f.target_id = r.id)
		)`
		args = append(args, u.ID)
	} else if u.Role == "team_leader" && u.TeamID != nil {
		query += ` AND (
			a.team_id = $1 OR t.creator_tl_id = $2
			OR EXISTS (SELECT 1 FROM user_follows f WHERE f.user_id = $2 AND f.target_type = 'task' AND f.target_id = t.id)
			OR EXISTS (SELECT 1 FROM user_follows f WHERE f.user_id = $2 AND f.target_type = 'requirement' AND f.target_id = r.id)
		)`
		args = append(args, *u.TeamID, u.ID)
	}
	query += " ORDER BY t.due_date NULLS LAST, t.updated_at DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	tasks := []model.Task{}
	for rows.Next() {
		task, err := scanProjectionTask(rows)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		NewTaskHandler(h.db).enrichTask(&task, u)
		tasks = append(tasks, task)
	}

	items := []model.DashboardRiskItem{}
	for _, task := range tasks {
		for _, riskType := range task.RiskTypes {
			items = append(items, dashboardRiskItem(task, riskType))
		}
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *DashboardHandler) requirementFollowItem(id, userID string) (model.DashboardFollowItem, bool) {
	var req model.Requirement
	var deadline sql.NullString
	var updatedAt time.Time
	err := h.db.QueryRow(`
		SELECT r.id, r.title, r.status, r.deadline, COALESCE(u.name, ''), r.updated_at
		FROM requirements r
		JOIN users u ON u.id = r.creator_id
		WHERE r.id = $1`, id).Scan(&req.ID, &req.Title, &req.Status, &deadline, &req.CreatorName, &updatedAt)
	if err != nil || req.Status == "completed" || req.Status == "cancelled" {
		return model.DashboardFollowItem{}, false
	}
	req.Deadline = nullStringPtr(deadline)
	NewRequirementHandler(h.db, nil).loadProjection(&req, &model.User{ID: userID})
	url := fmt.Sprintf("/requirements?requirementId=%s", req.ID)
	return model.DashboardFollowItem{
		Key:           "requirement:" + req.ID,
		Type:          "需求",
		Title:         req.Title,
		RequirementID: req.ID,
		Owner:         fallback(req.CreatorName, "未分配"),
		Status:        requirementStatusLabel(req.Status),
		Deadline:      displayDate(req.Deadline),
		Risk:          requirementRiskLabel(req.RiskSummary),
		Activity:      recentUpdateLabel(updatedAt),
		Navigation: model.DashboardNavigationTarget{
			RequirementID: req.ID,
			URL:           url,
		},
	}, true
}

func (h *DashboardHandler) taskFollowItem(id, userID string) (model.DashboardFollowItem, bool) {
	task, err := h.loadTask(id, userID)
	if err != nil || task.Status == "done" {
		return model.DashboardFollowItem{}, false
	}
	var parentStatus string
	if err := h.db.QueryRow(`SELECT status FROM requirements WHERE id = $1`, task.RequirementID).Scan(&parentStatus); err != nil {
		return model.DashboardFollowItem{}, false
	}
	if parentStatus == "cancelled" || parentStatus == "completed" {
		return model.DashboardFollowItem{}, false
	}
	url := fmt.Sprintf("/requirements?requirementId=%s&taskId=%s", task.RequirementID, task.ID)
	dependency := ""
	if task.DisplayStatus == "blocked" {
		dependency = unfinishedDependencyNames(task)
	}
	return model.DashboardFollowItem{
		Key:           "task:" + task.ID,
		Type:          "任务",
		Title:         task.Title,
		Requirement:   task.RequirementTitle,
		RequirementID: task.RequirementID,
		TaskID:        &task.ID,
		Owner:         pointerFallback(task.AssigneeName, "未分配"),
		Status:        taskStatusLabel(task.DisplayStatus),
		Deadline:      displayDate(task.DueDate),
		Risk:          taskRiskLabel(task.RiskTypes),
		Dependency:    dependency,
		Activity:      recentUpdateLabel(task.UpdatedAt),
		Navigation: model.DashboardNavigationTarget{
			RequirementID: task.RequirementID,
			TaskID:        &task.ID,
			URL:           url,
		},
	}, true
}

func (h *DashboardHandler) loadTask(id, userID string) (model.Task, error) {
	row := h.db.QueryRow(`
		SELECT t.id, t.requirement_id, r.title, t.title,
			COALESCE(t.acceptance_criteria, ARRAY[]::text[]), t.assignee_id, COALESCE(a.name, ''),
			t.creator_tl_id, t.status, t.priority, t.progress, t.due_date,
			t.completed_at, t.created_at, t.updated_at
		FROM tasks t
		JOIN requirements r ON r.id = t.requirement_id
		LEFT JOIN users a ON a.id = t.assignee_id
		WHERE t.id = $1`, id)
	task, err := scanProjectionTask(row)
	if err != nil {
		return model.Task{}, err
	}
	NewTaskHandler(h.db).enrichTask(&task, &model.User{ID: userID})
	return task, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanProjectionTask(row rowScanner) (model.Task, error) {
	var task model.Task
	var ac pq.StringArray
	var assigneeID, assigneeName, dueDate sql.NullString
	var completedAt sql.NullTime
	err := row.Scan(
		&task.ID, &task.RequirementID, &task.RequirementTitle, &task.Title,
		&ac, &assigneeID, &assigneeName, &task.CreatorTLID,
		&task.Status, &task.Priority, &task.Progress, &dueDate,
		&completedAt, &task.CreatedAt, &task.UpdatedAt,
	)
	if err != nil {
		return model.Task{}, err
	}
	task.AcceptanceCriteria = []string(ac)
	task.AssigneeID = nullStringPtr(assigneeID)
	task.AssigneeName = nullStringPtr(assigneeName)
	task.DueDate = nullStringPtr(dueDate)
	task.CompletedAt = nullTimePtr(completedAt)
	return task, nil
}

func dashboardRiskItem(task model.Task, riskType string) model.DashboardRiskItem {
	item := model.DashboardRiskItem{
		Key:               task.ID + ":" + riskType,
		RelatedObjectType: "task",
		RequirementID:     task.RequirementID,
		TaskID:            task.ID,
		Target:            task.Title,
		Owner:             pointerFallback(task.AssigneeName, "未分配"),
		Deadline:          displayDate(task.DueDate),
		ActionText:        "查看任务",
		TargetURL:         fmt.Sprintf("/requirements?requirementId=%s&taskId=%s", task.RequirementID, task.ID),
	}
	item.Navigation = model.DashboardNavigationTarget{
		RequirementID: task.RequirementID,
		TaskID:        &task.ID,
		URL:           item.TargetURL,
	}
	switch riskType {
	case service.TaskRiskBlocked:
		item.RiskType = "dependency_blocker"
		item.Title = "任务存在未完成上游依赖"
		item.Source = "依赖阻塞"
		item.Reason = "等待上游任务完成：" + unfinishedDependencyNames(task)
		item.Level = "高"
		item.Tone = "red"
	case service.TaskRiskOverdue:
		item.RiskType = "deadline"
		item.Title = "任务已超过截止日期"
		item.Source = "已超期"
		item.Reason = "任务尚未完成，需要更新计划或推进状态"
		item.Level = "高"
		item.Tone = "red"
	}
	return item
}

func unfinishedDependencyNames(task model.Task) string {
	names := []string{}
	for _, dependency := range task.Dependencies {
		if dependency.Status != "done" {
			names = append(names, dependency.TaskTitle)
		}
	}
	if len(names) == 0 {
		return "未完成上游任务"
	}
	return strings.Join(names, "、")
}

func requirementRiskLabel(risk model.RequirementRiskSummary) string {
	if risk.Overdue > 0 {
		return fmt.Sprintf("%d 个任务已超期", risk.Overdue)
	}
	if risk.Blocked > 0 {
		return fmt.Sprintf("%d 个依赖阻塞", risk.Blocked)
	}
	return "正常推进"
}

func taskRiskLabel(risks []string) string {
	for _, risk := range risks {
		if risk == service.TaskRiskOverdue {
			return "已超期"
		}
	}
	for _, risk := range risks {
		if risk == service.TaskRiskBlocked {
			return "依赖阻塞"
		}
	}
	return "正常推进"
}

func requirementStatusLabel(status string) string {
	labels := map[string]string{"todo": "待开始", "review": "评审", "active": "进行中", "completed": "已完成", "cancelled": "已取消"}
	return fallback(labels[status], status)
}

func taskStatusLabel(status string) string {
	labels := map[string]string{"todo": "待办", "in_progress": "进行中", "blocked": "阻塞", "done": "已完成"}
	return fallback(labels[status], status)
}

func displayDate(value *string) string {
	if value == nil || *value == "" {
		return "未设置"
	}
	if len(*value) >= 10 {
		return (*value)[:10]
	}
	return *value
}

func recentUpdateLabel(value time.Time) string {
	now := time.Now().UTC()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	updated := value.UTC()
	updatedDay := time.Date(updated.Year(), updated.Month(), updated.Day(), 0, 0, 0, 0, time.UTC)
	days := int(today.Sub(updatedDay).Hours() / 24)
	if days <= 0 {
		return "今天更新"
	}
	if days == 1 {
		return "昨天更新"
	}
	return fmt.Sprintf("%d 天前更新", days)
}

func pointerFallback(value *string, fallbackValue string) string {
	if value == nil {
		return fallbackValue
	}
	return fallback(*value, fallbackValue)
}

func fallback(value, fallbackValue string) string {
	if strings.TrimSpace(value) == "" {
		return fallbackValue
	}
	return value
}
