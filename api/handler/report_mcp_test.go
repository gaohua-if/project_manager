package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aidashboard/api/model"
)

func newReportMCPRequest(method string, body any) *http.Request {
	b, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/mcp/reports", bytes.NewReader(b))
	return req
}

func reportMCPBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var resp struct {
		JSONRPC string          `json:"jsonrpc"`
		ID      json.RawMessage `json:"id"`
		Result  json.RawMessage `json:"result"`
		Error   *struct {
			Code int `json:"code"`
			Data *struct {
				Code string `json:"code"`
			} `json:"data,omitempty"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, rec.Body.String())
	}
	if resp.Error != nil {
		t.Fatalf("rpc error: code=%d message=%s", resp.Error.Code, resp.Error.Message)
	}
	var result map[string]any
	if err := json.Unmarshal(resp.Result, &result); err != nil {
		t.Fatalf("unmarshal result: %v body=%s", err, rec.Body.String())
	}
	return result
}

func reportMCPError(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var resp struct {
		Error *struct {
			Code int `json:"code"`
			Data *struct {
				Code string `json:"code"`
			} `json:"data,omitempty"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v body=%s", err, rec.Body.String())
	}
	if resp.Error == nil {
		t.Fatalf("expected rpc error, got nil. body=%s", rec.Body.String())
	}
	if resp.Error.Data == nil {
		t.Fatalf("expected structured error code, got nil. body=%s", rec.Body.String())
	}
	return resp.Error.Data.Code
}

func TestReportMCPToolsListReturns9AtomicTools(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewReportMCPHandler(db)
	req := newReportMCPRequest("tools/list", map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/list",
	})
	rec := httptest.NewRecorder()
	h.Serve(rec, req)

	result := reportMCPBody(t, rec)
	tools, ok := result["tools"].([]any)
	if !ok {
		t.Fatalf("tools not array: %#v", result["tools"])
	}
	if len(tools) != 9 {
		t.Fatalf("tools count = %d, want 9", len(tools))
	}
	expected := map[string]bool{
		"get_sessions":         true,
		"get_daily_reports":    true,
		"get_weekly_reports":   true,
		"get_tasks":            true,
		"get_requirements":     true,
		"get_existing_report":  true,
		"get_report_inventory": true,
		"write_report_result":  true,
		"write_report_failure": true,
	}
	for _, tool := range tools {
		m, ok := tool.(map[string]any)
		if !ok {
			t.Fatalf("tool not object: %#v", tool)
		}
		name, _ := m["name"].(string)
		if !expected[name] {
			t.Fatalf("unexpected tool %q in tools/list", name)
		}
	}
}

func TestReportMCPInitializeReturnsServerInfo(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()
	h := NewReportMCPHandler(db)
	req := newReportMCPRequest("initialize", map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params":  map[string]any{"protocolVersion": "2024-11-05"},
	})
	rec := httptest.NewRecorder()
	h.Serve(rec, req)
	result := reportMCPBody(t, rec)
	info, _ := result["serverInfo"].(map[string]any)
	if info["name"] != "aida-report-mcp" {
		t.Fatalf("serverInfo.name = %#v", info["name"])
	}
	if result["protocolVersion"] != "2024-11-05" {
		t.Fatalf("protocolVersion = %#v", result["protocolVersion"])
	}
}

func TestReportMCPGetExistingReportRequiresAuth(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()
	h := NewReportMCPHandler(db)
	req := newReportMCPRequest("tools/call", map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name":      "get_existing_report",
			"arguments": map[string]any{"report_type": "personal_daily", "period": map[string]any{"date": "2026-06-29"}},
		},
	})
	rec := httptest.NewRecorder()
	h.Serve(rec, req)
	if code := reportMCPError(t, rec); code != "UNAUTHORIZED" {
		t.Fatalf("expected UNAUTHORIZED, got %s", code)
	}
}

func TestReportMCPGetExistingReportForbiddenTargetForEmployee(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()
	h := NewReportMCPHandler(db)
	req := newReportMCPRequest("tools/call", map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "get_existing_report",
			"arguments": map[string]any{
				"report_type": "personal_daily",
				"period":      map[string]any{"date": "2026-06-29"},
				"target":      map[string]any{"type": "team", "team_id": "t-1"},
			},
		},
	})
	req = requestWithUser(req, &model.User{ID: "u-1", Role: "employee"})
	rec := httptest.NewRecorder()
	h.Serve(rec, req)
	if code := reportMCPError(t, rec); code != "FORBIDDEN" {
		t.Fatalf("expected FORBIDDEN, got %s body=%s", code, rec.Body.String())
	}
}

func TestReportMCPWriteReportResultUnsupportedType(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()
	h := NewReportMCPHandler(db)
	req := newReportMCPRequest("tools/call", map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "write_report_result",
			"arguments": map[string]any{
				"report_type": "invalid_type",
				"period":      map[string]any{"date": "2026-06-29"},
				"run_id":      "r-1",
				"content":     "x",
			},
		},
	})
	req = requestWithUser(req, &model.User{ID: "u-1", Role: "employee"})
	rec := httptest.NewRecorder()
	h.Serve(rec, req)
	if code := reportMCPError(t, rec); code != "REPORT_TYPE_NOT_SUPPORTED" {
		t.Fatalf("expected REPORT_TYPE_NOT_SUPPORTED, got %s body=%s", code, rec.Body.String())
	}
}

func TestReportMCPWriteReportFailureMissingRunID(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()
	h := NewReportMCPHandler(db)
	req := newReportMCPRequest("tools/call", map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "write_report_failure",
			"arguments": map[string]any{
				"report_type":   "personal_daily",
				"period":        map[string]any{"date": "2026-06-29"},
				"error_message": "boom",
			},
		},
	})
	req = requestWithUser(req, &model.User{ID: "u-1", Role: "employee"})
	rec := httptest.NewRecorder()
	h.Serve(rec, req)
	if code := reportMCPError(t, rec); code != "INVALID_ARGUMENT" {
		t.Fatalf("expected INVALID_ARGUMENT, got %s body=%s", code, rec.Body.String())
	}
}

func TestReportMCPMethodsListNotExistent(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()
	h := NewReportMCPHandler(db)
	req := newReportMCPRequest("not_a_method", map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "not_a_method",
	})
	rec := httptest.NewRecorder()
	h.Serve(rec, req)
	var resp struct {
		Error *struct {
			Code int `json:"code"`
			Data *struct {
				Code string `json:"code"`
			} `json:"data,omitempty"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.Error == nil || resp.Error.Code != -32601 {
		t.Fatalf("expected -32601 method not found, got body=%s", rec.Body.String())
	}
}

// Permission matrix tests (doc §3.5.2 / §3.3).
// resolveTarget is a pure function — the matrix is exhaustively testable without DB.

func strPtr(s string) *string { return &s }

func TestReportMCPScopeForbiddenForPM(t *testing.T) {
	// PM cannot expand read scope to team — only self is allowed.
	pm := &model.User{ID: "u-pm", Role: "pm"}
	_, err := resolveScope(nil, nil, pm, reportScope{Type: "team"})
	if err != errForbidden {
		t.Fatalf("PM scope=team: want FORBIDDEN, got %v", err)
	}
}

func TestReportMCPTargetMatrix(t *testing.T) {
	cases := []struct {
		name       string
		user       *model.User
		target     reportTarget
		reportType string
		write      bool
		wantErr    error
	}{
		// 1. employee 读别人 personal report → FORBIDDEN
		{
			name:       "employee read other personal_daily",
			user:       &model.User{ID: "u-emp", Role: "employee"},
			target:     reportTarget{Type: "user", UserID: "u-other"},
			reportType: "personal_daily",
			write:      false,
			wantErr:    errForbidden,
		},
		// 2. PM 读别人 session → FORBIDDEN (target.type=user narrowing)
		{
			name:    "pm read other user session via target=user",
			user:    &model.User{ID: "u-pm", Role: "pm"},
			target:  reportTarget{Type: "user", UserID: "u-other"},
			write:   false,
			wantErr: errForbidden,
		},
		// 3. TL 读小组成员 personal report → OK (defer membership check)
		{
			name:       "tl read team member personal_daily",
			user:       &model.User{ID: "u-tl", Role: "team_leader", TeamID: strPtr("t-1")},
			target:     reportTarget{Type: "user", UserID: "u-member"},
			reportType: "personal_daily",
			write:      false,
			wantErr:    nil,
		},
		// 4. TL 写小组成员 personal report → FORBIDDEN
		{
			name:       "tl write team member personal_daily",
			user:       &model.User{ID: "u-tl", Role: "team_leader", TeamID: strPtr("t-1")},
			target:     reportTarget{Type: "user", UserID: "u-member"},
			reportType: "personal_daily",
			write:      true,
			wantErr:    errForbidden,
		},
		// 5a. TL 写所属 team_daily (explicit team_id) → OK
		{
			name:       "tl write own team_daily explicit",
			user:       &model.User{ID: "u-tl", Role: "team_leader", TeamID: strPtr("t-1")},
			target:     reportTarget{Type: "team", TeamID: "t-1"},
			reportType: "team_daily",
			write:      true,
			wantErr:    nil,
		},
		// 5b. TL 写所属 team_daily (defaulted team_id) → OK
		{
			name:       "tl write own team_daily defaulted",
			user:       &model.User{ID: "u-tl", Role: "team_leader", TeamID: strPtr("t-1")},
			target:     reportTarget{Type: "team"},
			reportType: "team_daily",
			write:      true,
			wantErr:    nil,
		},
		// 5c. TL 写别组 team_daily → FORBIDDEN
		{
			name:       "tl write other team_daily",
			user:       &model.User{ID: "u-tl", Role: "team_leader", TeamID: strPtr("t-1")},
			target:     reportTarget{Type: "team", TeamID: "t-2"},
			reportType: "team_daily",
			write:      true,
			wantErr:    errForbidden,
		},
		// 6. Director 读部门员工 personal report → OK (defer membership check)
		{
			name:       "director read dept employee personal_daily",
			user:       &model.User{ID: "u-dir", Role: "director"},
			target:     reportTarget{Type: "user", UserID: "u-emp-dept"},
			reportType: "personal_daily",
			write:      false,
			wantErr:    nil,
		},
		// 7. Director 写部门员工 personal report → FORBIDDEN
		{
			name:       "director write dept employee personal_daily",
			user:       &model.User{ID: "u-dir", Role: "director"},
			target:     reportTarget{Type: "user", UserID: "u-emp-dept"},
			reportType: "personal_daily",
			write:      true,
			wantErr:    errForbidden,
		},
		// 8. Director 写 team_daily → FORBIDDEN
		{
			name:       "director write team_daily",
			user:       &model.User{ID: "u-dir", Role: "director"},
			target:     reportTarget{Type: "team", TeamID: "t-1"},
			reportType: "team_daily",
			write:      true,
			wantErr:    errForbidden,
		},
		// 9a. Director 写 department_daily (defaulted) → OK
		{
			name:       "director write own department_daily defaulted",
			user:       &model.User{ID: "u-dir", Role: "director"},
			target:     reportTarget{Type: "department"},
			reportType: "department_daily",
			write:      true,
			wantErr:    nil,
		},
		// 9b. Director 写别的 department_daily → FORBIDDEN
		{
			name:       "director write other department_daily",
			user:       &model.User{ID: "u-dir", Role: "director"},
			target:     reportTarget{Type: "department", DepartmentID: "u-other"},
			reportType: "department_daily",
			write:      true,
			wantErr:    errForbidden,
		},
		// 10. Admin global read/write
		{
			name:       "admin write other personal_daily",
			user:       &model.User{ID: "u-admin", Role: "admin"},
			target:     reportTarget{Type: "user", UserID: "u-anyone"},
			reportType: "personal_daily",
			write:      true,
			wantErr:    nil,
		},
		{
			name:       "admin write any team_daily",
			user:       &model.User{ID: "u-admin", Role: "admin"},
			target:     reportTarget{Type: "team", TeamID: "t-1"},
			reportType: "team_daily",
			write:      true,
			wantErr:    nil,
		},
		{
			name:       "admin write any department_daily",
			user:       &model.User{ID: "u-admin", Role: "admin"},
			target:     reportTarget{Type: "department", DepartmentID: "u-other"},
			reportType: "department_daily",
			write:      true,
			wantErr:    nil,
		},
		// Sanity: employee writing own personal_daily → OK
		{
			name:       "employee write own personal_daily",
			user:       &model.User{ID: "u-emp", Role: "employee"},
			target:     reportTarget{Type: "self"},
			reportType: "personal_daily",
			write:      true,
			wantErr:    nil,
		},
		// Sanity: employee reading own personal_daily → OK
		{
			name:       "employee read own personal_daily",
			user:       &model.User{ID: "u-emp", Role: "employee"},
			target:     reportTarget{Type: "self"},
			reportType: "personal_daily",
			write:      false,
			wantErr:    nil,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := resolveTarget(tc.user, tc.target, tc.reportType, tc.write)
			if tc.wantErr == nil {
				if err != nil {
					t.Fatalf("want nil, got %v", err)
				}
				return
			}
			if err != tc.wantErr {
				t.Fatalf("want %v, got %v", tc.wantErr, err)
			}
		})
	}
}
