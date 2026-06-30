package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
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

func testManagedAgentDefaults() ManagedAgentDefaults {
	return ManagedAgentDefaults{
		Engine:            "claude-code",
		ModelID:           "MiniMax-M2.5",
		ReportMCPSlug:     "aida-report-mcp-p0",
		ReportMCPVersion:  "personal-daily-v1",
		AIDAPublicBaseURL: "https://aida.example.com",
	}
}

func TestManagedAgentProxyReturnsNotConfiguredCode(t *testing.T) {
	h := NewManagedAgentHandler(nil, service.NewManagedAgentClient("", ""))
	req := httptest.NewRequest(http.MethodGet, "/ai-assets/skills", nil)
	rec := httptest.NewRecorder()

	h.ListSkills(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["code"] != service.ManagedAgentNotConfiguredCode {
		t.Fatalf("code = %q", got["code"])
	}
}

func TestManagedAgentProxyReturnsUpstreamErrorCode(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "platform down", http.StatusInternalServerError)
	}))
	defer platform.Close()

	h := NewManagedAgentHandler(nil, service.NewManagedAgentClient(platform.URL, "platform-token"))
	req := httptest.NewRequest(http.MethodGet, "/ai-assets/skills", nil)
	rec := httptest.NewRecorder()

	h.ListSkills(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["code"] != service.ManagedAgentUpstreamErrorCode {
		t.Fatalf("code = %q", got["code"])
	}
}

func TestManagedAgentProxyReturnsUnreachableCode(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	platformURL := platform.URL
	platform.Close()

	h := NewManagedAgentHandler(nil, service.NewManagedAgentClient(platformURL, "platform-token"))
	req := httptest.NewRequest(http.MethodGet, "/ai-assets/skills", nil)
	rec := httptest.NewRecorder()

	h.ListSkills(rec, req)

	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["code"] != service.ManagedAgentUnreachableCode {
		t.Fatalf("code = %q", got["code"])
	}
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
		WithArgs("user-1", "manual_agent_run", "agent-1", "task-123", nil, "pending", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("run-1"))
	mock.ExpectQuery("SELECT id::text").
		WithArgs("run-1", "user-1").
		WillReturnRows(sqlmock.NewRows(aiRunColumns()).
			AddRow("run-1", "user-1", "manual_agent_run", nil, "managed_task", "agent-1", nil, "task-123", nil, nil, "pending", []byte(`{"message":"生成日报","params":{"report_date":"2026-06-26"},"trigger_source":"manual"}`), []byte(`{}`), nil, now, nil, now))

	h := NewManagedAgentHandler(db, service.NewManagedAgentClient(platform.URL, "platform-token"))
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/agents/agent-1/runs", bytes.NewBufferString(`{"message":"生成日报","params":{"report_date":"2026-06-26"}}`))
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
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

func TestStartAgentRunInjectsPersonalDailyMCPParams(t *testing.T) {
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
			TaskID: "task-report",
			Status: "queued",
		})
	}))
	defer platform.Close()

	now := time.Date(2026, 6, 26, 10, 0, 0, 0, time.UTC)
	mock.ExpectQuery("INSERT INTO ai_runs").
		WithArgs("user-1", "manual_agent_run", "agent-1", nil, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("run-report"))
	mock.ExpectExec("UPDATE ai_runs").
		WithArgs("task-report", nil, "pending", sqlmock.AnyArg(), "run-report", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT id::text").
		WithArgs("run-report", "user-1").
		WillReturnRows(sqlmock.NewRows(aiRunColumns()).
			AddRow("run-report", "user-1", "manual_agent_run", nil, "managed_task", "agent-1", nil, "task-report", nil, nil, "pending", []byte(`{"params":{"report_type":"personal_daily","period.date":"2026-06-26","run_id":"run-report"}}`), []byte(`{}`), nil, now, nil, now))

	h := NewManagedAgentHandler(db, service.NewManagedAgentClient(platform.URL, "platform-token"))
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/agents/agent-1/runs", bytes.NewBufferString(`{"message":"生成我的日报","params":{"report_type":"personal_daily","period.date":"2026-06-26"}}`))
	req.Host = "aida.example.com"
	req.Header.Set("X-Forwarded-Proto", "https")
	req.Header.Set("Authorization", "Bearer user-token")
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	req = requestWithURLParam(req, "agentId", "agent-1")
	rec := httptest.NewRecorder()

	h.StartAgentRun(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if submitted.Params["run_id"] != "run-report" {
		t.Fatalf("run_id param = %q", submitted.Params["run_id"])
	}
	if submitted.ModelID != "" {
		t.Fatalf("model_id = %q", submitted.ModelID)
	}
	if submitted.Params["report_type"] != "personal_daily" || submitted.Params["period.date"] != "2026-06-26" || submitted.Params["report_date"] != "2026-06-26" {
		t.Fatalf("report params = %#v", submitted.Params)
	}
	if submitted.Params["aida_report_mcp_url"] != "https://aida.example.com/api/v1/mcp/reports" {
		t.Fatalf("mcp url = %q", submitted.Params["aida_report_mcp_url"])
	}
	if submitted.Params["mcp_authorization"] != "Bearer user-token" {
		t.Fatalf("mcp authorization = %q", submitted.Params["mcp_authorization"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestEnsureDefaultPersonalDailyAgentCreatesDefaultAgent(t *testing.T) {
	var createdMCP model.CreateManagedMCPEntryRequest
	var createdAgent model.UpsertManagedAgentRequest
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/mcp/list":
			writeJSON(w, http.StatusOK, model.ListManagedMCPEntriesResponse{})
		case r.Method == http.MethodPost && r.URL.Path == "/api/mcp":
			if err := json.NewDecoder(r.Body).Decode(&createdMCP); err != nil {
				t.Fatal(err)
			}
			writeJSON(w, http.StatusOK, model.ManagedMCPEntry{EntryID: "mcp-1", Slug: createdMCP.Slug, Version: createdMCP.Version, URL: createdMCP.URL})
		case r.Method == http.MethodGet && r.URL.Path == "/api/my/agents":
			writeJSON(w, http.StatusOK, model.ListManagedAgentsResponse{})
		case r.Method == http.MethodPost && r.URL.Path == "/api/my/agents":
			if err := json.NewDecoder(r.Body).Decode(&createdAgent); err != nil {
				t.Fatal(err)
			}
			writeJSON(w, http.StatusOK, model.UpsertManagedAgentResponse{AgentID: createdAgent.AgentID, ManagedVersion: 1})
		default:
			t.Fatalf("unexpected platform request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer platform.Close()

	h := NewManagedAgentHandlerWithDefaults(nil, service.NewManagedAgentClient(platform.URL, "platform-token"), testManagedAgentDefaults())
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/agents/default-personal-daily/ensure", nil)

	if err := h.ensureReportMCPEntry(req, h.client); err != nil {
		t.Fatal(err)
	}
	agentID, err := h.ensureDefaultPersonalDailyAgent(req, h.client)
	if err != nil {
		t.Fatal(err)
	}
	if agentID == "" || createdAgent.Name != defaultPersonalDailyAgentName {
		t.Fatalf("created agent id=%q request=%#v", agentID, createdAgent)
	}
	if createdAgent.Engine != "claude-code" || createdAgent.DefaultModelID != "MiniMax-M2.5" {
		t.Fatalf("engine/model = %q/%q", createdAgent.Engine, createdAgent.DefaultModelID)
	}
	if !containsDefaultMarkers(createdAgent.Description) || !containsDefaultMarkers(createdAgent.Instructions) {
		t.Fatalf("missing default markers: description=%q instructions=%q", createdAgent.Description, createdAgent.Instructions)
	}
	if !h.hasReportMCPBinding(createdAgent.MCPBindings) {
		t.Fatalf("mcp bindings = %#v", createdAgent.MCPBindings)
	}
	if !hasCredentialSlot(createdAgent.CredentialSlots, reportMCPCredentialSlot) || createdAgent.MCPBindings[0].CredentialSlot != reportMCPCredentialSlot {
		t.Fatalf("credential wiring slots=%#v bindings=%#v", createdAgent.CredentialSlots, createdAgent.MCPBindings)
	}
	if createdMCP.URL != "https://aida.example.com/api/v1/mcp/reports" || createdMCP.Transport != "http" || !createdMCP.RequiresCredential || createdMCP.AuthHeader != "Authorization" || createdMCP.AuthScheme != "Bearer" {
		t.Fatalf("mcp entry = %#v", createdMCP)
	}
}

func TestEnsureReportMCPEntryRejectsDifferentURL(t *testing.T) {
	createCalled := false
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/mcp/list":
			writeJSON(w, http.StatusOK, model.ListManagedMCPEntriesResponse{Entries: []model.ManagedMCPEntry{{
				Slug:    "aida-report-mcp-p0",
				Version: "personal-daily-v1",
				URL:     "https://old-aida.example.com/api/v1/mcp/reports",
			}}})
		case r.Method == http.MethodPost && r.URL.Path == "/api/mcp":
			createCalled = true
			t.Fatalf("should not create or overwrite mismatched mcp entry")
		default:
			t.Fatalf("unexpected platform request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer platform.Close()

	h := NewManagedAgentHandlerWithDefaults(nil, service.NewManagedAgentClient(platform.URL, "platform-token"), testManagedAgentDefaults())
	err := h.ensureReportMCPEntry(httptest.NewRequest(http.MethodPost, "/", nil), h.client)
	if err == nil {
		t.Fatal("expected mismatch error")
	}
	var managedErr *service.ManagedAgentError
	if !errors.As(err, &managedErr) {
		t.Fatalf("error type = %T", err)
	}
	if managedErr.Code != managedAgentConfigInvalidCode || createCalled {
		t.Fatalf("managed error = %#v create=%v", managedErr, createCalled)
	}
}

func TestEnsureDefaultPersonalDailyAgentRepairsMissingFieldsWithoutOverwritingCustomInstructions(t *testing.T) {
	customInstructions := defaultReportAgentMarker + "\n" + defaultManagedAgentMarker + "\n" + "用户自定义日报写作风格"
	existing := model.ManagedAgent{
		AgentID:      "agent-custom",
		Name:         defaultPersonalDailyAgentName,
		Description:  defaultReportAgentMarker + "\n" + defaultManagedAgentMarker,
		Engine:       "codex",
		Instructions: customInstructions,
	}
	var updateReq model.UpsertManagedAgentRequest
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/my/agents":
			writeJSON(w, http.StatusOK, model.ListManagedAgentsResponse{Agents: []model.ManagedAgent{existing}})
		case r.Method == http.MethodPut && r.URL.Path == "/api/my/agents/agent-custom":
			if err := json.NewDecoder(r.Body).Decode(&updateReq); err != nil {
				t.Fatal(err)
			}
			writeJSON(w, http.StatusOK, model.UpsertManagedAgentResponse{AgentID: "agent-custom", ManagedVersion: 2})
		default:
			t.Fatalf("unexpected platform request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer platform.Close()

	h := NewManagedAgentHandlerWithDefaults(nil, service.NewManagedAgentClient(platform.URL, "platform-token"), testManagedAgentDefaults())
	agentID, err := h.ensureDefaultPersonalDailyAgent(httptest.NewRequest(http.MethodPost, "/", nil), h.client)
	if err != nil {
		t.Fatal(err)
	}
	if agentID != "agent-custom" {
		t.Fatalf("agent id = %q", agentID)
	}
	if updateReq.DefaultModelID != "MiniMax-M2.5" || !h.hasReportMCPBinding(updateReq.MCPBindings) || !hasCredentialSlot(updateReq.CredentialSlots, reportMCPCredentialSlot) {
		t.Fatalf("repair request = %#v", updateReq)
	}
	if updateReq.Engine != "codex" {
		t.Fatalf("custom engine should not be overwritten, got %q", updateReq.Engine)
	}
	if updateReq.Instructions != customInstructions {
		t.Fatalf("custom instructions overwritten: %q", updateReq.Instructions)
	}
}

func TestEnsureDefaultPersonalDailyAgentReusesBestCandidate(t *testing.T) {
	agents := []model.ManagedAgent{
		{
			AgentID:     "agent-old",
			Name:        defaultPersonalDailyAgentName,
			Description: defaultReportAgentMarker + "\n" + defaultManagedAgentMarker,
			CreatedAt:   1,
		},
		{
			AgentID:             "agent-complete",
			Name:                defaultPersonalDailyAgentName,
			Description:         defaultReportAgentMarker + "\n" + defaultManagedAgentMarker,
			Engine:              "claude-code",
			DefaultModelID:      "MiniMax-M2.5",
			Instructions:        defaultPersonalDailyInstructions(),
			StartPromptTemplate: defaultPersonalDailyStartPromptTemplate(),
			CredentialSlots:     []model.ManagedCredentialSlot{{Name: reportMCPCredentialSlot, Required: true}},
			MCPBindings:         []model.ManagedMCPBinding{{Slug: "aida-report-mcp-p0", Version: "personal-daily-v1", CredentialSlot: reportMCPCredentialSlot}},
			CreatedAt:           2,
		},
	}
	createCalled := false
	updateCalled := false
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/my/agents":
			writeJSON(w, http.StatusOK, model.ListManagedAgentsResponse{Agents: agents})
		case r.Method == http.MethodPost && r.URL.Path == "/api/my/agents":
			createCalled = true
			t.Fatalf("should not create when a marked default candidate exists")
		case r.Method == http.MethodPut:
			updateCalled = true
			t.Fatalf("complete candidate should not be repaired")
		default:
			t.Fatalf("unexpected platform request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer platform.Close()

	h := NewManagedAgentHandlerWithDefaults(nil, service.NewManagedAgentClient(platform.URL, "platform-token"), testManagedAgentDefaults())
	agentID, err := h.ensureDefaultPersonalDailyAgent(httptest.NewRequest(http.MethodPost, "/", nil), h.client)
	if err != nil {
		t.Fatal(err)
	}
	if agentID != "agent-complete" || createCalled || updateCalled {
		t.Fatalf("agent id=%q create=%v update=%v", agentID, createCalled, updateCalled)
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
	if got.MCP.URL != "https://aida.example.com/api/v1/mcp/reports" {
		t.Fatalf("mcp url = %q", got.MCP.URL)
	}
	if got.Skill.Slug != service.DailyReportSkillSlug || got.Skill.Version != service.DailyReportSkillVersion {
		t.Fatalf("skill ref = %s@%s", got.Skill.Slug, got.Skill.Version)
	}
	if !strings.Contains(got.Skill.SkillMD, got.MCP.URL) {
		t.Fatalf("skill markdown should include mcp url")
	}
	if len(got.MCP.Tools) != 9 {
		t.Fatalf("tools = %#v", got.MCP.Tools)
	}
}

func TestStartReportRunSubmitsUrlsStartPromptValues(t *testing.T) {
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
		WithArgs("user-1", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows(draftSessionColumns()).
			AddRow("session-1", "ref-1", "claude_code", now, now.Add(20*time.Minute), 1200, "sonnet", "完成日报", "{}", nil, "", nil, "", 100, 200, 300))
	mock.ExpectQuery("INSERT INTO ai_runs").
		WithArgs("user-1", "personal_daily", "aida-daily-report-agent", "task-urls", "MiniMax-M2.5", "pending", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("run-1"))
	mock.ExpectQuery("SELECT id::text").
		WithArgs("run-1", "user-1").
		WillReturnRows(sqlmock.NewRows(aiRunColumns()).
			AddRow("run-1", "user-1", "personal_daily", nil, "managed_task", "aida-daily-report-agent", nil, "task-urls", nil, "MiniMax-M2.5", "pending", []byte(`{"report_date":"2026-06-29","session_ids":["session-1"],"urls":["https://aida.example.com/api/v1/sessions/session-1/log"]}`), []byte(`{}`), nil, now, nil, now))

	h := NewManagedAgentHandlerWithDefaults(db, service.NewManagedAgentClient(platform.URL, "platform-token"), testManagedAgentDefaults())
	req := httptest.NewRequest(http.MethodPost, "/reports/today/managed-agent-runs", bytes.NewBufferString(`{"report_date":"2026-06-29","session_ids":["session-1"],"agent_id":"aida-daily-report-agent"}`))
	req.Host = "aida.example.com"
	req.Header.Set("X-Forwarded-Proto", "https")
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.StartReportRun(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if submitted.AgentID != "aida-daily-report-agent" {
		t.Fatalf("agent_id = %q", submitted.AgentID)
	}
	if submitted.ModelID != "MiniMax-M2.5" {
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

func TestGetDailyReportRunReturnsLocalRunWhenRefreshFails(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "task result not ready", http.StatusBadGateway)
	}))
	defer platform.Close()

	now := time.Date(2026, 6, 30, 12, 25, 28, 0, time.UTC)
	mock.ExpectQuery("SELECT id::text").
		WithArgs("run-1", "user-1").
		WillReturnRows(sqlmock.NewRows(aiRunColumns()).
			AddRow("run-1", "user-1", "manual_agent_run", nil, "managed_task", "agent-1", nil, "task-1", nil, "MiniMax-M2.5", "pending", []byte(`{"report_type":"personal_daily"}`), []byte(`{}`), nil, now, nil, now))

	h := NewManagedAgentHandlerWithDefaults(db, service.NewManagedAgentClient(platform.URL, "platform-token"), testManagedAgentDefaults())
	req := httptest.NewRequest(http.MethodGet, "/reports/managed-agent-runs/run-1", nil)
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	req = requestWithURLParam(req, "runId", "run-1")
	rec := httptest.NewRecorder()

	h.GetDailyReportRun(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var got model.AIRun
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != "run-1" || got.Status != "pending" {
		t.Fatalf("unexpected run: %#v, body=%s", got, rec.Body.String())
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
		WithArgs("user-1", "日报定时", "agent-1", "Kimi-K2.6", "生成日报", sqlmock.AnyArg(), "weekly", sqlmock.AnyArg(), "19:00", "Asia/Shanghai", true).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("schedule-1"))
	mock.ExpectQuery("SELECT id::text").
		WithArgs("schedule-1", "user-1").
		WillReturnRows(sqlmock.NewRows(agentScheduleColumns()).
			AddRow("schedule-1", "user-1", "日报定时", "agent-1", "Kimi-K2.6", "生成日报", []byte(`{"report_date":"today"}`), "weekly", []byte(`[1,2,3,4,5]`), "19:00", "Asia/Shanghai", true, nil, nil, now, now))

	h := NewManagedAgentHandler(db, nil)
	body := `{"name":"日报定时","agent_id":"agent-1","model_id":"Kimi-K2.6","message":"生成日报","params":{"report_date":"today"},"schedule_type":"weekly","weekdays":[1,2,3,4,5],"time_of_day":"19:00","timezone":"Asia/Shanghai","enabled":true}`
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/agent-schedules", bytes.NewBufferString(body))
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
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
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
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
