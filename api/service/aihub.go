package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type AIHubClient struct {
	host         string
	serviceToken string
	httpClient   *http.Client
}

type AIHubUser struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Status   int    `json:"status"`
}

type AIHubLoginResult struct {
	Token  string
	UserID int64
}

type AIHubUserPage struct {
	Total    int         `json:"total"`
	PageSize int         `json:"page_size"`
	PageNum  int         `json:"page_num"`
	Users    []AIHubUser `json:"users"`
}

func NewAIHubClient(host, serviceToken string) *AIHubClient {
	return &AIHubClient{
		host:         strings.TrimRight(host, "/"),
		serviceToken: strings.TrimSpace(serviceToken),
		httpClient:   &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *AIHubClient) Configured() bool {
	return c != nil && c.host != ""
}

func (c *AIHubClient) Login(username, password string) (*AIHubLoginResult, error) {
	if !c.Configured() {
		return nil, fmt.Errorf("aihub host is not configured")
	}
	body, _ := json.Marshal(map[string]string{"username": username, "password": password})
	req, err := http.NewRequest(http.MethodPost, c.host+"/api/v1/auth/login", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	respBody, status, err := c.do(req)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("aihub login failed: %s", strings.TrimSpace(string(respBody)))
	}

	var raw map[string]any
	if err := json.Unmarshal(respBody, &raw); err != nil {
		return nil, fmt.Errorf("parse aihub login response: %w", err)
	}
	token := pickString(raw, "access_token", "token")
	userID := pickInt64(raw, "id", "uid", "user_id")
	if data, ok := raw["data"].(map[string]any); ok {
		if token == "" {
			token = pickString(data, "access_token", "token")
		}
		if userID == 0 {
			userID = pickInt64(data, "id", "uid", "user_id")
		}
	}
	if token == "" {
		return nil, fmt.Errorf("aihub login response missing token")
	}
	return &AIHubLoginResult{Token: token, UserID: userID}, nil
}

func (c *AIHubClient) GetUser(userID int64) (*AIHubUser, error) {
	if err := c.requireServiceToken(); err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/api/v1/users/%d", c.host, userID), nil)
	if err != nil {
		return nil, err
	}
	c.setServiceAuth(req)
	respBody, status, err := c.do(req)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("aihub get user failed: %s", strings.TrimSpace(string(respBody)))
	}
	var envelope struct {
		Code int       `json:"code"`
		Msg  string    `json:"msg"`
		Data AIHubUser `json:"data"`
	}
	if err := json.Unmarshal(respBody, &envelope); err == nil && envelope.Data.ID != 0 {
		if envelope.Code != 0 {
			return nil, fmt.Errorf("aihub get user failed: %s", envelope.Msg)
		}
		return &envelope.Data, nil
	}
	var user AIHubUser
	if err := json.Unmarshal(respBody, &user); err != nil {
		return nil, fmt.Errorf("parse aihub user response: %w", err)
	}
	return &user, nil
}

func (c *AIHubClient) ListUsers(pageSize, pageNum int, searchKey string) (*AIHubUserPage, error) {
	if err := c.requireServiceToken(); err != nil {
		return nil, err
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageNum <= 0 {
		pageNum = 1
	}
	q := url.Values{}
	q.Set("page_size", fmt.Sprint(pageSize))
	q.Set("page_num", fmt.Sprint(pageNum))
	q.Set("search_key", searchKey)
	req, err := http.NewRequest(http.MethodGet, c.host+"/api/v1/users?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	c.setServiceAuth(req)
	respBody, status, err := c.do(req)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 300 {
		return nil, fmt.Errorf("aihub list users failed: %s", strings.TrimSpace(string(respBody)))
	}
	var envelope struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
		Data struct {
			Total    int         `json:"total"`
			PageSize int         `json:"page_size"`
			PageNum  int         `json:"page_num"`
			Data     []AIHubUser `json:"data"`
		} `json:"data"`
	}
	if err := json.Unmarshal(respBody, &envelope); err == nil && (envelope.Data.Data != nil || envelope.Data.Total > 0) {
		if envelope.Code != 0 {
			return nil, fmt.Errorf("aihub list users failed: %s", envelope.Msg)
		}
		return &AIHubUserPage{
			Total: envelope.Data.Total, PageSize: envelope.Data.PageSize,
			PageNum: envelope.Data.PageNum, Users: envelope.Data.Data,
		}, nil
	}
	var page AIHubUserPage
	if err := json.Unmarshal(respBody, &page); err != nil {
		return nil, fmt.Errorf("parse aihub users response: %w", err)
	}
	return &page, nil
}

func (c *AIHubClient) requireServiceToken() error {
	if !c.Configured() {
		return fmt.Errorf("aihub host is not configured")
	}
	if c.serviceToken == "" {
		return fmt.Errorf("aihub service token is not configured")
	}
	return nil
}

func (c *AIHubClient) setServiceAuth(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+c.serviceToken)
}

func (c *AIHubClient) do(req *http.Request) ([]byte, int, error) {
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("call aihub: %w", err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return data, resp.StatusCode, nil
}

func pickString(raw map[string]any, keys ...string) string {
	for _, key := range keys {
		if v, ok := raw[key].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func pickInt64(raw map[string]any, keys ...string) int64 {
	for _, key := range keys {
		switch v := raw[key].(type) {
		case float64:
			return int64(v)
		case int64:
			return v
		case string:
			var out int64
			if _, err := fmt.Sscan(v, &out); err == nil {
				return out
			}
		}
	}
	return 0
}
