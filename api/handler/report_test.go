package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aidashboard/api/model"
	"github.com/go-chi/chi/v5"
)

func requestWithUser(req *http.Request, user *model.User) *http.Request {
	return req.WithContext(context.WithValue(req.Context(), userKey, user))
}

func requestWithReportID(req *http.Request, id string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", id)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func TestGenerateTodayDraftRequiresSessionIDs(t *testing.T) {
	h := NewReportHandler(nil, "http://generator")
	req := httptest.NewRequest(http.MethodPost, "/reports/today/draft", bytes.NewBufferString(`{"session_ids":[],"skill_id":"default_daily"}`))
	req = requestWithUser(req, &model.User{ID: 1, Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.GenerateTodayDraft(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestGenerateTodayDraftRejectsUnsupportedSkill(t *testing.T) {
	h := NewReportHandler(nil, "http://generator")
	req := httptest.NewRequest(http.MethodPost, "/reports/today/draft", bytes.NewBufferString(`{"session_ids":["session-1"],"skill_id":"other"}`))
	req = requestWithUser(req, &model.User{ID: 1, Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.GenerateTodayDraft(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestGenerateTodayDraftRejectsInaccessibleSession(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT s.id::text").
		WithArgs(int64(1), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows(draftSessionColumns()))

	h := NewReportHandler(db, "http://generator")
	req := httptest.NewRequest(http.MethodPost, "/reports/today/draft", bytes.NewBufferString(`{"session_ids":["session-other"],"skill_id":"default_daily","include_task_progress":true}`))
	req = requestWithUser(req, &model.User{ID: 1, Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.GenerateTodayDraft(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d; body=%s", rec.Code, http.StatusForbidden, rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestGenerateTodayDraftSuccessDoesNotWriteDailyReports(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	now := time.Date(2026, 6, 24, 9, 30, 0, 0, time.UTC)
	mock.ExpectQuery("SELECT s.id::text").
		WithArgs(int64(1), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows(draftSessionColumns()).
			AddRow("session-1", "ref-1", "claude_code", now, now.Add(20*time.Minute), 1200, "sonnet", "完成 Dashboard 接入", "{}", "logs/session-1.jsonl", nil, "", nil, "", 100, 200, 300).
			AddRow("session-2", "ref-2", "codex", now.Add(2*time.Hour), nil, nil, "gpt", "补充测试", "{}", "logs/session-2.jsonl", nil, "", nil, "", 20, 30, 50))
	mock.ExpectQuery("SELECT t.id::text").
		WithArgs(int64(1)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "title", "requirement_id", "requirement_title", "status", "progress", "owner"}).
			AddRow("task-1", "控制台日报交互设计", "req-1", "日报入口状态优化", "in_progress", 40, "张三"))

	generator := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/reports/draft" {
			t.Fatalf("generator path = %s", r.URL.Path)
		}
		var payload model.ReportDraftGeneratorRequest
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if len(payload.Sessions) != 2 || payload.Sessions[0].ID != "session-1" {
			t.Fatalf("payload sessions = %#v", payload.Sessions)
		}
		if payload.SkillContent != "补充 skill" {
			t.Fatalf("skill content = %q", payload.SkillContent)
		}
		writeJSON(w, http.StatusOK, model.GenerateReportDraftResponse{
			ReportMarkdown:     "# 6 月 24 日日报\n\n## 今日完成\n完成接入\n\n## 风险与阻塞\n暂无\n\n## 明日计划\n继续验证",
			SelectedSessionIDs: []string{"from-generator-should-be-overwritten"},
			SkillName:          "默认日报 Skill",
			TaskProgressSuggestions: []model.TaskProgressSuggestion{
				{
					TaskID:             "task-1",
					SuggestedStatus:    "in_progress",
					SuggestedProgress:  75,
					EvidenceSessionIDs: []string{"session-1", "not-selected"},
					Reason:             "session 证据明确",
				},
			},
		})
	}))
	defer generator.Close()

	h := NewReportHandler(db, generator.URL)
	reqBody := `{"report_date":"2026-06-24","session_ids":["session-1","session-2"],"skill_id":"default_daily","skill_content":"补充 skill","include_task_progress":true}`
	req := httptest.NewRequest(http.MethodPost, "/reports/today/draft", bytes.NewBufferString(reqBody))
	req = requestWithUser(req, &model.User{ID: 1, Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.GenerateTodayDraft(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var got model.GenerateReportDraftResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.SelectedSessionIDs) != 2 || got.SelectedSessionIDs[0] != "session-1" {
		t.Fatalf("selected ids = %#v", got.SelectedSessionIDs)
	}
	if len(got.TaskProgressSuggestions) != 1 || len(got.TaskProgressSuggestions[0].EvidenceSessionIDs) != 1 {
		t.Fatalf("suggestions were not normalized: %#v", got.TaskProgressSuggestions)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestUpdateReportPersistsSessionIDsOnSave(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	now := time.Date(2026, 6, 24, 19, 0, 0, 0, time.UTC)
	mock.ExpectQuery("SELECT COUNT").
		WithArgs(int64(1), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))
	mock.ExpectExec("UPDATE daily_reports SET").
		WithArgs("最终日报", sqlmock.AnyArg(), "report-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT dr.id").
		WithArgs("report-1").
		WillReturnRows(sqlmock.NewRows(dailyReportColumns()).
			AddRow("report-1", int64(1), "张三", "2026-06-24", "最终日报", true, nil, "{session-1,session-2}", "default", nil, nil, nil, nil, now, now))

	h := NewReportHandler(db, "http://generator")
	req := httptest.NewRequest(http.MethodPut, "/reports/report-1", bytes.NewBufferString(`{"content":"最终日报","session_ids":["session-1","session-2"]}`))
	req = requestWithUser(requestWithReportID(req, "report-1"), &model.User{ID: 1, Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.Update(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestGenerateTodayKeepsLegacyGeneratorEndpoint(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	now := time.Date(2026, 6, 24, 19, 0, 0, 0, time.UTC)
	generator := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/reports/generate" {
			t.Fatalf("legacy generator path = %s", r.URL.Path)
		}
		writeJSON(w, http.StatusOK, map[string]any{"report_id": "report-1", "session_count": 1})
	}))
	defer generator.Close()

	mock.ExpectQuery("SELECT dr.id").
		WithArgs(int64(1), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows(dailyReportColumns()).
			AddRow("report-1", int64(1), "张三", "2026-06-24", "日报", false, nil, "{session-1}", "default", nil, nil, nil, nil, now, now))

	h := NewReportHandler(db, generator.URL)
	req := httptest.NewRequest(http.MethodPost, "/reports/today/generate", nil)
	req = requestWithUser(req, &model.User{ID: 1, Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.GenerateToday(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func draftSessionColumns() []string {
	return []string{
		"id", "session_ref", "agent_type", "started_at", "ended_at", "duration_secs",
		"model", "summary", "tool_calls_json",
		"raw_log_url", "task_id", "task_title", "requirement_id", "requirement_title",
		"input_tokens", "output_tokens", "total_tokens",
	}
}

func dailyReportColumns() []string {
	return []string{
		"id", "user_id", "name", "report_date", "content", "edited",
		"feishu_doc_url", "session_ids", "generation_mode", "managed_agent_run_id",
		"agent_id", "agent_version_id", "model_id", "created_at", "updated_at",
	}
}
