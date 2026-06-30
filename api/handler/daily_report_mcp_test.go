package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aidashboard/api/model"
)

func TestDailyReportMCPToolsList(t *testing.T) {
	h := NewDailyReportMCPHandler(nil)
	req := httptest.NewRequest(http.MethodPost, "/mcp/daily-report", bytes.NewBufferString(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	rec := httptest.NewRecorder()

	h.Serve(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Result struct {
			Tools []struct {
				Name string `json:"name"`
			} `json:"tools"`
		} `json:"result"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Result.Tools) != 2 {
		t.Fatalf("tools len = %d, want 2", len(resp.Result.Tools))
	}
	if resp.Result.Tools[0].Name != dailyReportContextTool || resp.Result.Tools[1].Name != dailyReportSaveDraftTool {
		t.Fatalf("unexpected tools: %#v", resp.Result.Tools)
	}
}

func TestReportMCPToolsList(t *testing.T) {
	h := NewDailyReportMCPHandler(nil)
	req := httptest.NewRequest(http.MethodPost, "/mcp/reports", bytes.NewBufferString(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	rec := httptest.NewRecorder()

	h.ServeReports(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Result struct {
			Tools []struct {
				Name string `json:"name"`
			} `json:"tools"`
		} `json:"result"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	names := map[string]bool{}
	for _, tool := range resp.Result.Tools {
		names[tool.Name] = true
	}
	for _, name := range []string{reportGetContextTool, reportWriteResultTool, reportWriteFailureTool} {
		if !names[name] {
			t.Fatalf("missing tool %s in %#v", name, resp.Result.Tools)
		}
	}
}

func TestReportMCPRejectsUnsupportedReportType(t *testing.T) {
	h := NewDailyReportMCPHandler(nil)
	req := reportMCPRequest(`{"name":"get_report_context","arguments":{"report_type":"team_daily","period":{"date":"2026-06-29"}}}`)
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "team_leader"})
	rec := httptest.NewRecorder()

	h.ServeReports(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "unsupported report_type: team_daily") {
		t.Fatalf("body does not contain unsupported error: %s", rec.Body.String())
	}
}

func TestReportMCPGetContextWithoutRunIDReadsCurrentUserContext(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	now := time.Date(2026, 6, 29, 9, 0, 0, 0, time.UTC)
	mock.ExpectQuery("FROM sessions").
		WithArgs("user-1", "2026-06-29").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("session-1"))
	mock.ExpectQuery("SELECT s.id::text").
		WithArgs("user-1", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows(draftSessionColumns()).
			AddRow("session-1", "ref-1", "claude_code", now, now.Add(20*time.Minute), 1200, "sonnet", "完成 MCP 设计", "{}", nil, "", nil, "", 100, 200, 300))
	mock.ExpectQuery("SELECT t.id::text").
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "title", "requirement_id", "requirement_title", "status", "progress", "owner"}).
			AddRow("task-1", "实现 Report MCP", "req-1", "日报 Agent 化", "in_progress", 60, "张三"))
	mock.ExpectQuery("FROM daily_reports dr").
		WithArgs("user-1", "2026-06-29").
		WillReturnRows(sqlmock.NewRows([]string{"id", "content", "edited", "generation_mode", "managed_agent_run_id", "agent_id", "model_id", "created_at", "updated_at", "finished_at"}))

	h := NewDailyReportMCPHandler(db)
	req := reportMCPRequest(`{"name":"get_report_context","arguments":{"report_type":"personal_daily","period":{"date":"2026-06-29"}}}`)
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.ServeReports(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	payload := decodeMCPTextPayload(t, rec.Body.Bytes())
	report := payload["report"].(map[string]any)
	if report["product_status"] != "missing" {
		t.Fatalf("product_status = %v", report["product_status"])
	}
	context := payload["context"].(map[string]any)
	if len(context["sessions"].([]any)) != 1 {
		t.Fatalf("sessions = %#v", context["sessions"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestReportMCPGetContextRejectsInvalidRunID(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery("FROM ai_runs").
		WithArgs("missing-run", "user-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "agent_id", "model_id", "created_at"}))

	h := NewDailyReportMCPHandler(db)
	req := reportMCPRequest(`{"name":"get_report_context","arguments":{"report_type":"personal_daily","period":{"date":"2026-06-29"},"run_id":"missing-run"}}`)
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.ServeReports(rec, req)

	if !strings.Contains(rec.Body.String(), "invalid run_id") {
		t.Fatalf("body = %s", rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestReportMCPWriteResultCreatesDailyReport(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	createdAt := time.Date(2026, 6, 29, 9, 0, 0, 0, time.UTC)
	expectRunLookup(mock, "run-1", "user-1", "agent-1", "model-1", createdAt)
	mock.ExpectBegin()
	expectReportForUpdate(mock, "user-1", "2026-06-29", nil)
	mock.ExpectQuery("INSERT INTO daily_reports").
		WithArgs("user-1", "2026-06-29", "Agent 生成日报", "run-1", "agent-1", "model-1").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("report-1"))
	mock.ExpectExec("UPDATE ai_runs").
		WithArgs("report-1", sqlmock.AnyArg(), "run-1", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	h := NewDailyReportMCPHandler(db)
	req := reportMCPRequest(`{"name":"write_report_result","arguments":{"report_type":"personal_daily","period":{"date":"2026-06-29"},"run_id":"run-1","content":"Agent 生成日报","summary":"摘要"}}`)
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.ServeReports(rec, req)

	payload := decodeMCPTextPayload(t, rec.Body.Bytes())
	if payload["product_status"] != "ai_generated" {
		t.Fatalf("product_status = %v, body=%s", payload["product_status"], rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestReportMCPWriteResultUpdatesUneditedAIReport(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	createdAt := time.Date(2026, 6, 29, 9, 0, 0, 0, time.UTC)
	expectRunLookup(mock, "run-2", "user-1", "agent-1", "model-1", createdAt)
	mock.ExpectBegin()
	expectReportForUpdate(mock, "user-1", "2026-06-29", &reportForUpdateRow{
		ID: "report-1", Content: "旧内容", Edited: false, GenerationMode: "managed_agent", CreatedAt: createdAt, UpdatedAt: createdAt.Add(5 * time.Minute),
	})
	mock.ExpectQuery("INSERT INTO daily_reports").
		WithArgs("user-1", "2026-06-29", "更新后的 AI 日报", "run-2", "agent-1", "model-1").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("report-1"))
	mock.ExpectExec("UPDATE ai_runs").
		WithArgs("report-1", sqlmock.AnyArg(), "run-2", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	h := NewDailyReportMCPHandler(db)
	req := reportMCPRequest(`{"name":"write_report_result","arguments":{"report_type":"personal_daily","period":{"date":"2026-06-29"},"run_id":"run-2","content":"更新后的 AI 日报"}}`)
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.ServeReports(rec, req)

	if !strings.Contains(rec.Body.String(), "ai_generated") {
		t.Fatalf("body = %s", rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestReportMCPWriteResultDetectsEditedConflict(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	createdAt := time.Date(2026, 6, 29, 9, 0, 0, 0, time.UTC)
	expectRunLookup(mock, "run-1", "user-1", "agent-1", "model-1", createdAt)
	mock.ExpectBegin()
	expectReportForUpdate(mock, "user-1", "2026-06-29", &reportForUpdateRow{
		ID: "report-1", Content: "用户编辑内容", Edited: true, GenerationMode: "managed_agent", CreatedAt: createdAt, UpdatedAt: createdAt.Add(time.Hour),
	})
	mock.ExpectExec("UPDATE ai_runs").
		WithArgs("REPORT_EDIT_CONFLICT: 报告已被用户编辑，AI 回写已取消", "run-1", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	h := NewDailyReportMCPHandler(db)
	req := reportMCPRequest(`{"name":"write_report_result","arguments":{"report_type":"personal_daily","period":{"date":"2026-06-29"},"run_id":"run-1","content":"试图覆盖"}}`)
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.ServeReports(rec, req)

	if !strings.Contains(rec.Body.String(), reportEditConflictCode) {
		t.Fatalf("body = %s", rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestReportMCPWriteFailureDoesNotTouchDailyReport(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	createdAt := time.Date(2026, 6, 29, 9, 0, 0, 0, time.UTC)
	expectRunLookup(mock, "run-1", "user-1", "agent-1", "model-1", createdAt)
	mock.ExpectExec("UPDATE ai_runs").
		WithArgs("Agent 生成失败", "run-1", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	h := NewDailyReportMCPHandler(db)
	req := reportMCPRequest(`{"name":"write_report_failure","arguments":{"report_type":"personal_daily","period":{"date":"2026-06-29"},"run_id":"run-1","error_message":"Agent 生成失败"}}`)
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.ServeReports(rec, req)

	payload := decodeMCPTextPayload(t, rec.Body.Bytes())
	if payload["status"] != "failed" {
		t.Fatalf("status = %v, body=%s", payload["status"], rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func reportMCPRequest(params string) *http.Request {
	body := `{"jsonrpc":"2.0","id":"test","method":"tools/call","params":` + params + `}`
	return httptest.NewRequest(http.MethodPost, "/mcp/reports", bytes.NewBufferString(body))
}

func decodeMCPTextPayload(t *testing.T, body []byte) map[string]any {
	t.Helper()
	var resp struct {
		Result struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		} `json:"result"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Error != nil {
		t.Fatalf("mcp error: %s", resp.Error.Message)
	}
	if len(resp.Result.Content) == 0 {
		t.Fatalf("missing MCP text content: %s", string(body))
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(resp.Result.Content[0].Text), &payload); err != nil {
		t.Fatalf("payload decode: %v; text=%s", err, resp.Result.Content[0].Text)
	}
	return payload
}

func expectRunLookup(mock sqlmock.Sqlmock, runID, userID, agentID, modelID string, createdAt time.Time) {
	mock.ExpectQuery("FROM ai_runs").
		WithArgs(runID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "agent_id", "model_id", "created_at"}).
			AddRow(runID, agentID, modelID, createdAt))
}

type reportForUpdateRow struct {
	ID             string
	Content        string
	Edited         bool
	GenerationMode string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func expectReportForUpdate(mock sqlmock.Sqlmock, userID, reportDate string, row *reportForUpdateRow) {
	rows := sqlmock.NewRows([]string{"id", "content", "edited", "generation_mode", "managed_agent_run_id", "agent_id", "model_id", "created_at", "updated_at", "finished_at"})
	if row != nil {
		rows.AddRow(row.ID, row.Content, row.Edited, row.GenerationMode, nil, nil, nil, row.CreatedAt, row.UpdatedAt, nil)
	}
	mock.ExpectQuery("FOR UPDATE OF dr").
		WithArgs(userID, reportDate).
		WillReturnRows(rows)
}
