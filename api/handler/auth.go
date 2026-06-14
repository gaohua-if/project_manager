package handler

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/golang-jwt/jwt/v5"
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
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	var u model.User
	err := h.db.QueryRow(`
		SELECT id, name, role, team_id,
			COALESCE((SELECT name FROM teams WHERE id = users.team_id), '') as team_name
		FROM users WHERE name = $1`, req.Name).Scan(
		&u.ID, &u.Name, &u.Role, &u.TeamID, &u.TeamName,
	)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "user not found"})
		return
	}

	claims := jwt.MapClaims{
		"id":      u.ID,
		"name":    u.Name,
		"role":    u.Role,
		"team_id": "",
	}
	if u.TeamID != nil {
		claims["team_id"] = *u.TeamID
	}
	claims["exp"] = time.Now().Add(7 * 24 * time.Hour).Unix()
	claims["iat"] = time.Now().Unix()

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(h.jwtSecret))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "token generation failed"})
		return
	}

	writeJSON(w, http.StatusOK, model.LoginResponse{Token: tokenStr, User: u})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	if u == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	var teamName *string
	if u.TeamID != nil {
		var tn string
		h.db.QueryRow("SELECT name FROM teams WHERE id = $1", *u.TeamID).Scan(&tn)
		teamName = &tn
	}

	writeJSON(w, http.StatusOK, &model.User{
		ID:       u.ID,
		Name:     u.Name,
		Role:     u.Role,
		TeamID:   u.TeamID,
		TeamName: teamName,
	})
}

func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT u.id, u.name, u.role, u.team_id,
			COALESCE((SELECT name FROM teams WHERE id = u.team_id), '') as team_name
		FROM users u ORDER BY u.role, u.name`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	users := []model.User{}
	for rows.Next() {
		var u model.User
		rows.Scan(&u.ID, &u.Name, &u.Role, &u.TeamID, &u.TeamName)
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, users)
}
