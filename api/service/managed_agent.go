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

	"github.com/aidashboard/api/model"
)

type ManagedAgentClient struct {
	baseURL string
	token   string
	http    *http.Client
}

func NewManagedAgentClient(baseURL, token string) *ManagedAgentClient {
	return &ManagedAgentClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *ManagedAgentClient) Configured() bool {
	return c != nil && c.baseURL != "" && c.token != ""
}

func ValidateManagedScope(scope string) string {
	switch model.ManagedScope(scope) {
	case model.ManagedScopeMine, model.ManagedScopePublic, model.ManagedScopeAll:
		return scope
	default:
		return string(model.ManagedScopeMine)
	}
}

func (c *ManagedAgentClient) ListSkills(ctx context.Context, scope string) (*model.ListManagedSkillsResponse, error) {
	var out model.ListManagedSkillsResponse
	if err := c.do(ctx, http.MethodGet, "/api/skill/list?scope="+ValidateManagedScope(scope), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *ManagedAgentClient) ListMCPEntries(ctx context.Context, scope string) (*model.ListManagedMCPEntriesResponse, error) {
	var out model.ListManagedMCPEntriesResponse
	if err := c.do(ctx, http.MethodGet, "/api/mcp/list?scope="+ValidateManagedScope(scope), nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *ManagedAgentClient) CreateMCPEntry(ctx context.Context, req model.CreateManagedMCPEntryRequest) (*model.ManagedMCPEntry, error) {
	var out model.ManagedMCPEntry
	if err := c.do(ctx, http.MethodPost, "/api/mcp", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *ManagedAgentClient) ListMyAgents(ctx context.Context) (*model.ListManagedAgentsResponse, error) {
	var out model.ListManagedAgentsResponse
	if err := c.do(ctx, http.MethodGet, "/api/my/agents", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *ManagedAgentClient) CreateMyAgent(ctx context.Context, req model.UpsertManagedAgentRequest) (*model.UpsertManagedAgentResponse, error) {
	var out model.UpsertManagedAgentResponse
	if err := c.do(ctx, http.MethodPost, "/api/my/agents", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *ManagedAgentClient) UpdateMyAgent(ctx context.Context, agentID string, req model.UpsertManagedAgentRequest) (*model.UpsertManagedAgentResponse, error) {
	var out model.UpsertManagedAgentResponse
	if err := c.do(ctx, http.MethodPut, "/api/my/agents/"+agentID, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

type SubmitManagedTaskRequest struct {
	AgentID    string            `json:"agent_id"`
	ModelID    string            `json:"model_id,omitempty"`
	Params     map[string]string `json:"params,omitempty"`
	InputFiles []string          `json:"input_files,omitempty"`
}

type SubmitManagedTaskResponse struct {
	TaskID  string `json:"task_id"`
	Status  string `json:"status"`
	ModelID string `json:"model_id,omitempty"`
}

type ManagedTaskStatus struct {
	TaskID         string          `json:"task_id"`
	AgentID        string          `json:"agent_id"`
	AgentVersionID int             `json:"agent_version_id"`
	ModelID        string          `json:"model_id"`
	Status         string          `json:"status"`
	Result         string          `json:"result"`
	Error          string          `json:"error"`
	Progress       string          `json:"progress"`
	Raw            json.RawMessage `json:"-"`
}

func (c *ManagedAgentClient) SubmitTask(ctx context.Context, req SubmitManagedTaskRequest) (*SubmitManagedTaskResponse, error) {
	var out SubmitManagedTaskResponse
	if err := c.do(ctx, http.MethodPost, "/api/task/submit", req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *ManagedAgentClient) GetTaskResult(ctx context.Context, taskID string) (*ManagedTaskStatus, error) {
	var raw json.RawMessage
	if err := c.do(ctx, http.MethodGet, "/api/task/"+taskID+"/result", nil, &raw); err != nil {
		return nil, err
	}
	var out ManagedTaskStatus
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	out.Raw = raw
	return &out, nil
}

func (c *ManagedAgentClient) GetTaskStatus(ctx context.Context, taskID string) (*ManagedTaskStatus, error) {
	var out ManagedTaskStatus
	if err := c.do(ctx, http.MethodGet, "/api/task/"+taskID+"/status", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *ManagedAgentClient) do(ctx context.Context, method, path string, in any, out any) error {
	if !c.Configured() {
		return errors.New("managed agent platform is not configured")
	}

	var body io.Reader
	if in != nil {
		payload, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(payload)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
	if in != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("managed agent platform returned HTTP %d: %s", resp.StatusCode, truncate(string(respBody), 240))
	}
	if out == nil {
		return nil
	}
	if raw, ok := out.(*json.RawMessage); ok {
		*raw = append((*raw)[0:0], respBody...)
		return nil
	}
	if len(bytes.TrimSpace(respBody)) == 0 {
		return nil
	}
	return json.Unmarshal(respBody, out)
}

func ParseManagedReportDraft(result string) (model.GenerateReportDraftResponse, error) {
	var out model.GenerateReportDraftResponse
	raw := strings.TrimSpace(result)
	if raw == "" {
		return out, errors.New("managed agent returned empty result")
	}
	raw = stripJSONFence(raw)
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return out, err
	}
	if strings.TrimSpace(out.ReportMarkdown) == "" {
		return out, errors.New("managed agent returned empty report_markdown")
	}
	return out, nil
}

func stripJSONFence(raw string) string {
	if !strings.HasPrefix(raw, "```") {
		return raw
	}
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSpace(raw)
	raw = strings.TrimSuffix(raw, "```")
	return strings.TrimSpace(raw)
}
