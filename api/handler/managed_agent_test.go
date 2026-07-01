package handler

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
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

type jsonStringArg struct {
	require []string
	forbid  []string
}

func (m jsonStringArg) Match(v driver.Value) bool {
	var raw string
	switch value := v.(type) {
	case []byte:
		raw = string(value)
	case string:
		raw = value
	default:
		return false
	}
	for _, item := range m.require {
		if !strings.Contains(raw, item) {
			return false
		}
	}
	for _, item := range m.forbid {
		if strings.Contains(raw, item) {
			return false
		}
	}
	return true
}

func requestWithURLParam(req *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func requestWithURLParams(req *http.Request, params map[string]string) *http.Request {
	rctx := chi.NewRouteContext()
	for key, value := range params {
		rctx.URLParams.Add(key, value)
	}
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func testManagedAgentDefaults() ManagedAgentDefaults {
	return ManagedAgentDefaults{
		Engine:            "claude-code",
		ModelID:           "MiniMax-M2.5",
		ReportMCPSlug:     "aida-report-mcp",
		ReportMCPVersion:  "report-v1",
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

func TestCreateSkillProxiesSkillMDMultipart(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/skill" {
			t.Fatalf("platform route = %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer user-token" {
			t.Fatalf("authorization = %q", got)
		}
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Fatal(err)
		}
		if got := r.FormValue("slug"); got != "daily-summary" {
			t.Fatalf("slug = %q", got)
		}
		if got := r.FormValue("version"); got != "1.0.0" {
			t.Fatalf("version = %q", got)
		}
		if got := r.FormValue("skill_md"); got != "# Daily Summary\n\nUse session data." {
			t.Fatalf("skill_md = %q", got)
		}
		writeJSON(w, http.StatusOK, service.CreateManagedSkillResponse{
			SkillID: "skill-1",
			Owner:   "alice",
			Slug:    "daily-summary",
			Version: "1.0.0",
			SHA256:  "abc",
		})
	}))
	defer platform.Close()

	h := NewManagedAgentHandler(nil, service.NewManagedAgentClient(platform.URL, "platform-token"))
	body := `{"slug":"daily-summary","version":"1.0.0","name":"Daily Summary","description":"test","skill_md":"# Daily Summary\n\nUse session data."}`
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/skills", bytes.NewBufferString(body))
	req.Header.Set("Authorization", "Bearer user-token")
	rec := httptest.NewRecorder()

	h.CreateSkill(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var got service.CreateManagedSkillResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.SkillID != "skill-1" || got.Owner != "alice" {
		t.Fatalf("response = %+v", got)
	}
}

func TestArchiveSkillProxiesLifecycleRequest(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/skill/daily-summary/1.0.0/archive" {
			t.Fatalf("platform route = %s %s", r.Method, r.URL.Path)
		}
		var req service.ArchiveManagedSkillRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		if !req.Archived {
			t.Fatalf("archived = false")
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}))
	defer platform.Close()

	h := NewManagedAgentHandler(nil, service.NewManagedAgentClient(platform.URL, "platform-token"))
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/skills/daily-summary/1.0.0/archive", bytes.NewBufferString(`{"archived":true}`))
	req = requestWithURLParams(req, map[string]string{"slug": "daily-summary", "version": "1.0.0"})
	rec := httptest.NewRecorder()

	h.ArchiveSkill(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
}

func TestDeleteSkillProxiesLifecycleRequest(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete || r.URL.Path != "/api/skill/daily-summary/1.0.0" {
			t.Fatalf("platform route = %s %s", r.Method, r.URL.Path)
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
	}))
	defer platform.Close()

	h := NewManagedAgentHandler(nil, service.NewManagedAgentClient(platform.URL, "platform-token"))
	req := httptest.NewRequest(http.MethodDelete, "/ai-assets/skills/daily-summary/1.0.0", nil)
	req = requestWithURLParams(req, map[string]string{"slug": "daily-summary", "version": "1.0.0"})
	rec := httptest.NewRecorder()

	h.DeleteSkill(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
}

func TestGetSkillMarkdownProxiesSkillFile(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/api/skill/alice/daily-summary/1.0.0/file" {
			t.Fatalf("platform route = %s %s", r.Method, r.URL.Path)
		}
		if got := r.URL.Query().Get("path"); got != "SKILL.md" {
			t.Fatalf("path query = %q", got)
		}
		w.Header().Set("Content-Type", "text/markdown")
		_, _ = w.Write([]byte("# Daily Summary\n\nUse session data."))
	}))
	defer platform.Close()

	h := NewManagedAgentHandler(nil, service.NewManagedAgentClient(platform.URL, "platform-token"))
	req := httptest.NewRequest(http.MethodGet, "/ai-assets/skills/_mine/daily-summary/1.0.0/skill-md", nil)
	req = requestWithUser(req, &model.User{ID: "user-1", Username: "alice"})
	req = requestWithURLParams(req, map[string]string{"owner": "_mine", "slug": "daily-summary", "version": "1.0.0"})
	rec := httptest.NewRecorder()

	h.GetSkillMarkdown(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var got map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got["content"] != "# Daily Summary\n\nUse session data." {
		t.Fatalf("content = %q", got["content"])
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

func TestStartAgentRunDoesNotInjectReportMCPParams(t *testing.T) {
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
		WithArgs("user-1", "manual_agent_run", "agent-1", "task-report", nil, "pending", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("run-report"))
	mock.ExpectQuery("SELECT id::text").
		WithArgs("run-report", "user-1").
		WillReturnRows(sqlmock.NewRows(aiRunColumns()).
			AddRow("run-report", "user-1", "manual_agent_run", nil, "managed_task", "agent-1", nil, "task-report", nil, nil, "pending", []byte(`{"message":"生成我的日报","params":{"period.date":"2026-06-26","report_type":"personal_daily"},"trigger_source":"manual"}`), []byte(`{}`), nil, now, nil, now))

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
	if submitted.ModelID != "" {
		t.Fatalf("model_id = %q", submitted.ModelID)
	}
	if submitted.Params["report_type"] != "personal_daily" || submitted.Params["period.date"] != "2026-06-26" {
		t.Fatalf("report params = %#v", submitted.Params)
	}
	if _, ok := submitted.Params["run_id"]; ok {
		t.Fatalf("generic run should not inject run_id: %#v", submitted.Params)
	}
	if _, ok := submitted.Params["mcp_url"]; ok {
		t.Fatalf("generic run should not inject mcp_url: %#v", submitted.Params)
	}
	if _, ok := submitted.Params["mcp_"+"authorization"]; ok {
		t.Fatalf("generic run should not inject authorization: %#v", submitted.Params)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestEnsureDefaultReportAgentCreatesDefaultAgent(t *testing.T) {
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
	req := httptest.NewRequest(http.MethodPost, "/internal/default-report-assets", nil)

	if err := h.ensureReportMCPEntry(req, h.client); err != nil {
		t.Fatal(err)
	}
	agentID, err := h.ensureDefaultReportAgent(req, h.client)
	if err != nil {
		t.Fatal(err)
	}
	if agentID == "" || createdAgent.Name != defaultReportAgentName {
		t.Fatalf("created agent id=%q request=%#v", agentID, createdAgent)
	}
	if createdAgent.Engine != "claude-code" || createdAgent.DefaultModelID != "MiniMax-M2.5" {
		t.Fatalf("engine/model = %q/%q", createdAgent.Engine, createdAgent.DefaultModelID)
	}
	if !containsDefaultMarkers(createdAgent.Description) || !containsDefaultMarkers(createdAgent.Instructions) {
		t.Fatalf("missing default markers: description=%q instructions=%q", createdAgent.Description, createdAgent.Instructions)
	}
	if !strings.Contains(createdAgent.Description, defaultReportAgentTypesPrefix+"personal_daily") {
		t.Fatalf("missing report types marker: %q", createdAgent.Description)
	}
	if !hasSkillRef(createdAgent.Skills, service.ReportSkillSlug, service.ReportSkillVersion) {
		t.Fatalf("skills = %#v", createdAgent.Skills)
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

func TestInitializeUserDefaultReportAssetsCreatesUserOwnedAssets(t *testing.T) {
	var createdSkill service.CreateManagedSkillRequest
	var createdMCP model.CreateManagedMCPEntryRequest
	var createdAgent model.UpsertManagedAgentRequest
	agents := []model.ManagedAgent{}
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/skill/list":
			writeJSON(w, http.StatusOK, model.ListManagedSkillsResponse{})
		case r.Method == http.MethodPost && r.URL.Path == "/api/skill":
			if err := r.ParseMultipartForm(2 << 20); err != nil {
				t.Fatal(err)
			}
			createdSkill = service.CreateManagedSkillRequest{
				Slug:        r.FormValue("slug"),
				Version:     r.FormValue("version"),
				Name:        r.FormValue("name"),
				Description: r.FormValue("description"),
				SkillMD:     r.FormValue("skill_md"),
			}
			writeJSON(w, http.StatusOK, service.CreateManagedSkillResponse{SkillID: "skill-1", Owner: "t05", Slug: createdSkill.Slug, Version: createdSkill.Version})
		case r.Method == http.MethodGet && r.URL.Path == "/api/mcp/list":
			writeJSON(w, http.StatusOK, model.ListManagedMCPEntriesResponse{})
		case r.Method == http.MethodPost && r.URL.Path == "/api/mcp":
			if err := json.NewDecoder(r.Body).Decode(&createdMCP); err != nil {
				t.Fatal(err)
			}
			writeJSON(w, http.StatusOK, model.ManagedMCPEntry{EntryID: "mcp-1", Slug: createdMCP.Slug, Version: createdMCP.Version, URL: createdMCP.URL})
		case r.Method == http.MethodGet && r.URL.Path == "/api/my/agents":
			writeJSON(w, http.StatusOK, model.ListManagedAgentsResponse{Agents: agents})
		case r.Method == http.MethodPost && r.URL.Path == "/api/my/agents":
			if err := json.NewDecoder(r.Body).Decode(&createdAgent); err != nil {
				t.Fatal(err)
			}
			agents = append(agents, model.ManagedAgent{
				AgentID:             createdAgent.AgentID,
				Name:                createdAgent.Name,
				Description:         createdAgent.Description,
				Engine:              createdAgent.Engine,
				Instructions:        createdAgent.Instructions,
				DefaultModelID:      createdAgent.DefaultModelID,
				StartPromptTemplate: createdAgent.StartPromptTemplate,
				CredentialSlots:     createdAgent.CredentialSlots,
				Skills:              createdAgent.Skills,
				MCPBindings:         createdAgent.MCPBindings,
			})
			writeJSON(w, http.StatusOK, model.UpsertManagedAgentResponse{AgentID: createdAgent.AgentID, ManagedVersion: 1})
		default:
			t.Fatalf("unexpected platform request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer platform.Close()

	h := NewManagedAgentHandlerWithDefaults(nil, service.NewManagedAgentClient(platform.URL, "platform-token"), testManagedAgentDefaults())
	result, err := h.InitializeUserDefaultReportAssets(context.Background(), &model.User{ID: "307", Username: "t05", Role: "employee", LocalEnabled: true}, "user-token")
	if err != nil {
		t.Fatal(err)
	}
	if !result.SkillCreated || !result.MCPCreated || !result.AgentCreated {
		t.Fatalf("init result = %#v", result)
	}
	if createdSkill.Slug != service.ReportSkillSlug || createdSkill.Version != service.ReportSkillVersion || !strings.Contains(createdSkill.SkillMD, "get_sessions") || strings.Contains(createdSkill.SkillMD, "get_"+"report_context") {
		t.Fatalf("created skill = %#v", createdSkill)
	}
	if createdMCP.Slug != "aida-report-mcp" || createdMCP.Version != "report-v1" || createdMCP.CredentialEnv != reportMCPCredentialSlot || strings.Contains(fmt.Sprint(createdMCP), "user-token") {
		t.Fatalf("created mcp = %#v", createdMCP)
	}
	if len(createdAgent.Skills) != 1 || createdAgent.Skills[0].Owner != "t05" || len(createdAgent.MCPBindings) != 1 || createdAgent.MCPBindings[0].Owner != "t05" {
		t.Fatalf("created agent bindings = skills %#v mcp %#v", createdAgent.Skills, createdAgent.MCPBindings)
	}
	if !containsDefaultMarkers(createdAgent.Description) || !strings.Contains(createdAgent.Description, defaultReportAssetsMarker) {
		t.Fatalf("created agent description = %q", createdAgent.Description)
	}
}

func TestEnsureReportMCPEntryKeepsExistingDifferentURL(t *testing.T) {
	createCalled := false
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/mcp/list":
			writeJSON(w, http.StatusOK, model.ListManagedMCPEntriesResponse{Entries: []model.ManagedMCPEntry{{
				Slug:    "aida-report-mcp",
				Version: "report-v1",
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
	if err != nil {
		t.Fatalf("expected existing user MCP to be kept without overwrite, got %v", err)
	}
	if createCalled {
		t.Fatal("should not create or overwrite existing mcp entry")
	}
}

func TestEnsureDefaultReportAgentRepairsMissingFieldsWithoutOverwritingCustomInstructions(t *testing.T) {
	customInstructions := defaultReportAgentMarker + "\n" + defaultReportAgentTypesPrefix + strings.Join(supportedReportTypes, ",") + "\n" + defaultManagedAgentMarker + "\n" + "用户自定义报告写作风格"
	existing := model.ManagedAgent{
		AgentID:      "agent-custom",
		Name:         defaultReportAgentName,
		Description:  defaultReportAgentMarker + "\n" + defaultReportAgentTypesPrefix + strings.Join(supportedReportTypes, ",") + "\n" + defaultManagedAgentMarker,
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
	agentID, err := h.ensureDefaultReportAgent(httptest.NewRequest(http.MethodPost, "/", nil), h.client)
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

func TestEnsureDefaultReportAgentReusesBestCandidate(t *testing.T) {
	agents := []model.ManagedAgent{
		{
			AgentID:     "agent-old",
			Name:        defaultReportAgentName,
			Description: defaultReportAssetsMarker + "\n" + defaultReportAgentMarker + "\n" + defaultReportAgentTypesPrefix + strings.Join(supportedReportTypes, ",") + "\n" + defaultManagedAgentMarker,
			CreatedAt:   1,
		},
		{
			AgentID:             "agent-complete",
			Name:                defaultReportAgentName,
			Description:         defaultReportAssetsMarker + "\n" + defaultReportAgentMarker + "\n" + defaultReportAgentTypesPrefix + strings.Join(supportedReportTypes, ",") + "\n" + defaultManagedAgentMarker,
			Engine:              "claude-code",
			DefaultModelID:      "MiniMax-M2.5",
			Instructions:        defaultReportAgentInstructions(),
			StartPromptTemplate: defaultReportAgentStartPromptTemplate(),
			CredentialSlots:     []model.ManagedCredentialSlot{{Name: reportMCPCredentialSlot, Required: true}},
			Skills:              []model.ManagedSkillRef{{Slug: service.ReportSkillSlug, Version: service.ReportSkillVersion}},
			MCPBindings:         []model.ManagedMCPBinding{{Slug: "aida-report-mcp", Version: "report-v1", CredentialSlot: reportMCPCredentialSlot}},
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
	agentID, err := h.ensureDefaultReportAgent(httptest.NewRequest(http.MethodPost, "/", nil), h.client)
	if err != nil {
		t.Fatal(err)
	}
	if agentID != "agent-complete" || createCalled || updateCalled {
		t.Fatalf("agent id=%q create=%v update=%v", agentID, createCalled, updateCalled)
	}
}

func TestStartReportAgentRunUsesSessionCredentialOverrides(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	reportAgent := model.ManagedAgent{
		AgentID:             "agent-report",
		Name:                defaultReportAgentName,
		Description:         defaultReportAgentMarker + "\n" + defaultReportAgentTypesPrefix + strings.Join(supportedReportTypes, ",") + "\n" + defaultManagedAgentMarker,
		Engine:              "claude-code",
		DefaultModelID:      "MiniMax-M2.5",
		Instructions:        defaultReportAgentInstructions(),
		StartPromptTemplate: defaultReportAgentStartPromptTemplate(),
		CredentialSlots:     []model.ManagedCredentialSlot{{Name: reportMCPCredentialSlot, Required: true}},
		Skills:              []model.ManagedSkillRef{{Slug: service.ReportSkillSlug, Version: service.ReportSkillVersion}},
		MCPBindings:         []model.ManagedMCPBinding{{Slug: "aida-report-mcp", Version: "report-v1", CredentialSlot: reportMCPCredentialSlot}},
	}
	var createdCredential service.CreateManagedCredentialRequest
	var createdSession service.CreateManagedSessionRequest
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/my/agents":
			writeJSON(w, http.StatusOK, model.ListManagedAgentsResponse{Agents: []model.ManagedAgent{reportAgent}})
		case r.Method == http.MethodPost && r.URL.Path == "/api/credential":
			if err := json.NewDecoder(r.Body).Decode(&createdCredential); err != nil {
				t.Fatal(err)
			}
			writeJSON(w, http.StatusOK, service.CreateManagedCredentialResponse{CredentialID: "cred-1"})
		case r.Method == http.MethodPost && r.URL.Path == "/api/session":
			if err := json.NewDecoder(r.Body).Decode(&createdSession); err != nil {
				t.Fatal(err)
			}
			writeJSON(w, http.StatusOK, service.CreateManagedSessionResponse{
				SessionID: "session-1",
				Status:    "running",
				ModelID:   "MiniMax-M2.5",
			})
		default:
			t.Fatalf("unexpected platform request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer platform.Close()

	now := time.Date(2026, 6, 30, 10, 0, 0, 0, time.UTC)
	safeInputRef := jsonStringArg{
		require: []string{"personal_daily", "2026-06-30", "https://aida.example.com/api/v1/mcp/reports", reportMCPCredentialSlot},
		forbid:  []string{"user-token", "cred-1", "mcp_" + "authorization"},
	}
	mock.ExpectQuery("SELECT agent_id, business_type, report_types").
		WithArgs("user-1", "agent-report").
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery("INSERT INTO ai_runs").
		WithArgs("user-1", reportAgentRunBusinessType, "agent-report", "MiniMax-M2.5", safeInputRef).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("run-report"))
	mock.ExpectExec("UPDATE ai_runs").
		WithArgs("session-1", "MiniMax-M2.5", "running", safeInputRef, "run-report", "user-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT id::text").
		WithArgs("run-report", "user-1").
		WillReturnRows(sqlmock.NewRows(aiRunColumns()).
			AddRow("run-report", "user-1", reportAgentRunBusinessType, nil, "managed_session", "agent-report", nil, nil, "session-1", "MiniMax-M2.5", "running", []byte(`{"trigger_source":"manual","report_type":"personal_daily","period":{"date":"2026-06-30"},"target":{"type":"self","user_id":"user-1"},"model_id":"MiniMax-M2.5","mcp_url":"https://aida.example.com/api/v1/mcp/reports","credential_slot":"AIDA_REPORT_MCP_AUTH","start_prompt_values":{"report_type":"personal_daily","run_id":"run-report"},"credential_override":"redacted"}`), []byte(`{}`), nil, now, nil, now))

	h := NewManagedAgentHandlerWithDefaults(db, service.NewManagedAgentClient(platform.URL, "platform-token"), testManagedAgentDefaults())
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/report-agents/agent-report/runs", bytes.NewBufferString(`{"report_type":"personal_daily","period":{"date":"2026-06-30"},"target":{"type":"self"},"model_id":"MiniMax-M2.5"}`))
	req.Host = "aida.example.com"
	req.Header.Set("X-Forwarded-Proto", "https")
	req.Header.Set("Authorization", "Bearer user-token")
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	req = requestWithURLParam(req, "agentId", "agent-report")
	rec := httptest.NewRecorder()

	h.StartReportAgentRun(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if createdCredential.Value != "user-token" {
		t.Fatalf("credential value should be current user token without Bearer prefix, got %q", createdCredential.Value)
	}
	if createdSession.AgentID != "agent-report" || createdSession.ModelID != "MiniMax-M2.5" {
		t.Fatalf("session request = %#v", createdSession)
	}
	if createdSession.CredentialOverrides[reportMCPCredentialSlot] != "cred-1" {
		t.Fatalf("credential overrides = %#v", createdSession.CredentialOverrides)
	}
	if _, ok := createdSession.StartPromptValues["mcp_"+"authorization"]; ok {
		t.Fatalf("start prompt values should not contain authorization field: %#v", createdSession.StartPromptValues)
	}
	if createdSession.StartPromptValues["run_id"] != "run-report" || createdSession.StartPromptValues["mcp_url"] != "https://aida.example.com/api/v1/mcp/reports" {
		t.Fatalf("start prompt values = %#v", createdSession.StartPromptValues)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestStartReportAgentRunDefaultDoesNotCreateAssets(t *testing.T) {
	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/api/my/agents":
			writeJSON(w, http.StatusOK, model.ListManagedAgentsResponse{})
		case r.Method == http.MethodPost:
			t.Fatalf("default report run must not create assets, got %s", r.URL.Path)
		default:
			t.Fatalf("unexpected platform request: %s %s", r.Method, r.URL.Path)
		}
	}))
	defer platform.Close()

	h := NewManagedAgentHandlerWithDefaults(nil, service.NewManagedAgentClient(platform.URL, "platform-token"), testManagedAgentDefaults())
	req := httptest.NewRequest(http.MethodPost, "/ai-assets/report-agents/default/runs", bytes.NewBufferString(`{"report_type":"personal_daily","period":{"date":"2026-06-30"},"target":{"type":"self"}}`))
	req.Header.Set("Authorization", "Bearer user-token")
	req = requestWithUser(req, &model.User{ID: "user-1", Username: "t05", Role: "employee"})
	req = requestWithURLParam(req, "agentId", "default")
	rec := httptest.NewRecorder()

	h.StartReportAgentRun(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
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
		WithArgs("user-1", "personal_daily", "legacy-source-agent", "task-urls", "MiniMax-M2.5", "pending", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("run-1"))
	mock.ExpectQuery("SELECT id::text").
		WithArgs("run-1", "user-1").
		WillReturnRows(sqlmock.NewRows(aiRunColumns()).
			AddRow("run-1", "user-1", "personal_daily", nil, "managed_task", "legacy-source-agent", nil, "task-urls", nil, "MiniMax-M2.5", "pending", []byte(`{"report_date":"2026-06-29","session_ids":["session-1"],"urls":["https://aida.example.com/api/v1/sessions/session-1/log"]}`), []byte(`{}`), nil, now, nil, now))

	h := NewManagedAgentHandlerWithDefaults(db, service.NewManagedAgentClient(platform.URL, "platform-token"), testManagedAgentDefaults())
	req := httptest.NewRequest(http.MethodPost, "/reports/today/managed-agent-runs", bytes.NewBufferString(`{"report_date":"2026-06-29","session_ids":["session-1"],"agent_id":"legacy-source-agent"}`))
	req.Host = "aida.example.com"
	req.Header.Set("X-Forwarded-Proto", "https")
	req = requestWithUser(req, &model.User{ID: "user-1", Name: "张三", Role: "employee"})
	rec := httptest.NewRecorder()

	h.StartReportRun(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	if submitted.AgentID != "legacy-source-agent" {
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
