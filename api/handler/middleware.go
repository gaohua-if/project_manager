package handler

import (
	"context"
	"database/sql"
	"net/http"
	"strings"

	"github.com/aidashboard/api/model"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const userKey contextKey = "user"

func AuthMiddleware(db *sql.DB, jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authorization header"})
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenStr == authHeader {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid authorization format"})
				return
			}

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
				return []byte(jwtSecret), nil
			})
			if err != nil || !token.Valid {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token"})
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid claims"})
				return
			}
			id, ok := claims["id"].(string)
			if !ok || id == "" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid claims"})
				return
			}

			user, err := loadActiveUser(db, id)
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token"})
				return
			}
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if user.Status != "active" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "account deactivated"})
				return
			}

			ctx := context.WithValue(r.Context(), userKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func loadActiveUser(db *sql.DB, id string) (*model.User, error) {
	var user model.User
	var deactivatedAt sql.NullTime
	err := db.QueryRow(`
		SELECT u.id, u.employee_id, COALESCE(u.email,''), u.name, u.role, u.team_id,
			COALESCE((SELECT name FROM teams WHERE id = u.team_id), ''), u.status, u.deactivated_at, u.created_at
		FROM users u WHERE u.id = $1`, id).Scan(
		&user.ID, &user.EmployeeID, &user.Email, &user.Name, &user.Role, &user.TeamID, &user.TeamName,
		&user.Status, &deactivatedAt, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	assignUserDeactivatedAt(&user, deactivatedAt)
	return &user, nil
}

func getUser(r *http.Request) *model.User {
	u, _ := r.Context().Value(userKey).(*model.User)
	return u
}

func requireRoles(next http.HandlerFunc, roles ...string) http.HandlerFunc {
	roleSet := make(map[string]bool, len(roles))
	for _, r := range roles {
		roleSet[r] = true
	}
	return func(w http.ResponseWriter, r *http.Request) {
		u := getUser(r)
		if u == nil || !roleSet[u.Role] {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "insufficient permissions"})
			return
		}
		next(w, r)
	}
}

// AdminOnly gates a route to the admin role. Use as middleware on chi sub-routers.
func AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u := getUser(r)
		if u == nil || u.Role != "admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "admin only"})
			return
		}
		next.ServeHTTP(w, r)
	})
}
