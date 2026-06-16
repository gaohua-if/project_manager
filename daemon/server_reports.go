package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/lib/pq"
)

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
	fmt.Printf("[report-generator] generating team report team_id=%s leader_id=%s date=%s\n", teamID, leaderID, targetDate)
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
	teamCfg := cfg
	if teamCfg.ClaudeTimeout > 20*time.Second {
		teamCfg.ClaudeTimeout = 20 * time.Second
	}
	content, err := generateDailyReportWithClaude(teamCfg, prompt)
	if err != nil {
		fmt.Printf("[report-generator] claude team report generation failed, using fallback: %v\n", err)
		content = buildTeamReportFallback(targetDate, teamName, *leader, leaderSessions, memberReports)
	}
	if strings.TrimSpace(content) == "" {
		content = buildTeamReportFallback(targetDate, teamName, *leader, leaderSessions, memberReports)
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

func buildTeamReportFallback(reportDate, teamName string, leader reportUser, sessions []reportSession, memberReports []teamMemberDailyReport) string {
	var b strings.Builder
	totalTokens := int64(0)
	for _, s := range sessions {
		totalTokens += s.TotalTokens
	}
	memberReportCount := 0
	for _, mr := range memberReports {
		if strings.TrimSpace(mr.Content) != "" {
			memberReportCount++
		}
	}

	fmt.Fprintf(&b, "# %s 团队日报\n\n", reportDate)
	fmt.Fprintf(&b, "## 团队总结\n\n")
	fmt.Fprintf(&b, "%s 今日汇总了 TL 工作记录 %d 条、组员日报 %d 份。", teamName, len(sessions), memberReportCount)
	if len(sessions) == 0 && memberReportCount == 0 {
		b.WriteString("当前没有可用于生成日报的工作数据。")
	}
	b.WriteString("\n\n")

	b.WriteString("## TL 工作\n\n")
	fmt.Fprintf(&b, "负责人：%s\n\n", leader.Name)
	if len(sessions) == 0 {
		b.WriteString("暂无 TL 当日工作记录。\n\n")
	} else {
		fmt.Fprintf(&b, "- 工作记录数：%d\n", len(sessions))
		fmt.Fprintf(&b, "- Token 总量：%d\n\n", totalTokens)
		for i, s := range sessions {
			fmt.Fprintf(&b, "### 记录 %d\n\n", i+1)
			fmt.Fprintf(&b, "- Session：%s\n", s.SessionRef)
			fmt.Fprintf(&b, "- 时间：%s", s.StartedAt.Format(time.RFC3339))
			if s.EndedAt.Valid {
				fmt.Fprintf(&b, " - %s", s.EndedAt.Time.Format(time.RFC3339))
			}
			b.WriteString("\n")
			if s.TaskTitle.Valid && s.TaskTitle.String != "" {
				fmt.Fprintf(&b, "- 任务：%s\n", s.TaskTitle.String)
			}
			if s.RequirementTitle.Valid && s.RequirementTitle.String != "" {
				fmt.Fprintf(&b, "- 需求：%s\n", s.RequirementTitle.String)
			}
			fmt.Fprintf(&b, "- 摘要：%s\n\n", nullStringValue(s.Summary, "暂无"))
		}
	}

	b.WriteString("## 组员日报\n\n")
	if len(memberReports) == 0 {
		b.WriteString("暂无组员日报。\n\n")
	} else {
		for _, mr := range memberReports {
			fmt.Fprintf(&b, "### %s\n\n", mr.UserName)
			if strings.TrimSpace(mr.Content) == "" {
				b.WriteString("暂无日报。\n\n")
			} else {
				fmt.Fprintf(&b, "%s\n\n", strings.TrimSpace(mr.Content))
			}
		}
	}

	b.WriteString("## 问题与风险\n\n暂无。\n\n")
	b.WriteString("## 明日计划\n\n暂无。\n")
	return b.String()
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

func writePlainJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
