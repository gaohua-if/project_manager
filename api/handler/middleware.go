package handler

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
)

type contextKey string

const userKey contextKey = "user"

// userInfoCache memoizes a successful AIHub introspection per token for a short
// window, so the middleware does not call AIHub on every request.
type userInfoCache struct {
	ttl     time.Duration
	mu      sync.RWMutex
	entries map[string]userInfoCacheEntry
}
type userInfoCacheEntry struct {
	at   time.Time
	info *service.AIHubUserInfo
}

func newUserInfoCache(ttl time.Duration) *userInfoCache {
	return &userInfoCache{ttl: ttl, entries: map[string]userInfoCacheEntry{}}
}

func (c *userInfoCache) get(token string) (*service.AIHubUserInfo, bool) {
	if c == nil {
		return nil, false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	if e, ok := c.entries[token]; ok && time.Since(e.at) < c.ttl {
		return e.info, true
	}
	return nil, false
}

func (c *userInfoCache) set(token string, info *service.AIHubUserInfo) {
	if c == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[token] = userInfoCacheEntry{at: time.Now(), info: info}
}

// resolveAIHubUser returns the AIHub userId for the bearer token.
// If AIHUB_JWT_SECRET is configured the token is verified locally; otherwise the
// uid is read unverified and confirmed by AIHub introspection.
func resolveAIHubUser(ctx context.Context, client *service.AIHubClient, secret, token string, cache *userInfoCache) (int64, *service.AIHubUserInfo, error) {
	if secret != "" {
		uid, err := service.VerifyAIHubToken(token, secret)
		if err != nil {
			return 0, nil, err
		}
		// Still resolve display info (cached) for friendly names.
		if info, ok := cache.get(token); ok {
			return uid, info, nil
		}
		info, err := client.GetUserInfo(ctx, uid, token)
		if err != nil {
			return uid, nil, nil // verified identity is enough; display is best-effort
		}
		cache.set(token, info)
		return uid, info, nil
	}

	// No local secret: unverified uid + introspection.
	uid, err := service.ParseAIHubUID(token)
	if err != nil {
		return 0, nil, err
	}
	if info, ok := cache.get(token); ok {
		return info.ID, info, nil
	}
	info, err := client.GetUserInfo(ctx, uid, token)
	if err != nil {
		return 0, nil, err
	}
	cache.set(token, info)
	return info.ID, info, nil
}

// upsertAidaUser ensures a users row exists for the AIHub userId and returns it.
// Rows are created lazily on first sight with the default employee role.
func upsertAidaUser(db *sql.DB, uid int64, info *service.AIHubUserInfo) (*model.User, error) {
	var (
		id                               int64
		aihubUsername, email, name, role sql.NullString
		teamID                           sql.NullString
		teamName                         sql.NullString
	)
	err := db.QueryRow(`
		INSERT INTO users (id, name, aihub_username, email, role)
		VALUES ($1, $2, $3, $4, 'employee')
		ON CONFLICT (id) DO UPDATE SET
			name = COALESCE(NULLIF(users.name, ''), EXCLUDED.name),
			aihub_username = COALESCE(EXCLUDED.aihub_username, users.aihub_username),
			email = COALESCE(NULLIF(users.email, ''), EXCLUDED.email)
		RETURNING id, COALESCE(aihub_username,''), COALESCE(email,''), name, role, team_id,
			COALESCE((SELECT name FROM teams WHERE id = users.team_id), '')`,
		uid, displayName(info), username(info), emailOf(info),
	).Scan(&id, &aihubUsername, &email, &name, &role, &teamID, &teamName)
	if err != nil {
		return nil, err
	}
	u := &model.User{
		ID:            id,
		AIHubUsername: aihubUsername.String,
		Email:         email.String,
		Name:          name.String,
		Role:          role.String,
	}
	if teamID.Valid {
		t := teamID.String
		u.TeamID = &t
	}
	if teamName.Valid && teamName.String != "" {
		s := teamName.String
		u.TeamName = &s
	}
	return u, nil
}

func displayName(info *service.AIHubUserInfo) string {
	if info == nil {
		return ""
	}
	return info.DisplayName()
}
func username(info *service.AIHubUserInfo) string {
	if info == nil {
		return ""
	}
	return info.Username
}
func emailOf(info *service.AIHubUserInfo) string {
	if info == nil {
		return ""
	}
	return info.Email
}

// AuthMiddleware validates an AIHub-issued bearer token (local verify when
// AIHUB_JWT_SECRET is set, else AIHub introspection) and resolves the Aida user.
func AuthMiddleware(db *sql.DB, client *service.AIHubClient, secret string) func(http.Handler) http.Handler {
	cache := newUserInfoCache(30 * time.Second)
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
			if client == nil || !client.Configured() {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AIHub auth is not configured"})
				return
			}

			uid, info, err := resolveAIHubUser(r.Context(), client, secret, tokenStr, cache)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid token"})
				return
			}

			u, err := upsertAidaUser(db, uid, info)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			ctx := context.WithValue(r.Context(), userKey, u)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
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
