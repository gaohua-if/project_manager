package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

type AIClient struct {
	Binary  string
	Timeout time.Duration
}

func NewAIClient() *AIClient {
	timeout := 10 * time.Minute
	if v := envDuration("AI_TIMEOUT"); v > 0 {
		timeout = v
	}
	binary := "claude"
	if v := getenv("AI_BINARY"); v != "" {
		binary = v
	}
	return &AIClient{Binary: binary, Timeout: timeout}
}

type TaskBrief struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type MatchResult struct {
	TaskID     string  `json:"task_id"`
	Confidence float64 `json:"confidence"`
}

func (c *AIClient) run(ctx context.Context, prompt string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, c.Binary, "-p", prompt)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("claude timed out after %s", c.Timeout)
	}
	if err != nil {
		return "", fmt.Errorf("claude failed: %w: %s", err, truncate(string(stderr.Bytes()), 300))
	}
	return strings.TrimSpace(string(out)), nil
}

// GenerateAcceptanceCriteria asks claude to produce 3-8 acceptance criteria as a JSON string array.
// On any failure returns a safe fallback so the requirement can still be created.
func (c *AIClient) GenerateAcceptanceCriteria(ctx context.Context, title, description string) ([]string, error) {
	prompt := fmt.Sprintf(`请根据以下需求,生成 3-8 条可验证的验收标准。每条用一句话描述,以动词开头,可观测可检验。
只输出一个 JSON 字符串数组,不要 markdown 代码块、不要解释。
示例输出格式: ["标准一", "标准二"]

需求标题: %s
需求描述: %s`, title, description)

	out, err := c.run(ctx, prompt)
	if err != nil {
		return fallbackAC(), err
	}
	clean := stripCodeFence(out)
	var items []string
	if err := json.Unmarshal([]byte(clean), &items); err != nil {
		return fallbackAC(), fmt.Errorf("parse AC json: %w (raw=%q)", err, truncate(out, 200))
	}
	if len(items) == 0 {
		return fallbackAC(), nil
	}
	return items, nil
}

// MatchSessionToTask asks claude to pick the best matching task for a session summary.
// Returns ("", 0, nil) when no good match or AI fails — caller treats as "unmatched".
func (c *AIClient) MatchSessionToTask(ctx context.Context, sessionSummary string, tasks []TaskBrief) (MatchResult, error) {
	if len(tasks) == 0 {
		return MatchResult{}, nil
	}
	taskJSON, _ := json.Marshal(tasks)

	summary := sessionSummary
	if len(summary) > 1500 {
		summary = summary[:1500]
	}

	prompt := fmt.Sprintf(`从下面的候选任务列表中,为这个 Claude Code session 摘要选择最匹配的任务。
只输出 JSON,不要 markdown 代码块、不要解释。
输出格式: {"task_id": "<id 或 null>", "confidence": 0.0-1.0}
如果没有任何匹配,返回 {"task_id": null, "confidence": 0}

候选任务:
%s

Session 摘要:
%s`, string(taskJSON), summary)

	out, err := c.run(ctx, prompt)
	if err != nil {
		return MatchResult{}, err
	}
	clean := stripCodeFence(out)
	var res MatchResult
	if err := json.Unmarshal([]byte(clean), &res); err != nil {
		return MatchResult{}, fmt.Errorf("parse match json: %w (raw=%q)", err, truncate(out, 200))
	}
	return res, nil
}

func fallbackAC() []string {
	return []string{
		"核心功能可以正常使用",
		"覆盖主要的成功路径场景",
		"边界条件与异常输入有合理处理",
		"相关测试或验证已通过",
	}
}

func stripCodeFence(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```")
		if idx := strings.Index(s, "\n"); idx >= 0 {
			s = s[idx+1:]
		}
		s = strings.TrimSuffix(s, "```")
		s = strings.TrimSpace(s)
	}
	return s
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func envDuration(key string) time.Duration {
	v := getenv(key)
	if v == "" {
		return 0
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return 0
	}
	return d
}

func getenv(key string) string {
	return os.Getenv(key)
}
