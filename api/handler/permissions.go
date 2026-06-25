package handler

import (
	"database/sql"

	"github.com/aidashboard/api/model"
)

func isGlobalRequirementManager(role string) bool {
	return role == "admin" || role == "director" || role == "pm"
}

func isGlobalTaskManager(role string) bool {
	return role == "admin" || role == "director" || role == "pm"
}

func hasTeam(user *model.User) bool {
	return user != nil && user.TeamID != nil && *user.TeamID != ""
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func (h *RequirementHandler) canViewRequirement(u *model.User, requirementID string) (bool, error) {
	if u == nil {
		return false, nil
	}
	if isGlobalRequirementManager(u.Role) {
		return h.requirementExists(requirementID)
	}
	if !hasTeam(u) {
		return false, nil
	}
	var allowed bool
	query := `
		SELECT EXISTS(
			SELECT 1 FROM requirements r
			WHERE r.id = $1
			  AND (EXISTS (
				SELECT 1 FROM requirement_teams rt
				WHERE rt.requirement_id = r.id AND rt.team_id = $2
			  )`
	if u.Role == "team_leader" {
		query += ` OR r.creator_id = $3`
	}
	query += `))`
	if u.Role == "team_leader" {
		return allowed, h.db.QueryRow(query, requirementID, *u.TeamID, u.ID).Scan(&allowed)
	}
	return allowed, h.db.QueryRow(query, requirementID, *u.TeamID).Scan(&allowed)
}

func (h *RequirementHandler) canCreateRequirement(u *model.User, teamIDs []string) bool {
	if u == nil {
		return false
	}
	if isGlobalRequirementManager(u.Role) {
		return true
	}
	if u.Role != "team_leader" || !hasTeam(u) {
		return false
	}
	if len(teamIDs) != 1 {
		return false
	}
	return teamIDs[0] == *u.TeamID
}

func (h *RequirementHandler) canManageRequirement(u *model.User, requirementID string) (bool, error) {
	if u == nil {
		return false, nil
	}
	if isGlobalRequirementManager(u.Role) {
		return h.requirementExists(requirementID)
	}
	if u.Role != "team_leader" {
		return false, nil
	}
	return h.canViewRequirement(u, requirementID)
}

func (h *RequirementHandler) requirementExists(requirementID string) (bool, error) {
	var exists bool
	err := h.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM requirements WHERE id = $1)`, requirementID).Scan(&exists)
	return exists, err
}

type taskAccessRecord struct {
	ID            string
	RequirementID string
	AssigneeID    sql.NullString
	CreatorTLID   string
}

func (h *TaskHandler) loadTaskAccess(taskID string) (taskAccessRecord, error) {
	var task taskAccessRecord
	err := h.db.QueryRow(`
		SELECT id, requirement_id, assignee_id, creator_tl_id
		FROM tasks
		WHERE id = $1`, taskID).Scan(&task.ID, &task.RequirementID, &task.AssigneeID, &task.CreatorTLID)
	return task, err
}

func (h *TaskHandler) canViewTask(u *model.User, taskID string) (bool, error) {
	task, err := h.loadTaskAccess(taskID)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return h.canViewTaskRecord(u, task)
}

func (h *TaskHandler) canViewTaskRecord(u *model.User, task taskAccessRecord) (bool, error) {
	if u == nil {
		return false, nil
	}
	if isGlobalTaskManager(u.Role) {
		return true, nil
	}
	if !hasTeam(u) {
		return false, nil
	}
	var allowed bool
	query := `
		SELECT EXISTS(
			SELECT 1
			WHERE EXISTS (
				SELECT 1 FROM requirement_teams rt
				WHERE rt.requirement_id = $1 AND rt.team_id = $2
			)`
	if u.Role == "team_leader" {
		query += `
			OR EXISTS (
				SELECT 1 FROM users assignee
				WHERE assignee.id = $3 AND assignee.team_id = $2
			)
			OR $4 = $5`
		err := h.db.QueryRow(query+`)`, task.RequirementID, *u.TeamID, task.AssigneeID, task.CreatorTLID, u.ID).Scan(&allowed)
		return allowed, err
	}
	err := h.db.QueryRow(query+`)`, task.RequirementID, *u.TeamID).Scan(&allowed)
	return allowed, err
}

func (h *TaskHandler) canCreateTask(u *model.User, requirementID string, assigneeID *string) (bool, string, error) {
	if u == nil {
		return false, "insufficient permissions to create tasks", nil
	}
	if requirementID == "" {
		return false, "requirement_id and title required", nil
	}
	if assigneeID == nil || *assigneeID == "" {
		return false, "assignee_id is required", nil
	}
	switch u.Role {
	case "admin", "director", "pm":
		var ok bool
		err := h.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM requirements WHERE id = $1)`, requirementID).Scan(&ok)
		if err != nil || !ok {
			return ok, "requirement not found", err
		}
		err = h.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, *assigneeID).Scan(&ok)
		if err != nil || !ok {
			return ok, "assignee not found", err
		}
		return true, "", nil
	case "team_leader":
		if !hasTeam(u) {
			return false, "team leader must belong to a team", nil
		}
		var ok bool
		err := h.db.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM requirement_teams
				WHERE requirement_id = $1 AND team_id = $2
			)`, requirementID, *u.TeamID).Scan(&ok)
		if err != nil || !ok {
			return ok, "requirement is not assigned to your team", err
		}
		err = h.db.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM users
				WHERE id = $1 AND role = 'employee' AND team_id = $2
			)`, *assigneeID, *u.TeamID).Scan(&ok)
		if err != nil || !ok {
			return ok, "assignee must be an employee in your team", err
		}
		return true, "", nil
	case "employee":
		if !hasTeam(u) || *assigneeID != u.ID {
			return false, "employee can only create tasks assigned to self", nil
		}
		var ok bool
		err := h.db.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM requirement_teams
				WHERE requirement_id = $1 AND team_id = $2
			)`, requirementID, *u.TeamID).Scan(&ok)
		if err != nil || !ok {
			return ok, "requirement is not assigned to your team", err
		}
		return true, "", nil
	default:
		return false, "insufficient permissions to create tasks", nil
	}
}

func (h *TaskHandler) canManageTask(u *model.User, task taskAccessRecord) (bool, error) {
	if u == nil {
		return false, nil
	}
	if isGlobalTaskManager(u.Role) {
		return true, nil
	}
	if u.Role == "employee" {
		return task.AssigneeID.Valid && task.AssigneeID.String == u.ID, nil
	}
	if u.Role != "team_leader" || !hasTeam(u) {
		return false, nil
	}
	var allowed bool
	err := h.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1
			WHERE $1 = $2
			   OR EXISTS(
					SELECT 1 FROM users assignee
					WHERE assignee.id = $3 AND assignee.team_id = $4
			   )
			   OR EXISTS(
					SELECT 1 FROM requirement_teams rt
					WHERE rt.requirement_id = $5 AND rt.team_id = $4
			   )
		)`, task.CreatorTLID, u.ID, task.AssigneeID, *u.TeamID, task.RequirementID).Scan(&allowed)
	return allowed, err
}

func (h *TaskHandler) canReassignTask(u *model.User, assigneeID *string) (bool, string, error) {
	if u == nil {
		return false, "insufficient permissions to reassign task", nil
	}
	if u.Role == "employee" {
		return false, "employee cannot reassign tasks", nil
	}
	if assigneeID == nil || *assigneeID == "" {
		return true, "", nil
	}
	var ok bool
	var err error
	if isGlobalTaskManager(u.Role) {
		err = h.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, *assigneeID).Scan(&ok)
	} else if u.Role == "team_leader" && hasTeam(u) {
		err = h.db.QueryRow(`
			SELECT EXISTS(
				SELECT 1 FROM users
				WHERE id = $1 AND role = 'employee' AND team_id = $2
			)`, *assigneeID, *u.TeamID).Scan(&ok)
	} else {
		return false, "insufficient permissions to reassign task", nil
	}
	if err != nil || !ok {
		return ok, "assignee must be an employee in your team", err
	}
	return true, "", nil
}
