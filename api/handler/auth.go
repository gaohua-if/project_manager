package handler

import (
	"database/sql"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

var (
	employeeIDRe = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)
	emailRe      = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
)

type AuthHandler struct {
	db        *sql.DB
	jwtSecret string
}

func NewAuthHandler(db *sql.DB, jwtSecret string) *AuthHandler {
	return &AuthHandler{db: db, jwtSecret: jwtSecret}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req model.LoginRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	req.EmployeeID = strings.TrimSpace(req.EmployeeID)
	if req.EmployeeID == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "employee_id and password are required"})
		return
	}

	var u model.User
	var passwordHash string
	err := h.db.QueryRow(`
		SELECT id, employee_id, COALESCE(email,''), name, role, team_id, password_hash,
			COALESCE((SELECT name FROM teams WHERE id = users.team_id), '')
		FROM users WHERE employee_id = $1`, req.EmployeeID).Scan(
		&u.ID, &u.EmployeeID, &u.Email, &u.Name, &u.Role, &u.TeamID, &passwordHash, &u.TeamName,
	)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid employee_id or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid employee_id or password"})
		return
	}

	token, err := h.issueToken(&u)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token generation failed"})
		return
	}

	writeJSON(w, http.StatusOK, model.LoginResponse{Token: token, User: u})
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req model.RegisterRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	req.EmployeeID = strings.TrimSpace(req.EmployeeID)
	req.Email = strings.TrimSpace(req.Email)
	req.Name = strings.TrimSpace(req.Name)

	if !employeeIDRe.MatchString(req.EmployeeID) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "工号只能包含字母、数字、下划线"})
		return
	}
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "姓名不能为空"})
		return
	}
	if !emailRe.MatchString(req.Email) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "邮箱格式不正确"})
		return
	}
	if len(req.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "密码至少 8 位"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "password hash failed"})
		return
	}

	var u model.User
	err = h.db.QueryRow(`
		INSERT INTO users (employee_id, email, name, role, password_hash)
		VALUES ($1, $2, $3, 'employee', $4)
		RETURNING id, employee_id, COALESCE(email,''), name, role, team_id`,
		req.EmployeeID, req.Email, req.Name, string(hash),
	).Scan(&u.ID, &u.EmployeeID, &u.Email, &u.Name, &u.Role, &u.TeamID)
	if err != nil {
		if isUniqueViolation(err) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "工号或邮箱已被注册"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	token, err := h.issueToken(&u)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token generation failed"})
		return
	}
	writeJSON(w, http.StatusCreated, model.LoginResponse{Token: token, User: u})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	if u == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	var email string
	var teamName *string
	if u.TeamID != nil {
		var tn string
		h.db.QueryRow("SELECT name FROM teams WHERE id = $1", *u.TeamID).Scan(&tn)
		teamName = &tn
	}
	h.db.QueryRow("SELECT COALESCE(email,'') FROM users WHERE id = $1", u.ID).Scan(&email)

	writeJSON(w, http.StatusOK, &model.User{
		ID:         u.ID,
		EmployeeID: u.EmployeeID,
		Email:      email,
		Name:       u.Name,
		Role:       u.Role,
		TeamID:     u.TeamID,
		TeamName:   teamName,
	})
}

func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT u.id, u.employee_id, COALESCE(u.email,''), u.name, u.role, u.team_id,
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
		if err := rows.Scan(&u.ID, &u.EmployeeID, &u.Email, &u.Name, &u.Role, &u.TeamID, &u.TeamName); err != nil {
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

func (h *AuthHandler) ListTaskAssignees(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	if u == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	query := `
		SELECT u.id, u.employee_id, COALESCE(u.email,''), u.name, u.role, u.team_id,
			COALESCE((SELECT name FROM teams WHERE id = u.team_id), '')
		FROM users u
		WHERE u.role = 'employee'`
	args := []any{}
	switch u.Role {
	case "admin", "director", "pm":
	case "team_leader":
		if u.TeamID == nil {
			writeJSON(w, http.StatusOK, []model.User{})
			return
		}
		query += " AND u.team_id = $1"
		args = append(args, *u.TeamID)
	case "employee":
		query += " AND u.id = $1"
		args = append(args, u.ID)
	default:
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions"})
		return
	}
	query += " ORDER BY u.name"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	users := []model.User{}
	for rows.Next() {
		var item model.User
		if err := rows.Scan(&item.ID, &item.EmployeeID, &item.Email, &item.Name, &item.Role, &item.TeamID, &item.TeamName); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		users = append(users, item)
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

// AdminUpdateUser allows admin to assign role and/or team.
// ClearTeam=true clears team_id; otherwise TeamID (when provided) sets it.
func (h *AuthHandler) AdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "id")
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
	}

	if req.Role != nil {
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

func (h *AuthHandler) AdminResetPassword(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "id")
	current := getUser(r)
	if current == nil || current.Role != "admin" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "admin only"})
		return
	}

	var req model.AdminResetPasswordRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if len(req.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "密码至少 8 位"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "hash failed"})
		return
	}
	if _, err := h.db.Exec("UPDATE users SET password_hash = $1 WHERE id = $2", string(hash), targetID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *AuthHandler) getUserAndWrite(w http.ResponseWriter, id string) {
	var u model.User
	err := h.db.QueryRow(`
		SELECT u.id, u.employee_id, COALESCE(u.email,''), u.name, u.role, u.team_id,
			COALESCE((SELECT name FROM teams WHERE id = u.team_id), '')
		FROM users u WHERE u.id = $1`, id).Scan(
		&u.ID, &u.EmployeeID, &u.Email, &u.Name, &u.Role, &u.TeamID, &u.TeamName,
	)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (h *AuthHandler) issueToken(u *model.User) (string, error) {
	claims := jwt.MapClaims{
		"id":          u.ID,
		"employee_id": u.EmployeeID,
		"name":        u.Name,
		"role":        u.Role,
		"team_id":     "",
	}
	if u.TeamID != nil {
		claims["team_id"] = *u.TeamID
	}
	claims["exp"] = time.Now().Add(7 * 24 * time.Hour).Unix()
	claims["iat"] = time.Now().Unix()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.jwtSecret))
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "23505"
	}
	return false
}
