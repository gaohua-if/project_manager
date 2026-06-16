package main

import (
	"fmt"
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

const (
	configFileName       = ".aida.yaml"
	legacyConfigFileName = ".aidashboard.yaml"
)

func configPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, configFileName)
}

func legacyConfigPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, legacyConfigFileName)
}

func loadConfig() *Config {
	path := configPath()
	data, err := os.ReadFile(path)
	if err != nil {
		data, err = os.ReadFile(legacyConfigPath())
	}
	if err != nil {
		return configFromEnv(&Config{})
	}
	var cfg Config
	yaml.Unmarshal(data, &cfg)
	return configFromEnv(&cfg)
}

func configFromEnv(cfg *Config) *Config {
	if v := os.Getenv("AIDA_API_URL"); v != "" {
		cfg.APIURL = strings.TrimRight(v, "/")
	} else if v := os.Getenv("AIDASHBOARD_API_URL"); v != "" {
		cfg.APIURL = strings.TrimRight(v, "/")
	}
	if v := os.Getenv("AIDA_TOKEN"); v != "" {
		cfg.Token = v
	} else if v := os.Getenv("AIDASHBOARD_TOKEN"); v != "" {
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
		fmt.Println("Not logged in. Run: aida login")
		os.Exit(1)
	}
	if cfg.APIURL == "" {
		fmt.Println("Server URL not set. Run: aida login --server <url>")
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
	fmt.Print(`aida - CLI for uploading Claude Code sessions to Aida

Usage:
  aida <command> [options]

Commands:
  login    --server <url> --token <token>   Login with server URL and API token
  sessions [--all] [--project <dir>]        List local Claude Code sessions
  upload   [numbers...] [--all]             Upload sessions to server
  consume  [--once]                         Upload sessions and generate daily report
  serve                                      Run report generator HTTP service
  status                                     Show current login status

Examples:
  # Login with platform token
  aida login --server http://localhost:8080/api/v1 --token eyJhbG...

  # Login interactively (enter token when prompted)
  aida login --server http://localhost:8080/api/v1

  # List recent sessions (last 48h)
  aida sessions

  # List all sessions
  aida sessions --all

  # Filter by project directory
  aida sessions --project project-manager

  # Upload specific sessions by number
  aida upload 1 3 5

  # Upload all recent sessions
  aida upload --all

  # Run the server-side report generator
  DATABASE_URL=postgres://... PORT=8090 aida serve

  # Interactive upload (shows picker)
  aida upload

  # Check login status
  aida status

Session logs location:
  ~/.claude/projects/

Documentation:
  PRD:        See PRD.md in the project repository
  Prototype:  See prototype.html in the project repository
  API:        http://localhost:8080/health  (health check)
`)
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
	if v := envFirst("AIDA_CLAUDE_DIR", "AIDASHBOARD_CLAUDE_DIR"); v != "" {
		cfg.ClaudeDir = v
	}
	if v := envFirst("AIDA_PROJECT", "AIDASHBOARD_PROJECT"); v != "" {
		cfg.ProjectFilter = v
	}
	if v := envFirst("AIDA_DAILY_AT", "AIDASHBOARD_DAILY_AT"); v != "" {
		cfg.DailyAt = v
	}
	if v := envFirst("AIDA_RUN_ON_START", "AIDASHBOARD_RUN_ON_START"); v != "" {
		cfg.RunOnStart = v != "0" && strings.ToLower(v) != "false"
	}
	if v := envFirst("AIDA_REPORT_DATE_OFFSET", "AIDASHBOARD_REPORT_DATE_OFFSET"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.ReportOffset = n
		}
	}
	if v := envFirst("AIDA_CLAUDE_BIN", "AIDASHBOARD_CLAUDE_BIN"); v != "" {
		cfg.ClaudeBin = v
	}
	if v := envFirst("AIDA_CLAUDE_TIMEOUT", "AIDASHBOARD_CLAUDE_TIMEOUT"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			cfg.ClaudeTimeout = d
		}
	}
	return cfg
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func envFirst(keys ...string) string {
	for _, key := range keys {
		if v := os.Getenv(key); v != "" {
			return v
		}
	}
	return ""
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
