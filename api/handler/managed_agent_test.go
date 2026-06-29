package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
	"github.com/go-chi/chi/v5"
)

func requestWithURLParam(req *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func TestStartAgentRunAllowsDefaultModelAndRecordsManualRun(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	var submitted service.SubmitManagedTaskRequest
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/task/submit" {
			t.Fatalf("platform path = %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer platform-token" {
			t.Fatalf("authorization = %q", got)
		}
		if err := json.NewDecoder(r.Body).Decode(&submitted); err != nil {
			t.Fatal(err)
		}
		writeJSON(w, http.StatusOK, service.SubmitManagedTaskResponse{
			TaskID: "task-123",
			Status: "queued",
		})
	}))
	defer platform.Close()

	now := time.Date(2026, 6, 26, 10, 0, 0, 0, time.UTC)
	mock.ExpectQuery("INSERT INTO ai_runs").
		WithArgs(int64(1), "manual_agent_run", "agent-1", "task-123", nil, "pending", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("run-1"))
	mock.ExpectQuery("SELECT id::text").
		WithArgs("run-1", int64(1)).
		WillReturnRows(sqlmock.NewRows(aiRunColumns()).
			AddRow("run-1", int64(1), "manual_agent_run", nil, "managed_task", "agent-1", nil, "task-123", nil, nil, "pending", []byte(`{"message":"生成日报","params":{"report_date":"2026-06-26"},"trigger_source":"manual"}`), []byte(`{}`), nil, now, nil, now))

	h := NewManagedAgentHandler(db, service.NewManagedAgentClient(platform.URL, "platform-token"))
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/agents/agent-1/runs", bytes.NewBufferString(`{"message":"生成日报","params":{"report_date":"2026-06-26"}}`))
	req = requestWithUser(req, &model.User{ID: 1, Name: "张三", Role: "employee"})
	req = requestWithURLParam(req, "agentId", "agent-1")
	rec := httptest.NewRecorder()

	h.StartAgentRun(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if submitted.AgentID != "agent-1" {
		t.Fatalf("agent_id = %q", submitted.AgentID)
	}
	if submitted.ModelID != "" {
		t.Fatalf("model_id should be empty for default model, got %q", submitted.ModelID)
	}
	if submitted.Params["message"] != "生成日报" || submitted.Params["report_date"] != "2026-06-26" {
		t.Fatalf("params = %#v", submitted.Params)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestDailyReportIntegrationReturnsMCPAndSkill(t *testing.T) {
	h := NewManagedAgentHandler(nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/ai-assets/daily-report-integration", nil)
	req.Host = "aida.example.com"
	req.Header.Set("X-Forwarded-Proto", "https")
	rec := httptest.NewRecorder()

	h.DailyReportIntegration(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var got struct {
		MCP struct {
			URL   string   `json:"url"`
			Tools []string `json:"tools"`
		} `json:"mcp"`
		Skill struct {
			Slug    string `json:"slug"`
			Version string `json:"version"`
			SkillMD string `json:"skill_md"`
		} `json:"skill"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.MCP.URL != "https://aida.example.com/api/v1/mcp/daily-report" {
		t.Fatalf("mcp url = %q", got.MCP.URL)
	}
	if got.Skill.Slug != service.DailyReportSkillSlug || got.Skill.Version != service.DailyReportSkillVersion {
		t.Fatalf("skill ref = %s@%s", got.Skill.Slug, got.Skill.Version)
	}
	if !strings.Contains(got.Skill.SkillMD, got.MCP.URL) {
		t.Fatalf("skill markdown should include mcp url")
	}
	if len(got.MCP.Tools) != 2 {
		t.Fatalf("tools = %#v", got.MCP.Tools)
	}
}

func TestStartDailyReportRunSubmitsUrlsStartPromptValues(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	var submitted service.SubmitManagedTaskRequest
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/task/submit" {
			t.Fatalf("platform path = %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&submitted); err != nil {
			t.Fatal(err)
		}
		writeJSON(w, http.StatusOK, service.SubmitManagedTaskResponse{
			TaskID: "task-urls",
			Status: "queued",
		})
	}))
	defer platform.Close()

	now := time.Date(2026, 6, 29, 10, 30, 0, 0, time.UTC)
	mock.ExpectQuery("SELECT s.id::text").
		WithArgs(int64(1), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows(draftSessionColumns()).
			AddRow("session-1", "ref-1", "claude_code", now, now.Add(20*time.Minute), 1200, "sonnet", "完成日报", "{}", "logs/session-1.jsonl", nil, "", nil, "", 100, 200, 300))
	mock.ExpectQuery("INSERT INTO ai_runs").
		WithArgs(int64(1), "daily_report", "aida-daily-report-agent", "task-urls", "Kimi-K2.6", "pending", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("run-1"))
	mock.ExpectQuery("SELECT id::text").
		WithArgs("run-1", int64(1)).
		WillReturnRows(sqlmock.NewRows(aiRunColumns()).
			AddRow("run-1", int64(1), "daily_report", nil, "managed_task", "aida-daily-report-agent", nil, "task-urls", nil, "Kimi-K2.6", "pending", []byte(`{"report_date":"2026-06-29","session_ids":["session-1"],"urls":["https://aida.example.com/api/v1/sessions/session-1/log"]}`), []byte(`{}`), nil, now, nil, now))

	h := NewManagedAgentHandler(db, service.NewManagedAgentClient(platform.URL, "platform-token"))
	req := httptest.NewRequest(http.MethodPost, "/reports/today/managed-agent-runs", bytes.NewBufferString(`{"report_date":"2026-06-29","session_ids":["session-1"],"agent_id":"aida-daily-report-agent"}`))
	req.Host = "aida.example.com"
	req.Header.Set("X-Forwarded-Proto", "https")
	req = requestWithUser(req, &model.User{ID: 1, Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.StartDailyReportRun(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if submitted.AgentID != "aida-daily-report-agent" {
		t.Fatalf("agent_id = %q", submitted.AgentID)
	}
	if submitted.ModelID != "Kimi-K2.6" {
		t.Fatalf("model_id = %q", submitted.ModelID)
	}
	if submitted.Params["urls"] != `["https://aida.example.com/api/v1/sessions/session-1/log"]` {
		t.Fatalf("urls = %q", submitted.Params["urls"])
	}
	if _, ok := submitted.Params["message"]; ok {
		t.Fatalf("message param should not be submitted: %#v", submitted.Params)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestCreateAgentScheduleValidatesAndReturnsSchedule(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	now := time.Date(2026, 6, 26, 10, 0, 0, 0, time.UTC)
	mock.ExpectQuery("INSERT INTO managed_agent_schedules").
		WithArgs(int64(1), "日报定时", "agent-1", "Kimi-K2.6", "生成日报", sqlmock.AnyArg(), "weekly", sqlmock.AnyArg(), "19:00", "Asia/Shanghai", true).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("schedule-1"))
	mock.ExpectQuery("SELECT id::text").
		WithArgs("schedule-1", int64(1)).
		WillReturnRows(sqlmock.NewRows(agentScheduleColumns()).
			AddRow("schedule-1", int64(1), "日报定时", "agent-1", "Kimi-K2.6", "生成日报", []byte(`{"report_date":"today"}`), "weekly", []byte(`[1,2,3,4,5]`), "19:00", "Asia/Shanghai", true, nil, nil, now, now))

	h := NewManagedAgentHandler(db, nil)
	body := `{"name":"日报定时","agent_id":"agent-1","model_id":"Kimi-K2.6","message":"生成日报","params":{"report_date":"today"},"schedule_type":"weekly","weekdays":[1,2,3,4,5],"time_of_day":"19:00","timezone":"Asia/Shanghai","enabled":true}`
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/agent-schedules", bytes.NewBufferString(body))
	req = requestWithUser(req, &model.User{ID: 1, Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.CreateAgentSchedule(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var got model.ManagedAgentSchedule
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != "schedule-1" || got.ScheduleType != "weekly" || len(got.Weekdays) != 5 || got.ModelID == nil || *got.ModelID != "Kimi-K2.6" {
		t.Fatalf("schedule = %#v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestCreateAgentScheduleRejectsInvalidTime(t *testing.T) {
	h := NewManagedAgentHandler(nil, nil)
	body := `{"name":"日报定时","agent_id":"agent-1","message":"生成日报","schedule_type":"daily","time_of_day":"25:00"}`
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/agent-schedules", bytes.NewBufferString(body))
	req = requestWithUser(req, &model.User{ID: 1, Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.CreateAgentSchedule(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
}

func aiRunColumns() []string {
	return []string{
		"id", "user_id", "business_type", "business_id", "runtime_type",
		"agent_id", "agent_version_id", "external_task_id", "external_session_id", "model_id",
		"status", "input_ref_json", "output_ref_json", "error_message", "started_at", "finished_at", "created_at",
	}
}

func agentScheduleColumns() []string {
	return []string{
		"id", "user_id", "name", "agent_id", "model_id", "message",
		"params_json", "schedule_type", "weekdays_json", "time_of_day", "timezone",
		"enabled", "last_run_at", "last_ai_run_id", "created_at", "updated_at",
	}
}
