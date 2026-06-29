package service

import (
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

type outputRefWithoutResult struct {
	status string
}

func (m outputRefWithoutResult) Match(value driver.Value) bool {
	raw, ok := value.([]byte)
	if !ok {
		text, ok := value.(string)
		if !ok {
			return false
		}
		raw = []byte(text)
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		return false
	}
	if _, ok := payload["result"]; ok {
		return false
	}
	return payload["status"] == m.status
}

func TestManagedAgentRunStatusSyncerRefreshesCompletedRun(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/task/task-123/status" {
			t.Fatalf("platform path = %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer platform-token" {
			t.Fatalf("authorization = %q", got)
		}
		_, _ = w.Write([]byte(`{"task_id":"task-123","status":"completed","agent_version_id":3,"model_id":"Kimi-K2.6","progress":"done","result":"SECRET_RESULT_SHOULD_NOT_BE_STORED"}`))
	}))
	defer platform.Close()

	now := time.Date(2026, 6, 29, 10, 0, 0, 0, time.UTC)
	startedAt := now.Add(-10 * time.Minute)
	mock.ExpectQuery(`(?s)SELECT id::text, external_task_id, status, COALESCE\(started_at, created_at\).*FROM ai_runs`).
		WithArgs(100).
		WillReturnRows(sqlmock.NewRows([]string{"id", "external_task_id", "status", "started_at"}).
			AddRow("run-1", "task-123", "pending", startedAt))
	mock.ExpectExec("UPDATE ai_runs SET").
		WithArgs("succeeded", outputRefWithoutResult{status: "completed"}, 3, "Kimi-K2.6", now, "run-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	syncer := NewManagedAgentRunStatusSyncer(db, NewManagedAgentClient(platform.URL, "platform-token"))
	if err := syncer.RunOnce(t.Context(), now); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestManagedAgentRunStatusSyncerTimesOutOldPendingRun(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	platform := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"task_id":"task-123","status":"pending","progress":"queued"}`))
	}))
	defer platform.Close()

	now := time.Date(2026, 6, 29, 10, 0, 0, 0, time.UTC)
	startedAt := now.Add(-61 * time.Minute)
	mock.ExpectQuery(`(?s)SELECT id::text, external_task_id, status, COALESCE\(started_at, created_at\).*FROM ai_runs`).
		WithArgs(100).
		WillReturnRows(sqlmock.NewRows([]string{"id", "external_task_id", "status", "started_at"}).
			AddRow("run-1", "task-123", "pending", startedAt))
	mock.ExpectExec("UPDATE ai_runs SET").
		WithArgs("timeout", outputRefWithoutResult{status: "pending"}, nil, "managed agent run timed out after 1h", now, "run-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	syncer := NewManagedAgentRunStatusSyncer(db, NewManagedAgentClient(platform.URL, "platform-token"))
	if err := syncer.RunOnce(t.Context(), now); err != nil {
		t.Fatal(err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestNormalizeManagedRunStatusIncludesTimeout(t *testing.T) {
	if got := NormalizeManagedRunStatus("timed_out"); got != "timeout" {
		t.Fatalf("status = %q", got)
	}
	if !IsTerminalManagedRunStatus("timeout") {
		t.Fatal("timeout should be terminal")
	}
	if strings.TrimSpace(NormalizeManagedRunStatus("")) != "pending" {
		t.Fatal("empty status should normalize to pending")
	}
}
