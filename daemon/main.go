package main

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/lib/pq"
	"gopkg.in/yaml.v3"
)

type Config struct {
	APIURL     string `yaml:"api_url"`
	Token      string `yaml:"token"`
	ServerInfo string `yaml:"server_info,omitempty"`
}

type ConsumerConfig struct {
	ClaudeDir     string
	DatabaseURL   string
	ProjectFilter string
	TimeZone      string
	Port          string
	DailyAt       string
	RunOnStart    bool
	ReportOffset  int
	ClaudeBin     string
	ClaudeTimeout time.Duration
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
	InputTokens              int64 `json:"input_tokens"`
	OutputTokens             int64 `json:"output_tokens"`
	CacheCreationInputTokens int64 `json:"cache_creation_input_tokens"`
	CacheReadInputTokens     int64 `json:"cache_read_input_tokens"`
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
	SessionRef   string
	FilePath     string
	ProjectDir   string
	Cwd          string
	GitBranch    string
	StartedAt    time.Time
	EndedAt      time.Time
	Model        string
	Models       []string // distinct models seen, in insertion order
	Summary      string
	ToolCalls    map[string]int
	InputTok     int64
	OutputTok    int64
	CacheCreateTok int64
	CacheReadTok int64
	TotalTok     int64
	NumLines     int
	SubFiles     []string // subagent JSONL file paths
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
		return configFromEnv(&Config{})
	}
	var cfg Config
	yaml.Unmarshal(data, &cfg)
	return configFromEnv(&cfg)
}

func configFromEnv(cfg *Config) *Config {
	if v := os.Getenv("AIDASHBOARD_API_URL"); v != "" {
		cfg.APIURL = strings.TrimRight(v, "/")
	}
	if v := os.Getenv("AIDASHBOARD_TOKEN"); v != "" {
		cfg.Token = v
	}
	return cfg
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
	case "consume":
		cmdConsume(os.Args[2:])
	case "serve":
		cmdServeReports(os.Args[2:])
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
  consume  [--once]                         Upload sessions and generate daily report
  serve                                      Run report generator HTTP service
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

  # Run the server-side report generator
  DATABASE_URL=postgres://... PORT=8090 aidashboard serve

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
		if len(s.SubFiles) > 0 {
			fmt.Printf("        %-38s %d sub-agent(s)\n", "", len(s.SubFiles))
		}
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

	totalUploaded := 0
	totalSubs := 0

	for _, s := range toUpload {
		allSessions := collectSessionsWithFiles(s)

		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)

		metadata := make([]map[string]any, 0, len(allSessions))
		for _, item := range allSessions {
			metadata = append(metadata, buildUploadPayload(item.info))
		}
		metadataJSON, _ := json.Marshal(map[string]any{"sessions": metadata})
		writer.WriteField("metadata", string(metadataJSON))

		for _, item := range allSessions {
			f, err := os.Open(item.filePath)
			if err != nil {
				continue
			}
			part, err := writer.CreateFormFile("file_"+item.info.SessionRef, filepath.Base(item.filePath))
			if err != nil {
				f.Close()
				continue
			}
			io.Copy(part, f)
			f.Close()
		}
		writer.Close()

		req, err := http.NewRequest("POST", cfg.APIURL+"/sessions/batch", &buf)
		if err != nil {
			fmt.Printf("  [FAIL]  %-14s  %s  %v\n", s.SessionRef[:12], s.StartedAt.Format("15:04"), err)
			continue
		}
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.Header.Set("Authorization", "Bearer "+cfg.Token)

		respBody, err := doRequest(req)
		if err != nil {
			fmt.Printf("  [FAIL]  %-14s  %s  %v\n", s.SessionRef[:12], s.StartedAt.Format("15:04"), err)
			continue
		}

		var result struct {
			Total   int `json:"total"`
			Results []struct {
				SessionRef string `json:"session_ref"`
				ID         string `json:"id"`
				Status     string `json:"status"`
			} `json:"results"`
		}
		if err := json.Unmarshal(respBody, &result); err != nil {
			fmt.Printf("  [FAIL]  %-14s  %s  invalid response: %v\n", s.SessionRef[:12], s.StartedAt.Format("15:04"), err)
			continue
		}

		mainStatus := "unknown"
		subSuccess := 0
		hadError := false
		for _, r := range result.Results {
			if r.SessionRef == s.SessionRef {
				mainStatus = r.Status
			} else if r.Status == "created" || r.Status == "updated" || r.Status == "duplicate" {
				subSuccess++
			}
			if strings.HasPrefix(r.Status, "error:") {
				hadError = true
				ref := r.SessionRef
				if len(ref) > 12 {
					ref = ref[:12]
				}
				fmt.Printf("  [FAIL]  %-14s  %s\n", ref, r.Status)
			}
		}

		switch mainStatus {
		case "created":
			fmt.Printf("  [OK]    %-14s  %s  %8s  %s\n",
				s.SessionRef[:12], s.StartedAt.Format("15:04"), s.FormatTokens(), trunc(s.Summary, 40))
			totalUploaded++
		case "updated":
			fmt.Printf("  [OK]    %-14s  %s  updated existing session\n",
				s.SessionRef[:12], s.StartedAt.Format("15:04"))
			totalUploaded++
		case "duplicate":
			fmt.Printf("  [SKIP]  %-14s  %s  (already uploaded)\n",
				s.SessionRef[:12], s.StartedAt.Format("15:04"))
		default:
			fmt.Printf("  [%s]  %-14s  %s\n", mainStatus, s.SessionRef[:12], s.StartedAt.Format("15:04"))
		}

		if subSuccess > 0 {
			fmt.Printf("          └─ %d sub-agent(s) processed\n", subSuccess)
			totalSubs += subSuccess
		}
		if hadError {
			fmt.Println("          └─ one or more batch items failed; see errors above")
		}
	}

	fmt.Printf("\nDone. %d main + %d sub-agent(s) processed.\n", totalUploaded, totalSubs)
	if totalUploaded > 0 || totalSubs > 0 {
		fmt.Printf("Dashboard: %s\n", strings.Replace(cfg.APIURL, "/api/v1", "", 1))
	}
}

// ---- consume ----

func cmdConsume(args []string) {
	cfg := loadConfig()

	once := false
	for _, a := range args {
		if a == "--once" {
			once = true
		}
	}

	consumerCfg := loadConsumerConfig()
	if consumerCfg.DatabaseURL == "" {
		requireAuth(cfg)
	}
	if once || consumerCfg.RunOnStart {
		if err := runConsumerOnce(cfg, consumerCfg); err != nil {
			fmt.Printf("[consumer] failed: %v\n", err)
			if once {
				os.Exit(1)
			}
		}
	}
	if once {
		return
	}

	mode := "server-db"
	if consumerCfg.DatabaseURL == "" {
		mode = "local-files"
	}
	fmt.Printf("[consumer] started. mode=%s daily_at=%s tz=%s\n",
		mode, consumerCfg.DailyAt, consumerCfg.TimeZone)
	for {
		next := nextDailyRun(time.Now(), consumerCfg.DailyAt)
		fmt.Printf("[consumer] next run at %s\n", next.Format(time.RFC3339))
		time.Sleep(time.Until(next))
		if err := runConsumerOnce(cfg, consumerCfg); err != nil {
			fmt.Printf("[consumer] failed: %v\n", err)
		}
	}
}

func loadConsumerConfig() ConsumerConfig {
	home, _ := os.UserHomeDir()
	cfg := ConsumerConfig{
		ClaudeDir:     filepath.Join(home, ".claude", "projects"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		DailyAt:       "18:00",
		TimeZone:      firstNonEmpty(os.Getenv("TZ"), "Asia/Shanghai"),
		Port:          firstNonEmpty(os.Getenv("PORT"), "8090"),
		RunOnStart:    true,
		ReportOffset:  0,
		ClaudeBin:     "claude",
		ClaudeTimeout: 10 * time.Minute,
	}
	if v := os.Getenv("AIDASHBOARD_CLAUDE_DIR"); v != "" {
		cfg.ClaudeDir = v
	}
	if v := os.Getenv("AIDASHBOARD_PROJECT"); v != "" {
		cfg.ProjectFilter = v
	}
	if v := os.Getenv("AIDASHBOARD_DAILY_AT"); v != "" {
		cfg.DailyAt = v
	}
	if v := os.Getenv("AIDASHBOARD_RUN_ON_START"); v != "" {
		cfg.RunOnStart = v != "0" && strings.ToLower(v) != "false"
	}
	if v := os.Getenv("AIDASHBOARD_REPORT_DATE_OFFSET"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.ReportOffset = n
		}
	}
	if v := os.Getenv("AIDASHBOARD_CLAUDE_BIN"); v != "" {
		cfg.ClaudeBin = v
	}
	if v := os.Getenv("AIDASHBOARD_CLAUDE_TIMEOUT"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.ClaudeTimeout = d
		}
	}
	return cfg
}

func runConsumerOnce(cfg *Config, consumerCfg ConsumerConfig) error {
	targetDate := time.Now().AddDate(0, 0, consumerCfg.ReportOffset).Format("2006-01-02")
	if targetDate != time.Now().Format("2006-01-02") {
		return fmt.Errorf("AIDASHBOARD_REPORT_DATE_OFFSET is not supported by the current API; use 0 for today's report")
	}
	if consumerCfg.DatabaseURL != "" {
		return runServerConsumerOnce(consumerCfg, targetDate)
	}
	fmt.Printf("[consumer] processing report_date=%s\n", targetDate)

	sessions := scanSessions(consumerCfg.ClaudeDir, true)
	sessions = filterSessionsForReport(sessions, targetDate, consumerCfg.ProjectFilter)
	if len(sessions) == 0 {
		fmt.Printf("[consumer] no sessions found for %s\n", targetDate)
	} else {
		fmt.Printf("[consumer] uploading %d session(s)\n", len(sessions))
		for _, s := range sessions {
			if err := uploadOneSession(cfg, s); err != nil {
				fmt.Printf("[consumer] upload failed %s: %v\n", shortRef(s.SessionRef), err)
			}
		}
	}

	report, err := getTodayReport(cfg)
	if err != nil {
		return err
	}
	prompt := buildDailyReportPrompt(targetDate, sessions)
	content, err := generateDailyReportWithClaude(consumerCfg, prompt)
	if err != nil {
		return err
	}
	if strings.TrimSpace(content) == "" {
		return fmt.Errorf("claude returned empty report")
	}
	if err := updateReportContent(cfg, report.ID, content); err != nil {
		return err
	}
	fmt.Printf("[consumer] report updated: %s (%d chars)\n", report.ID, len(content))
	return nil
}

type reportUser struct {
	ID   string
	Name string
}

type reportGenerateRequest struct {
	UserID     string `json:"user_id"`
	ReportDate string `json:"report_date"`
}

type teamReportGenerateRequest struct {
	TeamID     string `json:"team_id"`
	LeaderID   string `json:"leader_id"`
	ReportDate string `json:"report_date"`
}

type teamMemberDailyReport struct {
	UserName string
	Content  string
}

type reportSession struct {
	ID               string
	SessionRef       string
	StartedAt        time.Time
	EndedAt          sql.NullTime
	DurationSecs     sql.NullInt64
	Model            sql.NullString
	Summary          sql.NullString
	ToolCallsJSON    sql.NullString
	TaskTitle        sql.NullString
	RequirementTitle sql.NullString
	InputTokens      int64
	OutputTokens     int64
	TotalTokens      int64
}

func cmdServeReports(args []string) {
	cfg := loadConsumerConfig()
	if cfg.DatabaseURL == "" {
		fmt.Println("DATABASE_URL is required for report generator service")
		os.Exit(1)
	}

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		fmt.Printf("Failed to open database: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fmt.Printf("Failed to connect database: %v\n", err)
		os.Exit(1)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("/reports/generate", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		var req reportGenerateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writePlainJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
			return
		}
		if req.UserID == "" {
			writePlainJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
			return
		}
		if req.ReportDate == "" {
			req.ReportDate = time.Now().Format("2006-01-02")
		}
		reportID, sessionCount, err := generateServerReportForUser(db, cfg, req.UserID, req.ReportDate)
		if err != nil {
			writePlainJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writePlainJSON(w, http.StatusOK, map[string]any{
			"report_id":     reportID,
			"session_count": sessionCount,
		})
	})


		mux.HandleFunc("/reports/team/generate", func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost {
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}
			var req teamReportGenerateRequest
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writePlainJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
				return
			}
			if req.TeamID == "" || req.LeaderID == "" {
				writePlainJSON(w, http.StatusBadRequest, map[string]string{"error": "team_id and leader_id are required"})
				return
			}
			if req.ReportDate == "" {
				req.ReportDate = time.Now().Format("2006-01-02")
			}
			reportID, err := generateServerTeamReport(db, cfg, req.TeamID, req.LeaderID, req.ReportDate)
			if err != nil {
				writePlainJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			writePlainJSON(w, http.StatusOK, map[string]any{
				"report_id": reportID,
			})
		})
	fmt.Printf("[report-generator] listening on :%s tz=%s\n", cfg.Port, cfg.TimeZone)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		fmt.Printf("Report generator failed: %v\n", err)
		os.Exit(1)
	}
}

func runServerConsumerOnce(cfg ConsumerConfig, targetDate string) error {
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		return err
	}

	users, err := listReportUsers(db)
	if err != nil {
		return err
	}
	fmt.Printf("[consumer] server mode: report_date=%s users=%d\n", targetDate, len(users))

	for _, u := range users {
		if _, sessionCount, err := generateServerReportForUser(db, cfg, u.ID, targetDate); err != nil {
			fmt.Printf("[consumer] user %s report generation failed: %v\n", u.Name, err)
			continue
		} else {
			fmt.Printf("[consumer] report updated for %s (%d sessions)\n", u.Name, sessionCount)
		}
	}
	return nil
}

func generateServerReportForUser(db *sql.DB, cfg ConsumerConfig, userID, targetDate string) (string, int, error) {
	u, err := getReportUser(db, userID)
	if err != nil {
		return "", 0, err
	}
	sessions, err := listUserReportSessions(db, userID, targetDate, cfg.TimeZone)
	if err != nil {
		return "", 0, err
	}
	prompt := buildServerDailyReportPrompt(targetDate, *u, sessions)
	content, err := generateDailyReportWithClaude(cfg, prompt)
	if err != nil {
		return "", len(sessions), err
	}
	if strings.TrimSpace(content) == "" {
		return "", len(sessions), fmt.Errorf("claude returned empty report")
	}
	reportID, err := upsertDailyReport(db, userID, targetDate, content, sessions)
	if err != nil {
		return "", len(sessions), err
	}
	return reportID, len(sessions), nil
}

func generateServerTeamReport(db *sql.DB, cfg ConsumerConfig, teamID, leaderID, targetDate string) (string, error) {
	leader, err := getReportUser(db, leaderID)
	if err != nil {
		return "", fmt.Errorf("leader not found: %w", err)
	}
	leaderSessions, err := listUserReportSessions(db, leaderID, targetDate, cfg.TimeZone)
	if err != nil {
		return "", fmt.Errorf("query leader sessions: %w", err)
	}

	rows, err := db.Query(`
		SELECT u.name, COALESCE(dr.content, '')
		FROM users u
		LEFT JOIN daily_reports dr ON dr.user_id = u.id AND dr.report_date = $1
		WHERE u.team_id = $2 AND u.role = 'employee'
		ORDER BY u.name`, targetDate, teamID)
	if err != nil {
		return "", fmt.Errorf("query member reports: %w", err)
	}
	defer rows.Close()

	var memberReports []teamMemberDailyReport
	for rows.Next() {
		var mr teamMemberDailyReport
		if err := rows.Scan(&mr.UserName, &mr.Content); err != nil {
			return "", err
		}
		memberReports = append(memberReports, mr)
	}
	if err := rows.Err(); err != nil {
		return "", err
	}

	var teamName string
	if err := db.QueryRow("SELECT name FROM teams WHERE id = $1", teamID).Scan(&teamName); err != nil {
		teamName = "unknown"
	}

	prompt := buildTeamReportPrompt(targetDate, teamName, *leader, leaderSessions, memberReports)
	content, err := generateDailyReportWithClaude(cfg, prompt)
	if err != nil {
		return "", fmt.Errorf("claude generation: %w", err)
	}
	if strings.TrimSpace(content) == "" {
		return "", fmt.Errorf("claude returned empty report")
	}

	sessionIDs := make([]string, 0, len(leaderSessions))
	for _, s := range leaderSessions {
		sessionIDs = append(sessionIDs, s.ID)
	}
	memberReportIDs := make([]string, 0)
	for _, mr := range memberReports {
		if mr.Content != "" {
			var rid string
			if err := db.QueryRow(
				"SELECT id::text FROM daily_reports WHERE user_id = (SELECT id FROM users WHERE name = $1 AND team_id = $2 LIMIT 1) AND report_date = $3",
				mr.UserName, teamID, targetDate,
			).Scan(&rid); err == nil {
				memberReportIDs = append(memberReportIDs, rid)
			}
		}
	}

	var reportID string
	err = db.QueryRow(`
		INSERT INTO team_reports (team_id, leader_id, report_date, content, member_report_ids, session_ids)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (team_id, report_date)
		DO UPDATE SET content = EXCLUDED.content,
			member_report_ids = EXCLUDED.member_report_ids,
			session_ids = EXCLUDED.session_ids,
			updated_at = now()
		RETURNING id::text`,
		teamID, leaderID, targetDate, content,
		pq.Array(memberReportIDs), pq.Array(sessionIDs)).Scan(&reportID)
	if err != nil {
		return "", fmt.Errorf("upsert team_reports: %w", err)
	}
	return reportID, nil
}

func buildTeamReportPrompt(reportDate, teamName string, leader reportUser, sessions []reportSession, memberReports []teamMemberDailyReport) string {
	var b strings.Builder
	fmt.Fprintf(&b, "你是团队日报生成助手。请根据下面的数据为团队 %s (负责人: %s) 生成 %s 的团队日报。\n", teamName, leader.Name, reportDate)
	b.WriteString("要求：只输出 Markdown；使用中文；结构必须包含：\n")
	b.WriteString("1. 团队总结 — 一段话概述团队今日整体工作进展\n")
	b.WriteString("2. TL 工作 — 负责人的 session 明细和工作摘要\n")
	b.WriteString("3. 组员日报 — 每个组员的工作内容\n")
	b.WriteString("内容要具体，避免夸大；缺少信息时写 暂无。\n\n")

	b.WriteString("## TL Session 数据\n\n")
	if len(sessions) == 0 {
		b.WriteString("负责人当天没有已上报的 session 数据。\n\n")
	} else {
		for i, s := range sessions {
			fmt.Fprintf(&b, "Session %d\n", i+1)
			fmt.Fprintf(&b, "- ID: %s\n", s.SessionRef)
			fmt.Fprintf(&b, "- Time: %s", s.StartedAt.Format(time.RFC3339))
			if s.EndedAt.Valid {
				fmt.Fprintf(&b, " - %s", s.EndedAt.Time.Format(time.RFC3339))
			}
			b.WriteString("\n")
			fmt.Fprintf(&b, "- Model: %s\n", nullStringValue(s.Model, "unknown"))
			fmt.Fprintf(&b, "- Tokens: input=%d output=%d total=%d\n", s.InputTokens, s.OutputTokens, s.TotalTokens)
			if s.TaskTitle.Valid && s.TaskTitle.String != "" {
				fmt.Fprintf(&b, "- Task: %s\n", s.TaskTitle.String)
			}
			if s.RequirementTitle.Valid && s.RequirementTitle.String != "" {
				fmt.Fprintf(&b, "- Requirement: %s\n", s.RequirementTitle.String)
			}
			fmt.Fprintf(&b, "- Summary: %s\n\n", nullStringValue(s.Summary, ""))
		}
	}

	b.WriteString("## 组员日报\n\n")
	if len(memberReports) == 0 {
		b.WriteString("没有找到组员日报数据。\n")
	} else {
		for _, mr := range memberReports {
			fmt.Fprintf(&b, "### %s\n", mr.UserName)
			if mr.Content != "" {
				fmt.Fprintf(&b, "%s\n\n", mr.Content)
			} else {
				b.WriteString("暂无日报\n\n")
			}
		}
	}
	return b.String()
}

func getReportUser(db *sql.DB, userID string) (*reportUser, error) {
	var u reportUser
	err := db.QueryRow(`
		SELECT id::text, name
		FROM users
		WHERE id = $1`, userID).Scan(&u.ID, &u.Name)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func listReportUsers(db *sql.DB) ([]reportUser, error) {
	rows, err := db.Query(`
		SELECT id::text, name
		FROM users
		WHERE role = 'employee'
		ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []reportUser
	for rows.Next() {
		var u reportUser
		if err := rows.Scan(&u.ID, &u.Name); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

func listUserReportSessions(db *sql.DB, userID, reportDate, timeZone string) ([]reportSession, error) {
	rows, err := db.Query(`
		SELECT s.id::text, s.session_ref, s.started_at, s.ended_at, s.duration_secs,
			s.model, s.summary, COALESCE(s.tool_calls_json::text, '{}'),
			COALESCE(t.title, ''), COALESCE(r.title, ''),
			COALESCE(tu.input_tokens, 0), COALESCE(tu.output_tokens, 0), COALESCE(tu.total_tokens, 0)
		FROM sessions s
		LEFT JOIN tasks t ON t.id = s.task_id
		LEFT JOIN requirements r ON r.id = s.requirement_id
		LEFT JOIN (
			SELECT session_id, SUM(input_tokens) input_tokens, SUM(output_tokens) output_tokens, SUM(total_tokens) total_tokens
			FROM token_usage
			GROUP BY session_id
		) tu ON tu.session_id = s.id
		WHERE s.user_id = $1 AND DATE(s.started_at AT TIME ZONE $2) = $3
		ORDER BY s.started_at`, userID, timeZone, reportDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []reportSession
	for rows.Next() {
		var s reportSession
		if err := rows.Scan(&s.ID, &s.SessionRef, &s.StartedAt, &s.EndedAt, &s.DurationSecs,
			&s.Model, &s.Summary, &s.ToolCallsJSON, &s.TaskTitle, &s.RequirementTitle,
			&s.InputTokens, &s.OutputTokens, &s.TotalTokens); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

func upsertDailyReport(db *sql.DB, userID, reportDate, content string, sessions []reportSession) (string, error) {
	sessionIDs := make([]string, 0, len(sessions))
	for _, s := range sessions {
		sessionIDs = append(sessionIDs, s.ID)
	}
	var reportID string
	err := db.QueryRow(`
		INSERT INTO daily_reports (user_id, report_date, content, session_ids, edited, updated_at)
		VALUES ($1, $2, $3, $4, false, now())
		ON CONFLICT (user_id, report_date)
		DO UPDATE SET content = EXCLUDED.content,
			session_ids = EXCLUDED.session_ids,
			edited = false,
			updated_at = now()
		RETURNING id::text`,
		userID, reportDate, content, pq.Array(sessionIDs)).Scan(&reportID)
	return reportID, err
}

func buildServerDailyReportPrompt(reportDate string, user reportUser, sessions []reportSession) string {
	var b strings.Builder
	fmt.Fprintf(&b, "请根据平台中已上报的 Claude Code session 数据，为用户“%s”生成 %s 的个人工作日报。\n", user.Name, reportDate)
	b.WriteString("要求：只输出 Markdown；使用中文；结构包含“今日完成”“问题与风险”“明日计划”“Session 明细”；内容要具体，避免夸大；没有信息时写“暂无”。\n\n")
	if len(sessions) == 0 {
		b.WriteString("当天没有已上报的 session 数据。\n")
		return b.String()
	}
	for i, s := range sessions {
		fmt.Fprintf(&b, "Session %d\n", i+1)
		fmt.Fprintf(&b, "- ID: %s\n", s.SessionRef)
		fmt.Fprintf(&b, "- Time: %s", s.StartedAt.Format(time.RFC3339))
		if s.EndedAt.Valid {
			fmt.Fprintf(&b, " - %s", s.EndedAt.Time.Format(time.RFC3339))
		}
		b.WriteString("\n")
		if s.DurationSecs.Valid {
			fmt.Fprintf(&b, "- Duration seconds: %d\n", s.DurationSecs.Int64)
		}
		fmt.Fprintf(&b, "- Model: %s\n", nullStringValue(s.Model, "unknown"))
		fmt.Fprintf(&b, "- Tokens: input=%d output=%d total=%d\n", s.InputTokens, s.OutputTokens, s.TotalTokens)
		if s.TaskTitle.Valid && s.TaskTitle.String != "" {
			fmt.Fprintf(&b, "- Task: %s\n", s.TaskTitle.String)
		}
		if s.RequirementTitle.Valid && s.RequirementTitle.String != "" {
			fmt.Fprintf(&b, "- Requirement: %s\n", s.RequirementTitle.String)
		}
		fmt.Fprintf(&b, "- Tool calls JSON: %s\n", nullStringValue(s.ToolCallsJSON, "{}"))
		fmt.Fprintf(&b, "- Summary: %s\n\n", nullStringValue(s.Summary, ""))
	}
	return b.String()
}

func nullStringValue(v sql.NullString, fallback string) string {
	if v.Valid && v.String != "" {
		return v.String
	}
	return fallback
}

func filterSessionsForReport(sessions []*SessionInfo, reportDate, projectFilter string) []*SessionInfo {
	var filtered []*SessionInfo
	for _, s := range sessions {
		if s.StartedAt.Format("2006-01-02") != reportDate {
			continue
		}
		if projectFilter != "" && !strings.Contains(s.ProjectDir, projectFilter) && !strings.Contains(s.Cwd, projectFilter) {
			continue
		}
		filtered = append(filtered, s)
	}
	return filtered
}

func uploadOneSession(cfg *Config, s *SessionInfo) error {
	allSessions := collectSessionsWithFiles(s)
	return uploadBatchMultipart(cfg, allSessions)
}

type sessionWithFile struct {
	info     *SessionInfo
	filePath string
}

func collectSessionsWithFiles(s *SessionInfo) []sessionWithFile {
	var items []sessionWithFile
	items = append(items, sessionWithFile{info: s, filePath: s.FilePath})
	for _, subFile := range s.SubFiles {
		sub := parseJSONL(subFile)
		if sub != nil && sub.SessionRef != "" {
			items = append(items, sessionWithFile{info: sub, filePath: subFile})
		}
	}
	return items
}

func uploadBatchMultipart(cfg *Config, items []sessionWithFile) error {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	metadata := make([]map[string]any, 0, len(items))
	for _, item := range items {
		metadata = append(metadata, buildUploadPayload(item.info))
	}
	metadataJSON, _ := json.Marshal(map[string]any{"sessions": metadata})
	writer.WriteField("metadata", string(metadataJSON))

	for _, item := range items {
		f, err := os.Open(item.filePath)
		if err != nil {
			continue
		}
		part, err := writer.CreateFormFile("file_"+item.info.SessionRef, filepath.Base(item.filePath))
		if err != nil {
			f.Close()
			continue
		}
		io.Copy(part, f)
		f.Close()
	}

	writer.Close()

	req, err := http.NewRequest("POST", cfg.APIURL+"/sessions/batch", &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+cfg.Token)

	respBody, err := doRequest(req)
	if err != nil {
		return err
	}

	var result struct {
		Results []struct {
			SessionRef string `json:"session_ref"`
			Status     string `json:"status"`
		} `json:"results"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return err
	}
	for _, r := range result.Results {
		if strings.HasPrefix(r.Status, "error:") {
			return fmt.Errorf("%s: %s", shortRef(r.SessionRef), r.Status)
		}
	}
	return nil
}

type reportResponse struct {
	ID         string `json:"id"`
	Content    string `json:"content"`
	ReportDate string `json:"report_date"`
}

func getTodayReport(cfg *Config) (*reportResponse, error) {
	resp, err := apiGet(cfg, "/reports/today")
	if err != nil {
		return nil, err
	}
	var report reportResponse
	if err := json.Unmarshal(resp, &report); err != nil {
		return nil, err
	}
	if report.ID == "" {
		return nil, fmt.Errorf("report response missing id")
	}
	return &report, nil
}

func updateReportContent(cfg *Config, reportID, content string) error {
	body, _ := json.Marshal(map[string]string{"content": content})
	_, err := apiPut(cfg, "/reports/"+reportID, body)
	return err
}

func generateDailyReportWithClaude(cfg ConsumerConfig, prompt string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ClaudeTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, cfg.ClaudeBin, "-p", prompt)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("claude timed out after %s", cfg.ClaudeTimeout)
	}
	if err != nil {
		return "", fmt.Errorf("claude failed: %w: %s", err, truncate(stderr.String(), 500))
	}
	return strings.TrimSpace(string(out)), nil
}

func buildDailyReportPrompt(reportDate string, sessions []*SessionInfo) string {
	var b strings.Builder
	fmt.Fprintf(&b, "请根据下面的 Claude Code session log 摘要生成 %s 的个人工作日报。\n", reportDate)
	b.WriteString("要求：只输出 Markdown；使用中文；结构包含“今日完成”“问题与风险”“明日计划”“Session 明细”；内容要具体，避免夸大；没有信息时写“暂无”。\n\n")
	if len(sessions) == 0 {
		b.WriteString("当天没有扫描到 session log。\n")
		return b.String()
	}
	for i, s := range sessions {
		fmt.Fprintf(&b, "Session %d\n", i+1)
		fmt.Fprintf(&b, "- ID: %s\n", s.SessionRef)
		fmt.Fprintf(&b, "- Project: %s\n", firstNonEmpty(s.ProjectDir, s.Cwd))
		fmt.Fprintf(&b, "- Time: %s - %s\n", s.StartedAt.Format(time.RFC3339), s.EndedAt.Format(time.RFC3339))
		fmt.Fprintf(&b, "- Duration: %s\n", s.Duration())
		fmt.Fprintf(&b, "- Model: %s\n", firstNonEmpty(s.Model, "unknown"))
		fmt.Fprintf(&b, "- Tokens: input=%d output=%d total=%d\n", s.InputTok, s.OutputTok, s.TotalTok)
		fmt.Fprintf(&b, "- Tools: %s\n", formatToolCalls(s.ToolCalls))
		fmt.Fprintf(&b, "- First user request: %s\n\n", s.Summary)
	}
	return b.String()
}

func formatToolCalls(toolCalls map[string]int) string {
	if len(toolCalls) == 0 {
		return "none"
	}
	parts := make([]string, 0, len(toolCalls))
	for name, count := range toolCalls {
		parts = append(parts, fmt.Sprintf("%s=%d", name, count))
	}
	return strings.Join(parts, ", ")
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func shortRef(ref string) string {
	if len(ref) <= 12 {
		return ref
	}
	return ref[:12]
}

func writePlainJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func nextDailyRun(now time.Time, hhmm string) time.Time {
	parts := strings.Split(hhmm, ":")
	hour, minute := 18, 0
	if len(parts) >= 2 {
		if h, err := strconv.Atoi(parts[0]); err == nil && h >= 0 && h <= 23 {
			hour = h
		}
		if m, err := strconv.Atoi(parts[1]); err == nil && m >= 0 && m <= 59 {
			minute = m
		}
	}
	next := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return next
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

		// Collect subagent sessions from <session-id>/subagents/*.jsonl
		sessionDir := strings.TrimSuffix(path, ".jsonl")
		subDir := filepath.Join(sessionDir, "subagents")
		if entries, err := os.ReadDir(subDir); err == nil {
			for _, e := range entries {
				if !e.IsDir() && strings.HasSuffix(e.Name(), ".jsonl") {
					session.SubFiles = append(session.SubFiles, filepath.Join(subDir, e.Name()))
				}
			}
		}

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
					s.Models = appendDistinct(s.Models, msg.Model)
				}
				if msg.Usage != nil {
					s.InputTok += msg.Usage.InputTokens
					s.OutputTok += msg.Usage.OutputTokens
					s.CacheCreateTok += msg.Usage.CacheCreationInputTokens
					s.CacheReadTok += msg.Usage.CacheReadInputTokens
				}
				for _, c := range msg.Content {
					if c.Type == "tool_use" && c.Name != "" {
						s.ToolCalls[c.Name]++
					}
				}
			}
		}
	}

	s.TotalTok = s.InputTok + s.OutputTok + s.CacheCreateTok + s.CacheReadTok
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

func apiPut(cfg *Config, path string, body []byte) (json.RawMessage, error) {
	req, err := http.NewRequest("PUT", cfg.APIURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	return doRequest(req)
}

func doRequest(req *http.Request) (json.RawMessage, error) {
	client := &http.Client{Timeout: 60 * time.Second}
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
		p["token_usage"] = map[string]any{
			"input_tokens":            s.InputTok,
			"output_tokens":           s.OutputTok,
			"cache_creation_tokens":   s.CacheCreateTok,
			"cache_read_tokens":       s.CacheReadTok,
			"total_tokens":            s.TotalTok,
		}
	}
	if len(s.Models) > 0 {
		p["models"] = s.Models
	}
	return p
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-3] + "..."
}

func appendDistinct(list []string, v string) []string {
	for _, item := range list {
		if item == v {
			return list
		}
	}
	return append(list, v)
}

func trunc(s string, n int) string {
	return truncate(s, n)
}
