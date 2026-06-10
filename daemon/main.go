package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	APIURL       string            `yaml:"api_url"`
	Token        string            `yaml:"token"`
	ScanInterval string            `yaml:"scan_interval"`
	LastUploaded map[string]string `yaml:"last_uploaded"`
}

type Event struct {
	Type      string `json:"type"`
	SessionID string `json:"sessionId"`
	Timestamp string `json:"timestamp"`
	Message   json.RawMessage `json:"message"`
}

type AssistantMessage struct {
	Model  string `json:"model"`
	Usage  *Usage `json:"usage"`
	Content []ContentBlock `json:"content"`
}

type Usage struct {
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
}

type ContentBlock struct {
	Type string `json:"type"`
	Name string `json:"name"`
}

type ParsedSession struct {
	SessionRef  string
	StartedAt   time.Time
	EndedAt     *time.Time
	Model       string
	Summary     *string
	ToolCalls   map[string]int
	GitCommits  []string
	InputTokens  int64
	OutputTokens int64
	TotalTokens  int64
}

type UploadPayload struct {
	Sessions []SessionPayload `json:"sessions"`
}

type SessionPayload struct {
	SessionRef   string         `json:"session_ref"`
	StartedAt    time.Time      `json:"started_at"`
	EndedAt      *string        `json:"ended_at,omitempty"`
	DurationSecs *int           `json:"duration_secs,omitempty"`
	Model        string         `json:"model"`
	Summary      *string        `json:"summary,omitempty"`
	ToolCalls    map[string]int `json:"tool_calls,omitempty"`
	GitCommits   []string       `json:"git_commits,omitempty"`
	TokenUsage   *TokenPayload  `json:"token_usage,omitempty"`
}

type TokenPayload struct {
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
	TotalTokens  int64 `json:"total_tokens"`
}

const configPath = ".aidashboard-daemon.yaml"

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: aidashboard <command> [args]")
		fmt.Println("Commands: config, upload, daemon")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "config":
		cmdConfig()
	case "upload":
		cmdUpload()
	case "daemon":
		cmdDaemon()
	default:
		fmt.Printf("Unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}
}

func cmdConfig() {
	cfg := loadConfig()
	args := os.Args[2:]
	for i := 0; i < len(args)-1; i += 2 {
		switch args[i] {
		case "--api-url":
			cfg.APIURL = args[i+1]
		case "--token":
			cfg.Token = args[i+1]
		case "--scan-interval":
			cfg.ScanInterval = args[i+1]
		}
	}
	saveConfig(cfg)
	fmt.Println("Config saved to", configPath)
}

func cmdUpload() {
	cfg := loadConfig()
	if cfg.APIURL == "" || cfg.Token == "" {
		log.Fatal("Run 'aidashboard config --api-url=... --token=...' first")
	}

	home, _ := os.UserHomeDir()
	claudeDir := filepath.Join(home, ".claude", "projects")

	sessions := scanAndParse(claudeDir)
	if len(sessions) == 0 {
		fmt.Println("No new sessions found")
		return
	}

	uploaded := upload(cfg, sessions)
	fmt.Printf("Uploaded %d sessions\n", uploaded)
}

func cmdDaemon() {
	cfg := loadConfig()
	if cfg.APIURL == "" || cfg.Token == "" {
		log.Fatal("Run 'aidashboard config --api-url=... --token=...' first")
	}

	interval := 5 * time.Minute
	if cfg.ScanInterval != "" {
		if d, err := time.ParseDuration(cfg.ScanInterval); err == nil {
			interval = d
		}
	}

	home, _ := os.UserHomeDir()
	claudeDir := filepath.Join(home, ".claude", "projects")

	fmt.Printf("Daemon started, scanning every %s\n", interval)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		sessions := scanAndParse(claudeDir)
		if len(sessions) > 0 {
			uploaded := upload(cfg, sessions)
			fmt.Printf("[%s] Uploaded %d sessions\n", time.Now().Format("15:04:05"), uploaded)
		}
		<-ticker.C
	}
}

func scanAndParse(claudeDir string) []*ParsedSession {
	var sessions []*ParsedSession

	filepath.WalkDir(claudeDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(d.Name(), ".jsonl") {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return nil
		}

		if time.Since(info.ModTime()) > 24*time.Hour {
			return nil
		}

		session := parseJSONL(path)
		if session != nil && session.SessionRef != "" {
			sessions = append(sessions, session)
		}
		return nil
	})

	return sessions
}

func parseJSONL(path string) *ParsedSession {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	session := &ParsedSession{
		ToolCalls: make(map[string]int),
	}

	scanner := bufio.NewScanner(f)
	buf := make([]byte, 0, 1024*1024)
	scanner.Buffer(buf, 10*1024*1024)

	firstUserMsg := true

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var event Event
		if err := json.Unmarshal(line, &event); err != nil {
			continue
		}

		switch event.Type {
		case "summary":
			if session.SessionRef == "" {
				session.SessionRef = event.SessionID
			}

		case "user":
			if session.SessionRef == "" {
				session.SessionRef = event.SessionID
			}
			if firstUserMsg && session.Summary == nil {
				var msg struct {
					Content []struct {
						Type string `json:"type"`
						Text string `json:"text"`
					} `json:"content"`
				}
				if json.Unmarshal(event.Message, &msg) == nil {
					for _, c := range msg.Content {
						if c.Type == "text" && c.Text != "" {
							text := c.Text
							if len(text) > 200 {
								text = text[:200] + "..."
							}
							session.Summary = &text
							break
						}
					}
				}
				firstUserMsg = false
			}

		case "assistant":
			if session.SessionRef == "" {
				session.SessionRef = event.SessionID
			}
			var msg AssistantMessage
			if json.Unmarshal(event.Message, &msg) == nil {
				if msg.Model != "" && msg.Model != "<synthetic>" {
					session.Model = msg.Model
				}
				if msg.Usage != nil {
					session.InputTokens += msg.Usage.InputTokens
					session.OutputTokens += msg.Usage.OutputTokens
				}
				for _, c := range msg.Content {
					if c.Type == "tool_use" {
						session.ToolCalls[c.Name]++
					}
				}
			}
		}
	}

	session.TotalTokens = session.InputTokens + session.OutputTokens

	if session.SessionRef == "" {
		return nil
	}

	session.StartedAt = time.Now().Add(-time.Minute)

	if session.TotalTokens > 0 {
		return session
	}
	return nil
}

func upload(cfg *Config, sessions []*ParsedSession) int {
	payload := UploadPayload{
		Sessions: make([]SessionPayload, 0, len(sessions)),
	}

	for _, s := range sessions {
		var endedAt *string
		var durationSecs *int
		if s.EndedAt != nil {
			t := s.EndedAt.Format(time.RFC3339)
			endedAt = &t
			d := int(s.EndedAt.Sub(s.StartedAt).Seconds())
			durationSecs = &d
		}

		var tokenUsage *TokenPayload
		if s.TotalTokens > 0 {
			tokenUsage = &TokenPayload{
				InputTokens:  s.InputTokens,
				OutputTokens: s.OutputTokens,
				TotalTokens:  s.TotalTokens,
			}
		}

		payload.Sessions = append(payload.Sessions, SessionPayload{
			SessionRef:   s.SessionRef,
			StartedAt:    s.StartedAt,
			EndedAt:      endedAt,
			DurationSecs: durationSecs,
			Model:        s.Model,
			Summary:      s.Summary,
			ToolCalls:    s.ToolCalls,
			GitCommits:   s.GitCommits,
			TokenUsage:   tokenUsage,
		})
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", cfg.APIURL+"/sessions/batch", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.Token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("Upload failed: %v", err)
		return 0
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Upload returned status %d", resp.StatusCode)
		return 0
	}

	return len(sessions)
}

func loadConfig() *Config {
	home, _ := os.UserHomeDir()
	data, err := os.ReadFile(filepath.Join(home, configPath))
	if err != nil {
		return &Config{
			LastUploaded: make(map[string]string),
		}
	}
	var cfg Config
	if yaml.Unmarshal(data, &cfg) != nil {
		return &Config{LastUploaded: make(map[string]string)}
	}
	if cfg.LastUploaded == nil {
		cfg.LastUploaded = make(map[string]string)
	}
	return &cfg
}

func saveConfig(cfg *Config) {
	home, _ := os.UserHomeDir()
	data, _ := yaml.Marshal(cfg)
	os.WriteFile(filepath.Join(home, configPath), data, 0600)
}
