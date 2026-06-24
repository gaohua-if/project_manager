package main

import (
	"bufio"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Codex CLI persists rollouts at ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<sessionId>.jsonl.
// Each line is {timestamp,type,payload}. The relevant inner types are:
//   - session_meta: {id,timestamp,cwd,originator,cli_version,...}
//   - turn_context: {turn_id,cwd,model,...}
//   - event_msg/task_started: {turn_id,started_at}
//   - event_msg/task_complete: {turn_id,completed_at,duration_ms,last_agent_message}
//   - event_msg/token_count: {info:{total_token_usage:{input_tokens,cached_input_tokens,output_tokens,reasoning_output_tokens,total_tokens}}}
//   - event_msg/user_message: {message}  (used as a summary fallback)
//   - response_item/function_call|custom_tool_call: {name,arguments,...}

type codexLine struct {
	Timestamp string          `json:"timestamp"`
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
}

type codexSessionMeta struct {
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Cwd       string `json:"cwd"`
}

type codexTurnContext struct {
	Model string `json:"model"`
	Cwd   string `json:"cwd"`
}

type codexEvent struct {
	Type    string          `json:"type"`
	Message string          `json:"message"`
	Info    json.RawMessage `json:"info"`
}

type codexTokenInfo struct {
	Total struct {
		InputTokens           int64 `json:"input_tokens"`
		CachedInputTokens     int64 `json:"cached_input_tokens"`
		OutputTokens          int64 `json:"output_tokens"`
		ReasoningOutputTokens int64 `json:"reasoning_output_tokens"`
		TotalTokens           int64 `json:"total_tokens"`
	} `json:"total_token_usage"`
}

type codexResponseItem struct {
	Type string `json:"type"`
	Name string `json:"name"`
}

// scanCodexSessions walks ~/.codex/sessions and returns parsed SessionInfo entries
// with AgentType="codex". Honors the same 48h cutoff as scanSessions when showAll=false.
func scanCodexSessions(codexDir string, showAll bool) []*SessionInfo {
	var sessions []*SessionInfo
	if _, err := os.Stat(codexDir); err != nil {
		return sessions
	}

	filepath.WalkDir(codexDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(d.Name(), ".jsonl") {
			return nil
		}
		if !strings.HasPrefix(d.Name(), "rollout-") {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		if !showAll && time.Since(info.ModTime()) > 48*time.Hour {
			return nil
		}
		s := parseCodexJSONL(path)
		if s == nil || s.SessionRef == "" {
			return nil
		}
		s.FilePath = path
		sessions = append(sessions, s)
		return nil
	})

	// newest first
	sortSessionsNewestFirst(sessions)
	return sessions
}

func parseCodexJSONL(path string) *SessionInfo {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	s := &SessionInfo{
		AgentType: "codex",
		ToolCalls: make(map[string]int),
	}

	scanner := bufio.NewScanner(f)
	buf := make([]byte, 0, 1024*1024)
	scanner.Buffer(buf, 10*1024*1024)

	var lastTokens codexTokenInfo
	var sawTokens bool
	var firstSummary string

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var cl codexLine
		if err := json.Unmarshal(line, &cl); err != nil {
			continue
		}
		s.NumLines++

		ts, _ := time.Parse(time.RFC3339Nano, cl.Timestamp)
		if !ts.IsZero() {
			if s.StartedAt.IsZero() {
				s.StartedAt = ts
			}
			s.EndedAt = ts
		}

		switch cl.Type {
		case "session_meta":
			var meta codexSessionMeta
			if err := json.Unmarshal(cl.Payload, &meta); err == nil {
				if s.SessionRef == "" {
					s.SessionRef = meta.ID
				}
				if meta.Cwd != "" && s.Cwd == "" {
					s.Cwd = meta.Cwd
					s.ProjectDir = filepath.Base(meta.Cwd)
				}
				if meta.Timestamp != "" {
					if mt, err := time.Parse(time.RFC3339Nano, meta.Timestamp); err == nil {
						s.StartedAt = mt
					}
				}
			}
		case "turn_context":
			var tc codexTurnContext
			if err := json.Unmarshal(cl.Payload, &tc); err == nil {
				if tc.Model != "" {
					s.Model = tc.Model
					s.Models = appendDistinct(s.Models, tc.Model)
				}
				if tc.Cwd != "" && s.Cwd == "" {
					s.Cwd = tc.Cwd
					s.ProjectDir = filepath.Base(tc.Cwd)
				}
			}
		case "event_msg":
			var ev codexEvent
			if err := json.Unmarshal(cl.Payload, &ev); err == nil {
				switch ev.Type {
				case "token_count":
					if len(ev.Info) > 0 {
						var ti codexTokenInfo
						if err := json.Unmarshal(ev.Info, &ti); err == nil {
							lastTokens = ti
							sawTokens = true
						}
					}
				case "user_message":
					if firstSummary == "" && ev.Message != "" {
						firstSummary = ev.Message
					}
				}
			}
		case "response_item":
			var ri codexResponseItem
			if err := json.Unmarshal(cl.Payload, &ri); err == nil {
				if ri.Type == "function_call" || ri.Type == "custom_tool_call" {
					name := ri.Name
					if name == "" {
						name = ri.Type
					}
					s.ToolCalls[name]++
				}
			}
		}
	}

	if sawTokens {
		s.InputTok = lastTokens.Total.InputTokens
		s.CacheReadTok = lastTokens.Total.CachedInputTokens
		// Codex doesn't expose a separate cache-creation counter; leave at 0.
		s.OutputTok = lastTokens.Total.OutputTokens + lastTokens.Total.ReasoningOutputTokens
		s.TotalTok = lastTokens.Total.TotalTokens
		if s.TotalTok == 0 {
			s.TotalTok = s.InputTok + s.OutputTok
		}
	}

	if firstSummary != "" {
		s.Summary = truncate(firstSummary, 200)
	}

	return s
}
