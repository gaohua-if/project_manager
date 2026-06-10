package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	APIURL     string `yaml:"api_url"`
	Token      string `yaml:"token"`
	ServerInfo string `yaml:"server_info,omitempty"`
}

type Event struct {
	Type      string          `json:"type"`
	SessionID string          `json:"sessionId"`
	Timestamp string          `json:"timestamp"`
	Cwd       string          `json:"cwd,omitempty"`
	Message   json.RawMessage `json:"message,omitempty"`
	GitBranch string          `json:"gitBranch,omitempty"`
}

type AssistantMsg struct {
	Model   string         `json:"model"`
	Usage   *UsageInfo     `json:"usage"`
	Content []ContentBlock `json:"content"`
}

type UsageInfo struct {
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
}

type ContentBlock struct {
	Type string `json:"type"`
	Name string `json:"name"`
	Text string `json:"text"`
}

type UserMsg struct {
	Content []ContentBlock `json:"content"`
}

type SessionInfo struct {
	SessionRef string
	FilePath   string
	ProjectDir string
	Cwd        string
	GitBranch  string
	StartedAt  time.Time
	EndedAt    time.Time
	Model      string
	Summary    string
	ToolCalls  map[string]int
	InputTok   int64
	OutputTok  int64
	TotalTok   int64
	NumLines   int
}

func (s *SessionInfo) Duration() time.Duration {
	if s.EndedAt.IsZero() || s.StartedAt.IsZero() {
		return 0
	}
	d := s.EndedAt.Sub(s.StartedAt)
	if d < 0 {
		return 0
	}
	return d.Round(time.Second)
}

func (s *SessionInfo) FormatTokens() string {
	return formatTokens(s.TotalTok)
}

func formatTokens(n int64) string {
	if n >= 1_000_000 {
		return fmt.Sprintf("%.1fM", float64(n)/1_000_000)
	}
	if n >= 1_000 {
		return fmt.Sprintf("%.1fK", float64(n)/1_000)
	}
	return strconv.FormatInt(n, 10)
}

const configFileName = ".aidashboard.yaml"

func configPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, configFileName)
}

func loadConfig() *Config {
	data, err := os.ReadFile(configPath())
	if err != nil {
		return &Config{}
	}
	var cfg Config
	yaml.Unmarshal(data, &cfg)
	return &cfg
}

func saveConfig(cfg *Config) {
	data, _ := yaml.Marshal(cfg)
	os.WriteFile(configPath(), data, 0600)
}

func requireAuth(cfg *Config) {
	if cfg.Token == "" {
		fmt.Println("Not logged in. Run: aidashboard login")
		os.Exit(1)
	}
	if cfg.APIURL == "" {
		fmt.Println("Server URL not set. Run: aidashboard login --server <url>")
		os.Exit(1)
	}
}

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(0)
	}

	switch os.Args[1] {
	case "login":
		cmdLogin(os.Args[2:])
	case "sessions", "ls":
		cmdSessions(os.Args[2:])
	case "upload", "push":
		cmdUpload(os.Args[2:])
	case "status":
		cmdStatus()
	case "help", "--help", "-h":
		printUsage()
	default:
		fmt.Printf("Unknown command: %s\n\n", os.Args[1])
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Print(`aidashboard - CLI for uploading Claude Code sessions to AIDashboard

Usage:
  aidashboard <command> [options]

Commands:
  login    --server <url> --token <token>   Login with server URL and API token
  sessions [--all] [--project <dir>]        List local Claude Code sessions
  upload   [numbers...] [--all]             Upload sessions to server
  status                                     Show current login status

Examples:
  # Login with platform token
  aidashboard login --server http://localhost:8080/api/v1 --token eyJhbG...

  # Login interactively (enter token when prompted)
  aidashboard login --server http://localhost:8080/api/v1

  # List recent sessions (last 48h)
  aidashboard sessions

  # List all sessions
  aidashboard sessions --all

  # Filter by project directory
  aidashboard sessions --project project-manager

  # Upload specific sessions by number
  aidashboard upload 1 3 5

  # Upload all recent sessions
  aidashboard upload --all

  # Interactive upload (shows picker)
  aidashboard upload

  # Check login status
  aidashboard status

Session logs location:
  ~/.claude/projects/

Documentation:
  PRD:        See PRD.md in the project repository
  Prototype:  See prototype.html in the project repository
  API:        http://localhost:8080/health  (health check)
`)
}

// ---- login ----

func cmdLogin(args []string) {
	cfg := loadConfig()

	server := ""
	token := ""
	for i := 0; i < len(args)-1; i++ {
		switch args[i] {
		case "--server", "-s":
			server = args[i+1]
		case "--token", "-t":
			token = args[i+1]
		}
	}

	if server == "" && cfg.APIURL == "" {
		fmt.Print("Server URL [http://localhost:8080/api/v1]: ")
		reader := bufio.NewReader(os.Stdin)
		input, _ := reader.ReadString('\n')
		server = strings.TrimSpace(input)
		if server == "" {
			server = "http://localhost:8080/api/v1"
		}
	}
	if server != "" {
		cfg.APIURL = strings.TrimRight(server, "/")
	}

	if token == "" {
		fmt.Print("Enter API token: ")
		reader := bufio.NewReader(os.Stdin)
		input, _ := reader.ReadString('\n')
		token = strings.TrimSpace(input)
	}

	if token == "" {
		fmt.Println("Error: token is required")
		os.Exit(1)
	}
	cfg.Token = token

	// Verify
	resp, err := apiGet(cfg, "/auth/me")
	if err != nil {
		fmt.Printf("Login failed: %v\n", err)
		fmt.Println("Check your token and server URL")
		os.Exit(1)
	}

	var user struct {
		Name string `json:"name"`
		Role string `json:"role"`
	}
	json.Unmarshal(resp, &user)

	cfg.ServerInfo = fmt.Sprintf("%s (%s)", user.Name, user.Role)
	saveConfig(cfg)

	fmt.Printf("Logged in as %s (%s) at %s\n", user.Name, user.Role, cfg.APIURL)
	fmt.Printf("Config saved to %s\n", configPath())
}

// ---- sessions ----

func cmdSessions(args []string) {
	showAll := false
	projectFilter := ""
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--all", "-a":
			showAll = true
		case "--project", "-p":
			if i+1 < len(args) {
				projectFilter = args[i+1]
				i++
			}
		}
	}

	home, _ := os.UserHomeDir()
	claudeDir := filepath.Join(home, ".claude", "projects")

	sessions := scanSessions(claudeDir, showAll)
	if projectFilter != "" {
		var filtered []*SessionInfo
		for _, s := range sessions {
			if strings.Contains(s.ProjectDir, projectFilter) || strings.Contains(s.Cwd, projectFilter) {
				filtered = append(filtered, s)
			}
		}
		sessions = filtered
	}

	if len(sessions) == 0 {
		fmt.Println("No sessions found.")
		fmt.Println()
		fmt.Println("Claude Code session logs are stored at:")
		fmt.Printf("  %s/\n", claudeDir)
		fmt.Println()
		fmt.Println("Each .jsonl file = one session. Sub-agent sessions are excluded.")
		return
	}

	// Header
	fmt.Printf("\n  %-4s  %-19s  %-9s  %-9s  %-10s  %-22s  %s\n",
		"#", "Date", "Tokens", "Duration", "Model", "Project", "Summary")
	fmt.Println("  " + strings.Repeat("-", 108))

	for i, s := range sessions {
		dateStr := s.StartedAt.Format("2006-01-02 15:04")
		durStr := "-"
		if d := s.Duration(); d > 0 {
			durStr = fmt.Sprintf("%dm", int(d.Minutes()))
		}
		model := s.Model
		if len(model) > 10 {
			model = model[:7] + ".."
		}
		project := s.ProjectDir
		if len(project) > 22 {
			project = ".." + project[len(project)-20:]
		}
		summary := s.Summary
		if len(summary) > 35 {
			summary = summary[:32] + "..."
		}

		fmt.Printf("  %-4d  %-19s  %-9s  %-9s  %-10s  %-22s  %s\n",
			i+1, dateStr, s.FormatTokens(), durStr, model, project, summary)
	}

	fmt.Printf("\n  Total: %d sessions\n", len(sessions))
	fmt.Printf("  Session logs: %s/\n\n", claudeDir)
}

// ---- upload ----

func cmdUpload(args []string) {
	cfg := loadConfig()
	requireAuth(cfg)

	uploadAll := false
	var selectedIdx []int

	for _, a := range args {
		if a == "--all" || a == "-a" {
			uploadAll = true
		} else if n, err := strconv.Atoi(a); err == nil {
			selectedIdx = append(selectedIdx, n)
		}
	}

	home, _ := os.UserHomeDir()
	sessions := scanSessions(filepath.Join(home, ".claude", "projects"), true)

	if len(sessions) == 0 {
		fmt.Println("No sessions found to upload.")
		return
	}

	var toUpload []*SessionInfo

	if uploadAll {
		toUpload = sessions
	} else if len(selectedIdx) > 0 {
		for _, idx := range selectedIdx {
			if idx < 1 || idx > len(sessions) {
				fmt.Printf("Invalid session number: %d (range 1-%d)\n", idx, len(sessions))
				os.Exit(1)
			}
			toUpload = append(toUpload, sessions[idx-1])
		}
	} else {
		// Interactive picker
		fmt.Println("\nSelect sessions to upload:")
		fmt.Println()
		for i, s := range sessions {
			dateStr := s.StartedAt.Format("2006-01-02 15:04")
			summary := s.Summary
			if len(summary) > 50 {
				summary = summary[:47] + "..."
			}
			fmt.Printf("  %-3d  %s  %8s  %s\n", i+1, dateStr, s.FormatTokens(), summary)
		}
		fmt.Println()
		fmt.Print("Enter session numbers (e.g. 1,3,5 or 'all'): ")

		reader := bufio.NewReader(os.Stdin)
		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		if input == "all" || input == "a" {
			toUpload = sessions
		} else {
			for _, part := range strings.Split(input, ",") {
				part = strings.TrimSpace(part)
				if n, err := strconv.Atoi(part); err == nil && n >= 1 && n <= len(sessions) {
					toUpload = append(toUpload, sessions[n-1])
				}
			}
		}
	}

	if len(toUpload) == 0 {
		fmt.Println("No sessions selected.")
		return
	}

	fmt.Printf("\nUploading %d session(s) to %s ...\n\n", len(toUpload), cfg.APIURL)

	okCount := 0
	for _, s := range toUpload {
		payload := buildUploadPayload(s)
		body, _ := json.Marshal(map[string]any{"sessions": []any{payload}})

		respBody, err := apiPost(cfg, "/sessions/batch", body)
		if err != nil {
			fmt.Printf("  [FAIL]  %-14s  %s  %v\n", s.SessionRef[:12], s.StartedAt.Format("15:04"), err)
			continue
		}

		var result struct {
			Results []struct {
				SessionRef string `json:"session_ref"`
				Status     string `json:"status"`
			} `json:"results"`
		}
		json.Unmarshal(respBody, &result)

		for _, r := range result.Results {
			switch r.Status {
			case "created":
				fmt.Printf("  [OK]    %-14s  %s  %8s  %s\n",
					s.SessionRef[:12], s.StartedAt.Format("15:04"), s.FormatTokens(), trunc(s.Summary, 40))
				okCount++
			case "duplicate":
				fmt.Printf("  [SKIP]  %-14s  %s  (already uploaded)\n",
					s.SessionRef[:12], s.StartedAt.Format("15:04"))
			default:
				fmt.Printf("  [%s]  %-14s  %s\n", r.Status, s.SessionRef[:12], s.StartedAt.Format("15:04"))
			}
		}
	}

	fmt.Printf("\nDone. %d/%d uploaded.\n", okCount, len(toUpload))
	if okCount > 0 {
		fmt.Printf("Dashboard: %s\n", strings.Replace(cfg.APIURL, "/api/v1", "", 1))
	}
}

// ---- status ----

func cmdStatus() {
	cfg := loadConfig()

	if cfg.Token == "" {
		fmt.Println("Not logged in.")
		fmt.Println("\nRun: aidashboard login --server <url> --token <token>")
		return
	}

	fmt.Printf("Server:  %s\n", cfg.APIURL)
	fmt.Printf("Config:  %s\n", configPath())

	if cfg.ServerInfo != "" {
		fmt.Printf("User:    %s\n", cfg.ServerInfo)
	}

	resp, err := apiGet(cfg, "/auth/me")
	if err != nil {
		fmt.Printf("Status:  disconnected (%v)\n", err)
		return
	}
	var user struct {
		Name string `json:"name"`
		Role string `json:"role"`
	}
	json.Unmarshal(resp, &user)
	fmt.Printf("Status:  logged in as %s (%s)\n", user.Name, user.Role)
}

// ---- scanning ----

func scanSessions(claudeDir string, showAll bool) []*SessionInfo {
	var sessions []*SessionInfo

	filepath.WalkDir(claudeDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if strings.Contains(path, string(filepath.Separator)+"subagents"+string(filepath.Separator)) {
			return nil
		}
		if !strings.HasSuffix(d.Name(), ".jsonl") {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return nil
		}

		if !showAll && time.Since(info.ModTime()) > 48*time.Hour {
			return nil
		}

		session := parseJSONL(path)
		if session == nil || session.SessionRef == "" {
			return nil
		}

		rel, _ := filepath.Rel(claudeDir, path)
		parts := strings.SplitN(rel, string(filepath.Separator), 2)
		session.ProjectDir = decodeProjectDir(parts[0])
		session.FilePath = path
		sessions = append(sessions, session)
		return nil
	})

	// Sort newest first
	for i := 0; i < len(sessions); i++ {
		for j := i + 1; j < len(sessions); j++ {
			if sessions[j].StartedAt.After(sessions[i].StartedAt) {
				sessions[i], sessions[j] = sessions[j], sessions[i]
			}
		}
	}

	return sessions
}

func decodeProjectDir(dir string) string {
	// -home-gh-project-manager -> /home/gh/project-manager
	dir = strings.TrimPrefix(dir, "-")
	parts := strings.Split(dir, "-")
	return "/" + strings.Join(parts, "/")
}

func parseJSONL(path string) *SessionInfo {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	s := &SessionInfo{
		ToolCalls: make(map[string]int),
	}

	scanner := bufio.NewScanner(f)
	buf := make([]byte, 0, 1024*1024)
	scanner.Buffer(buf, 10*1024*1024)

	firstUserMsg := true
	var lastTS time.Time

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		s.NumLines++

		var event Event
		if json.Unmarshal(line, &event) != nil {
			continue
		}

		if event.SessionID != "" && s.SessionRef == "" {
			s.SessionRef = event.SessionID
		}

		if event.Timestamp != "" {
			if t, err := time.Parse(time.RFC3339, event.Timestamp); err == nil {
				lastTS = t
				if s.StartedAt.IsZero() {
					s.StartedAt = t
				}
			}
		}

		if event.Cwd != "" && s.Cwd == "" {
			s.Cwd = event.Cwd
		}
		if event.GitBranch != "" && s.GitBranch == "" {
			s.GitBranch = event.GitBranch
		}

		switch event.Type {
		case "user":
			if firstUserMsg && s.Summary == "" {
				var msg UserMsg
				if json.Unmarshal(event.Message, &msg) == nil {
					for _, c := range msg.Content {
						if c.Type == "text" && c.Text != "" {
							s.Summary = c.Text
							if len(s.Summary) > 200 {
								s.Summary = s.Summary[:197] + "..."
							}
							break
						}
					}
				}
				firstUserMsg = false
			}

		case "assistant":
			var msg AssistantMsg
			if json.Unmarshal(event.Message, &msg) == nil {
				if msg.Model != "" && msg.Model != "<synthetic>" {
					s.Model = msg.Model
				}
				if msg.Usage != nil {
					s.InputTok += msg.Usage.InputTokens
					s.OutputTok += msg.Usage.OutputTokens
				}
				for _, c := range msg.Content {
					if c.Type == "tool_use" && c.Name != "" {
						s.ToolCalls[c.Name]++
					}
				}
			}
		}
	}

	s.TotalTok = s.InputTok + s.OutputTok
	if !lastTS.IsZero() {
		s.EndedAt = lastTS
	}

	if s.SessionRef == "" {
		return nil
	}
	return s
}

// ---- API helpers ----

func apiGet(cfg *Config, path string) (json.RawMessage, error) {
	req, err := http.NewRequest("GET", cfg.APIURL+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	return doRequest(req)
}

func apiPost(cfg *Config, path string, body []byte) (json.RawMessage, error) {
	req, err := http.NewRequest("POST", cfg.APIURL+path, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	return doRequest(req)
}

func doRequest(req *http.Request) (json.RawMessage, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == 401 {
		return nil, fmt.Errorf("unauthorized - token may be expired or invalid")
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, truncate(string(data), 200))
	}

	return json.RawMessage(data), nil
}

func buildUploadPayload(s *SessionInfo) map[string]any {
	p := map[string]any{
		"session_ref": s.SessionRef,
		"started_at":  s.StartedAt.Format(time.RFC3339),
		"model":       s.Model,
	}
	if !s.EndedAt.IsZero() && !s.StartedAt.IsZero() {
		p["ended_at"] = s.EndedAt.Format(time.RFC3339)
		d := int(s.EndedAt.Sub(s.StartedAt).Seconds())
		if d > 0 {
			p["duration_secs"] = d
		}
	}
	if s.Summary != "" {
		p["summary"] = s.Summary
	}
	if len(s.ToolCalls) > 0 {
		p["tool_calls"] = s.ToolCalls
	}
	if s.TotalTok > 0 {
		p["token_usage"] = map[string]int64{
			"input_tokens":  s.InputTok,
			"output_tokens": s.OutputTok,
			"total_tokens":  s.TotalTok,
		}
	}
	return p
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-3] + "..."
}

func trunc(s string, n int) string {
	return truncate(s, n)
}
