package service

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// AIHubClient talks to the AIHub unified-auth platform — the same service that
// issues tokens for the managed-agent platform. Aida delegates login and user
// resolution to it so all three callers (Aida UI, managed platform, scheduled
// Agent MCP callbacks) share one trust root.
type AIHubClient struct {
	host      string
	loginPath string // default /api/v1/auth/login
	userPath  string // default /api/v1/users/%d
	http      *http.Client
}

func NewAIHubClient(host string) *AIHubClient {
	return &AIHubClient{
		host:      strings.TrimRight(host, "/"),
		loginPath: "/api/v1/auth/login",
		userPath:  "/api/v1/users/%d",
		http:      &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *AIHubClient) Configured() bool {
	return c != nil && c.host != ""
}

type AIHubLoginData struct {
	ID    int64  `json:"id"`
	Token string `json:"token"`
}

// Login authenticates against AIHub and returns the AIHub-issued token + userId.
// The returned token is the same kind the managed-agent platform accepts.
func (c *AIHubClient) Login(ctx context.Context, username, password string) (*AIHubLoginData, error) {
	body, _ := json.Marshal(map[string]string{"username": username, "password": password})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.host+c.loginPath, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("aihub login returned HTTP %d: %s", resp.StatusCode, truncate(string(raw), 200))
	}

	var envelope struct {
		Code int64          `json:"code"`
		Msg  string         `json:"msg"`
		Data AIHubLoginData `json:"data"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("aihub login invalid response: %w", err)
	}
	if envelope.Code != 0 {
		msg := envelope.Msg
		if msg == "" {
			msg = "login rejected"
		}
		return nil, fmt.Errorf("aihub login failed: %s", msg)
	}
	if envelope.Data.Token == "" || envelope.Data.ID == 0 {
		return nil, errors.New("aihub login returned empty token or user id")
	}
	return &envelope.Data, nil
}

type AIHubRole struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	RoleType int    `json:"role_type"`
}

type AIHubRoles []AIHubRole

func (r *AIHubRoles) UnmarshalJSON(data []byte) error {
	var objects []AIHubRole
	if err := json.Unmarshal(data, &objects); err == nil {
		*r = objects
		return nil
	}
	var names []string
	if err := json.Unmarshal(data, &names); err == nil {
		roles := make([]AIHubRole, 0, len(names))
		for _, name := range names {
			roles = append(roles, AIHubRole{Name: name})
		}
		*r = roles
		return nil
	}
	if string(data) == "null" {
		*r = nil
		return nil
	}
	return errors.New("aihub roles must be objects or strings")
}

type AIHubUserInfo struct {
	ID       int64      `json:"id"`
	Username string     `json:"username"`
	Nickname string     `json:"nickname"`
	Email    string     `json:"email"`
	Roles    AIHubRoles `json:"roles"`
}

// RoleNames returns the AIHub role display names (e.g. "超级管理员", "算法").
func (u *AIHubUserInfo) RoleNames() []string {
	names := make([]string, 0, len(u.Roles))
	for _, r := range u.Roles {
		if r.Name != "" {
			names = append(names, r.Name)
		}
	}
	return names
}

// DisplayName returns the best available human name (nickname, then username).
func (u *AIHubUserInfo) DisplayName() string {
	if u.Nickname != "" {
		return u.Nickname
	}
	return u.Username
}

// GetUserInfo resolves an AIHub user by id. A 200 response also confirms the
// bearer token is valid (AIHub rejects invalid/expired tokens), so this doubles
// as token introspection for callers without the AIHub signing secret.
func (c *AIHubClient) GetUserInfo(ctx context.Context, userID int64, token string) (*AIHubUserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.host+fmt.Sprintf(c.userPath, userID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == http.StatusUnauthorized {
		return nil, errors.New("aihub token rejected")
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("aihub userinfo returned HTTP %d: %s", resp.StatusCode, truncate(string(raw), 200))
	}

	var envelope struct {
		Code int64         `json:"code"`
		Msg  string        `json:"msg"`
		Data AIHubUserInfo `json:"data"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("aihub userinfo invalid response: %w", err)
	}
	if envelope.Code != 0 {
		return nil, fmt.Errorf("aihub userinfo failed: %s", envelope.Msg)
	}
	return &envelope.Data, nil
}
