package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/aidashboard/api/model"
	"github.com/go-chi/chi/v5"
)

type ReportHandler struct {
	db *sql.DB
}

func NewReportHandler(db *sql.DB) *ReportHandler {
	return &ReportHandler{db: db}
}

func (h *ReportHandler) List(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	query := `
		SELECT dr.id, dr.user_id, u.name, dr.report_date, dr.content, dr.edited,
			dr.feishu_doc_url, dr.session_ids, dr.created_at, dr.updated_at
		FROM daily_reports dr
		JOIN users u ON u.id = dr.user_id
		WHERE 1=1`
	args := []any{}
	argIdx := 1

	if u.Role == "employee" {
		query += fmt.Sprintf(" AND dr.user_id = $%d", argIdx)
		args = append(args, u.ID)
		argIdx++
	} else if u.Role == "team_leader" && u.TeamID != nil {
		query += fmt.Sprintf(" AND dr.user_id IN (SELECT id FROM users WHERE team_id = $%d)", argIdx)
		args = append(args, *u.TeamID)
		argIdx++
	}

	if from := r.URL.Query().Get("from"); from != "" {
		query += fmt.Sprintf(" AND dr.report_date >= $%d", argIdx)
		args = append(args, from)
		argIdx++
	}
	if to := r.URL.Query().Get("to"); to != "" {
		query += fmt.Sprintf(" AND dr.report_date <= $%d", argIdx)
		args = append(args, to)
		argIdx++
	}

	query += " ORDER BY dr.report_date DESC"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	var reports []model.DailyReport
	for rows.Next() {
		var dr model.DailyReport
		var feishuURL sql.NullString
		var sessionIDsStr string
		rows.Scan(&dr.ID, &dr.UserID, &dr.UserName, &dr.ReportDate, &dr.Content, &dr.Edited,
			&feishuURL, &sessionIDsStr, &dr.CreatedAt, &dr.UpdatedAt)
		dr.FeishuDocURL = nullStringPtr(feishuURL)
		dr.SessionIDs = parseUUIDArray(sessionIDsStr)
		reports = append(reports, dr)
	}

	writeJSON(w, http.StatusOK, reports)
}

func (h *ReportHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var dr model.DailyReport
	var feishuURL sql.NullString
	var sessionIDsStr string

	err := h.db.QueryRow(`
		SELECT dr.id, dr.user_id, u.name, dr.report_date, dr.content, dr.edited,
			dr.feishu_doc_url, dr.session_ids, dr.created_at, dr.updated_at
		FROM daily_reports dr
		JOIN users u ON u.id = dr.user_id
		WHERE dr.id = $1`, id).Scan(
		&dr.ID, &dr.UserID, &dr.UserName, &dr.ReportDate, &dr.Content, &dr.Edited,
		&feishuURL, &sessionIDsStr, &dr.CreatedAt, &dr.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	dr.FeishuDocURL = nullStringPtr(feishuURL)
	dr.SessionIDs = parseUUIDArray(sessionIDsStr)
	writeJSON(w, http.StatusOK, dr)
}

func (h *ReportHandler) GetOrCreateToday(w http.ResponseWriter, r *http.Request) {
	u := getUser(r)
	today := time.Now().Format("2006-01-02")

	var dr model.DailyReport
	var feishuURL sql.NullString
	var sessionIDsStr string

	err := h.db.QueryRow(`
		SELECT dr.id, dr.user_id, u.name, dr.report_date, dr.content, dr.edited,
			dr.feishu_doc_url, dr.session_ids, dr.created_at, dr.updated_at
		FROM daily_reports dr
		JOIN users u ON u.id = dr.user_id
		WHERE dr.user_id = $1 AND dr.report_date = $2`, u.ID, today).Scan(
		&dr.ID, &dr.UserID, &dr.UserName, &dr.ReportDate, &dr.Content, &dr.Edited,
		&feishuURL, &sessionIDsStr, &dr.CreatedAt, &dr.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		content := h.generateReportContent(u.ID, today)
		var reportID string
		err := h.db.QueryRow(`
			INSERT INTO daily_reports (user_id, report_date, content)
			VALUES ($1, $2, $3) RETURNING id`, u.ID, today, content).Scan(&reportID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		dr = model.DailyReport{
			ID:         reportID,
			UserID:     u.ID,
			UserName:   u.Name,
			ReportDate: today,
			Content:    content,
		}
	} else if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	dr.FeishuDocURL = nullStringPtr(feishuURL)
	dr.SessionIDs = parseUUIDArray(sessionIDsStr)
	writeJSON(w, http.StatusOK, dr)
}

func (h *ReportHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req model.UpdateReportRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	sets := []string{"updated_at = now()"}
	args := []any{}
	argIdx := 1

	if req.Content != nil {
		sets = append(sets, fmt.Sprintf("content = $%d, edited = true", argIdx))
		args = append(args, *req.Content)
		argIdx++
	}
	if req.FeishuDocURL != nil {
		sets = append(sets, fmt.Sprintf("feishu_doc_url = $%d", argIdx))
		args = append(args, *req.FeishuDocURL)
		argIdx++
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE daily_reports SET %s WHERE id = $%d", joinWithCommas(sets), argIdx)

	res, err := h.db.Exec(query, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if rows, _ := res.RowsAffected(); rows == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}

	h.Get(w, r)
}

func (h *ReportHandler) generateReportContent(userID, date string) string {
	rows, err := h.db.Query(`
		SELECT s.session_ref, s.started_at, s.ended_at, s.model, s.summary,
			s.task_id, COALESCE(t.title,'')
		FROM sessions s
		LEFT JOIN tasks t ON t.id = s.task_id
		WHERE s.user_id = $1 AND DATE(s.started_at) = $2
		ORDER BY s.started_at`, userID, date)
	if err != nil {
		return fmt.Sprintf("# 日报 %s\n\n暂无 session 数据。", date)
	}
	defer rows.Close()

	content := fmt.Sprintf("# 日报 %s\n\n## 今日 Session\n\n", date)
	count := 0
	for rows.Next() {
		var ref, model string
		var startedAt, endedAt sql.NullString
		var summary, taskID, taskTitle sql.NullString
		rows.Scan(&ref, &startedAt, &endedAt, &model, &summary, &taskID, &taskTitle)
		count++
		taskInfo := ""
		if taskTitle.Valid && taskTitle.String != "" {
			taskInfo = fmt.Sprintf(" [%s]", taskTitle.String)
		}
		summaryText := "无摘要"
		if summary.Valid && summary.String != "" {
			summaryText = summary.String
		}
		content += fmt.Sprintf("%d. `%s` (%s)%s - %s\n", count, ref[:12], model, taskInfo, summaryText)
	}

	if count == 0 {
		content += "暂无 session 数据。\n"
	}

	var totalTokens int64
	h.db.QueryRow(`
		SELECT COALESCE(SUM(total_tokens), 0) FROM token_usage
		WHERE user_id = $1 AND DATE(recorded_at) = $2`, userID, date).Scan(&totalTokens)

	content += fmt.Sprintf("\n## Token 消耗\n\n今日合计: %d tokens\n", totalTokens)
	return content
}

func parseUUIDArray(pgArray string) []string {
	return parseTextArray(pgArray)
}

func joinWithCommas(items []string) string {
	result := ""
	for i, item := range items {
		if i > 0 {
			result += ", "
		}
		result += item
	}
	return result
}
