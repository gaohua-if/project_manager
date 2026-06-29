package handler

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
	"github.com/go-chi/chi/v5"
)

type AuthHandler struct {
	db     *sql.DB
	aihub  *service.AIHubClient
	secret string // optional AIHub JWT secret for local verify
}

func NewAuthHandler(db *sql.DB, aihub *service.AIHubClient, secret string) *AuthHandler {
	return &AuthHandler{db: db, aihub: aihub, secret: secret}
}

// Login authenticates against AIHub and returns the AIHub token + the Aida user.
// The returned token is the same kind the managed-agent platform and the
// scheduled-Agent MCP callbacks accept.
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req model.LoginRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username and password are required"})
		return
	}
	if h.aihub == nil || !h.aihub.Configured() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AIHub auth is not configured"})
		return
	}

	login, err := h.aihub.Login(r.Context(), req.Username, req.Password)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid username or password"})
		return
	}

	var info *service.AIHubUserInfo
	// Confirm the token + resolve display info via AIHub (also validates it).
	if resolved, err := h.aihub.GetUserInfo(r.Context(), login.ID, login.Token); err == nil {
		info = resolved
	}

	u, err := upsertAidaUser(h.db, login.ID, info)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, model.LoginResponse{Token: login.Token, User: *u})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	if u == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT u.id, COALESCE(u.aihub_username,''), COALESCE(u.email,''), u.name, u.role, u.team_id,
			COALESCE((SELECT name FROM teams WHERE id = u.team_id), '')
		FROM users u ORDER BY u.role, u.name`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	users := []model.User{}
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.AIHubUsername, &u.Email, &u.Name, &u.Role, &u.TeamID, &u.TeamName); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *AuthHandler) ListTeams(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query("SELECT id, name FROM teams ORDER BY name")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	type teamRow struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	teams := []teamRow{}
	for rows.Next() {
		var t teamRow
		if err := rows.Scan(&t.ID, &t.Name); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		teams = append(teams, t)
	}
	writeJSON(w, http.StatusOK, teams)
}

// AdminUpdateUser allows admin to assign role and/or team. id is the AIHub userId.
func (h *AuthHandler) AdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	targetID, ok := parseUserIDParam(r, "id")
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user id"})
		return
	}
	current := getUser(r)
	if current == nil || current.Role != "admin" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "admin only"})
		return
	}
	if targetID == current.ID {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "不能修改自己的角色或团队"})
		return
	}

	var req model.AdminUpdateUserRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Role != nil {
		switch *req.Role {
		case "admin", "director", "pm", "team_leader", "employee":
		default:
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid role"})
			return
		}
		if _, err := h.db.Exec("UPDATE users SET role = $1 WHERE id = $2", *req.Role, targetID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}

	switch {
	case req.ClearTeam:
		if _, err := h.db.Exec("UPDATE users SET team_id = NULL WHERE id = $1", targetID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	case req.TeamID != nil && *req.TeamID != "":
		if _, err := h.db.Exec("UPDATE users SET team_id = $1 WHERE id = $2", *req.TeamID, targetID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
	}

	h.getUserAndWrite(w, targetID)
}

func (h *AuthHandler) getUserAndWrite(w http.ResponseWriter, id int64) {
	var u model.User
	err := h.db.QueryRow(`
		SELECT u.id, COALESCE(u.aihub_username,''), COALESCE(u.email,''), u.name, u.role, u.team_id,
			COALESCE((SELECT name FROM teams WHERE id = u.team_id), '')
		FROM users u WHERE u.id = $1`, id).Scan(
		&u.ID, &u.AIHubUsername, &u.Email, &u.Name, &u.Role, &u.TeamID, &u.TeamName,
	)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func parseUserIDParam(r *http.Request, key string) (int64, bool) {
	v := chi.URLParam(r, key)
	id, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return 0, false
	}
	return id, true
}
