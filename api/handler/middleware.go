package handler

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const userKey contextKey = "user"

func AuthMiddleware(db *sql.DB, aiHubSecret string, aihub *service.AIHubClient) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "missing authorization header"})
				return
			}
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenStr == authHeader || strings.TrimSpace(tokenStr) == "" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid authorization format"})
				return
			}
			uid, err := extractAIHubUID(tokenStr, aiHubSecret)
			if err != nil || uid == 0 {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token"})
				return
			}
			user, err := loadAidaUserByID(db, fmt.Sprint(uid))
			if err == sql.ErrNoRows {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "user is not synchronized"})
				return
			}
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			if !user.LocalEnabled {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "Aida access disabled"})
				return
			}
			ctx := context.WithValue(r.Context(), userKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func extractAIHubUID(tokenString, secret string) (int64, error) {
	claims := jwt.MapClaims{}
	if secret == "" {
		_, _, err := jwt.NewParser().ParseUnverified(tokenString, claims)
		if err != nil {
			return 0, err
		}
		return uidFromClaims(claims)
	}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return 0, err
	}
	return uidFromClaims(claims)
}

func uidFromClaims(claims jwt.MapClaims) (int64, error) {
	for _, key := range []string{"uid", "userId", "user_id", "sub", "id"} {
		if v, ok := claims[key]; ok {
			switch value := v.(type) {
			case float64:
				return int64(value), nil
			case int64:
				return value, nil
			case string:
				return parseUserID(value), nil
			}
		}
	}
	return 0, fmt.Errorf("uid not found")
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
