package handler

import (
	"database/sql"
	"net/http"

	"github.com/aidashboard/api/model"
	"github.com/go-chi/chi/v5"
)

type FollowHandler struct {
	db *sql.DB
}

func NewFollowHandler(db *sql.DB) *FollowHandler {
	return &FollowHandler{db: db}
}

func (h *FollowHandler) List(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	rows, err := h.db.Query(`
		SELECT user_id, target_type, target_id, created_at
		FROM user_follows
		WHERE user_id = $1
		ORDER BY created_at DESC`, u.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()
	follows := []model.UserFollow{}
	for rows.Next() {
		var follow model.UserFollow
		if err := rows.Scan(&follow.UserID, &follow.TargetType, &follow.TargetID, &follow.CreatedAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		follows = append(follows, follow)
	}
	writeJSON(w, http.StatusOK, follows)
}

func (h *FollowHandler) Follow(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	var req model.FollowRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}
	if !isFollowTargetType(req.TargetType) || req.TargetID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "target_type and target_id are required"})
		return
	}
	visible, err := h.targetVisible(u, req.TargetType, req.TargetID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if !visible {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "target not found or not visible"})
		return
	}
	if _, err := h.db.Exec(`
		INSERT INTO user_follows (user_id, target_type, target_id)
		VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING`, u.ID, req.TargetType, req.TargetID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"favorited":   true,
		"target_type": req.TargetType,
		"target_id":   req.TargetID,
	})
}

func (h *FollowHandler) Unfollow(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	targetType := chi.URLParam(r, "target_type")
	targetID := chi.URLParam(r, "target_id")
	if !isFollowTargetType(targetType) || targetID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid follow target"})
		return
	}
	if _, err := h.db.Exec(`
		DELETE FROM user_follows
		WHERE user_id = $1 AND target_type = $2 AND target_id = $3`, u.ID, targetType, targetID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"favorited":   false,
		"target_type": targetType,
		"target_id":   targetID,
	})
}

func (h *FollowHandler) targetVisible(u *model.User, targetType, targetID string) (bool, error) {
	if targetType == "requirement" {
		if u.Role == "team_leader" && u.TeamID != nil {
			var visible bool
			err := h.db.QueryRow(`
				SELECT EXISTS(
					SELECT 1 FROM requirements r
					JOIN requirement_teams rt ON rt.requirement_id = r.id
					WHERE r.id = $1 AND rt.team_id = $2
				)`, targetID, *u.TeamID).Scan(&visible)
			return visible, err
		}
		var visible bool
		err := h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM requirements WHERE id = $1)", targetID).Scan(&visible)
		return visible, err
	}

	if u.Role == "team_leader" && u.TeamID != nil {
		var visible bool
		err := h.db.QueryRow(`
			SELECT EXISTS(
				SELECT 1
				FROM tasks t
				LEFT JOIN users assignee ON assignee.id = t.assignee_id
				WHERE t.id = $1 AND (assignee.team_id = $2 OR t.creator_tl_id = $3)
			)`, targetID, *u.TeamID, u.ID).Scan(&visible)
		return visible, err
	}
	var visible bool
	err := h.db.QueryRow("SELECT EXISTS(SELECT 1 FROM tasks WHERE id = $1)", targetID).Scan(&visible)
	return visible, err
}

func isFollowTargetType(targetType string) bool {
	return targetType == "requirement" || targetType == "task"
}
