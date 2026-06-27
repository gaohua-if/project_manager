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
	db                   *sql.DB
	jwtSecret            string
	enablePublicRegister bool
}

func NewAuthHandler(db *sql.DB, jwtSecret string, enablePublicRegister bool) *AuthHandler {
	return &AuthHandler{db: db, jwtSecret: jwtSecret, enablePublicRegister: enablePublicRegister}
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
	var deactivatedAt sql.NullTime
	err := h.db.QueryRow(`
		SELECT id, employee_id, COALESCE(email,''), name, role, team_id, password_hash,
			COALESCE((SELECT name FROM teams WHERE id = users.team_id), ''), status, deactivated_at, created_at
		FROM users WHERE employee_id = $1`, req.EmployeeID).Scan(
		&u.ID, &u.EmployeeID, &u.Email, &u.Name, &u.Role, &u.TeamID, &passwordHash, &u.TeamName, &u.Status, &deactivatedAt, &u.CreatedAt,
	)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid employee_id or password"})
		return
	}
	assignUserDeactivatedAt(&u, deactivatedAt)
	if u.Status != "active" {
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
	if !h.enablePublicRegister {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "公开注册已关闭，请联系管理员创建账号"})
		return
	}

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
	var deactivatedAt sql.NullTime
	err = h.db.QueryRow(`
		INSERT INTO users (employee_id, email, name, role, password_hash)
		VALUES ($1, $2, $3, 'employee', $4)
		RETURNING id, employee_id, COALESCE(email,''), name, role, team_id, status, deactivated_at, created_at`,
		req.EmployeeID, req.Email, req.Name, string(hash),
	).Scan(&u.ID, &u.EmployeeID, &u.Email, &u.Name, &u.Role, &u.TeamID, &u.Status, &deactivatedAt, &u.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "工号或邮箱已被注册"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	assignUserDeactivatedAt(&u, deactivatedAt)

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

	writeJSON(w, http.StatusOK, h.currentUser(r))
}

func (h *AuthHandler) currentUser(r *http.Request) *model.User {
	u := getUser(r)
	if u == nil {
		return nil
	}
	return &model.User{
		ID:            u.ID,
		EmployeeID:    u.EmployeeID,
		Email:         u.Email,
		Name:          u.Name,
		Role:          u.Role,
		TeamID:        u.TeamID,
		TeamName:      u.TeamName,
		Status:        u.Status,
		DeactivatedAt: u.DeactivatedAt,
		CreatedAt:     u.CreatedAt,
	}
}

func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT u.id, u.employee_id, COALESCE(u.email,''), u.name, u.role, u.team_id,
			COALESCE((SELECT name FROM teams WHERE id = u.team_id), ''), u.status, u.deactivated_at, u.created_at
		FROM users u ORDER BY u.role, u.name`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	users := []model.User{}
	for rows.Next() {
		var u model.User
		if err := scanUser(rows, &u); err != nil {
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
			COALESCE((SELECT name FROM teams WHERE id = u.team_id), ''), u.status, u.deactivated_at, u.created_at
		FROM users u
		WHERE u.role = 'employee' AND u.status = 'active'`
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
		if err := scanUser(rows, &item); err != nil {
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

func (h *AuthHandler) AdminCreateUser(w http.ResponseWriter, r *http.Request) {
	var req model.AdminCreateUserRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	req.EmployeeID = strings.TrimSpace(req.EmployeeID)
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.TrimSpace(req.Email)
	req.Role = strings.TrimSpace(req.Role)
	if req.TeamID != nil {
		trimmed := strings.TrimSpace(*req.TeamID)
		req.TeamID = &trimmed
	}

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
	if !isValidRole(req.Role) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid role"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "hash failed"})
		return
	}

	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	if req.TeamID != nil && *req.TeamID != "" {
		var exists bool
		if err := tx.QueryRowContext(r.Context(), "SELECT EXISTS(SELECT 1 FROM teams WHERE id::text = $1)", *req.TeamID).Scan(&exists); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if !exists {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "团队不存在"})
			return
		}
	}

	var u model.User
	var deactivatedAt sql.NullTime
	err = tx.QueryRowContext(r.Context(), `
		INSERT INTO users (employee_id, email, name, role, team_id, password_hash)
		VALUES ($1, $2, $3, $4, NULLIF($5, '')::uuid, $6)
		RETURNING id, employee_id, COALESCE(email,''), name, role, team_id,
			COALESCE((SELECT name FROM teams WHERE id = users.team_id), ''), status, deactivated_at, created_at`,
		req.EmployeeID, req.Email, req.Name, req.Role, stringValue(req.TeamID), string(hash),
	).Scan(&u.ID, &u.EmployeeID, &u.Email, &u.Name, &u.Role, &u.TeamID, &u.TeamName, &u.Status, &deactivatedAt, &u.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "工号或邮箱已被注册"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	assignUserDeactivatedAt(&u, deactivatedAt)
	writeJSON(w, http.StatusCreated, u)
}

func (h *AuthHandler) AdminCreateTeam(w http.ResponseWriter, r *http.Request) {
	var req model.AdminCreateTeamRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "团队名称不能为空"})
		return
	}

	var team model.Team
	err := h.db.QueryRowContext(r.Context(), `
		INSERT INTO teams (name)
		VALUES ($1)
		RETURNING id, name, created_at`, req.Name).Scan(&team.ID, &team.Name, &team.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "团队名称已存在"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, team)
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
		if !isValidRole(*req.Role) {
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

func (h *AuthHandler) AdminUpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "id")
	current := getUser(r)
	if current == nil || current.Role != "admin" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "admin only"})
		return
	}

	var req model.AdminUpdateUserStatusRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	req.Status = strings.TrimSpace(req.Status)
	if !isValidUserStatus(req.Status) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status"})
		return
	}
	if targetID == current.ID && req.Status == "deactivated" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "不能停用自己的账号"})
		return
	}

	res, err := h.db.Exec(`
		UPDATE users
		SET status = $1,
			deactivated_at = CASE WHEN $1 = 'deactivated' THEN COALESCE(deactivated_at, now()) ELSE NULL END
		WHERE id = $2`, req.Status, targetID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
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
	var deactivatedAt sql.NullTime
	err := h.db.QueryRow(`
		SELECT u.id, u.employee_id, COALESCE(u.email,''), u.name, u.role, u.team_id,
			COALESCE((SELECT name FROM teams WHERE id = u.team_id), ''), u.status, u.deactivated_at, u.created_at
		FROM users u WHERE u.id = $1`, id).Scan(
		&u.ID, &u.EmployeeID, &u.Email, &u.Name, &u.Role, &u.TeamID, &u.TeamName, &u.Status, &deactivatedAt, &u.CreatedAt,
	)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	assignUserDeactivatedAt(&u, deactivatedAt)
	writeJSON(w, http.StatusOK, u)
}

func assignUserDeactivatedAt(u *model.User, value sql.NullTime) {
	if value.Valid {
		u.DeactivatedAt = &value.Time
	}
}

func scanUser(rows interface {
	Scan(dest ...any) error
}, u *model.User) error {
	var deactivatedAt sql.NullTime
	if err := rows.Scan(&u.ID, &u.EmployeeID, &u.Email, &u.Name, &u.Role, &u.TeamID, &u.TeamName, &u.Status, &deactivatedAt, &u.CreatedAt); err != nil {
		return err
	}
	assignUserDeactivatedAt(u, deactivatedAt)
	return nil
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

func isValidRole(role string) bool {
	switch role {
	case "admin", "director", "pm", "team_leader", "employee":
		return true
	default:
		return false
	}
}

func isValidUserStatus(status string) bool {
	return status == "active" || status == "deactivated"
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Code == "23505"
	}
	return false
}
