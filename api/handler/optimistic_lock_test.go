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

func TestUpdateRequirementReturnsConflictForStaleBaseVersion(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM requirements WHERE id = \$1\)`).
		WithArgs("req-1").
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	mock.ExpectExec(`UPDATE requirements SET`).
		WithArgs("B title", "req-1", int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectQuery(`SELECT version FROM requirements WHERE id = \$1`).
		WithArgs("req-1").
		WillReturnRows(sqlmock.NewRows([]string{"version"}).AddRow(int64(2)))

	h := NewRequirementHandler(db, nil)
	req := httptest.NewRequest(http.MethodPut, "/requirements/req-1", bytes.NewBufferString(`{"title":"B title","base_version":1}`))
	req = requestWithUser(requestWithReportID(req, "req-1"), &model.User{ID: "pm-1", Role: "pm"})
	rec := httptest.NewRecorder()

	h.Update(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["code"] != editConflictCode {
		t.Fatalf("code = %#v, want %s", payload["code"], editConflictCode)
	}
	if payload["current_version"] != float64(2) {
		t.Fatalf("current_version = %#v, want 2", payload["current_version"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestUpdateTaskReturnsConflictForStaleBaseVersion(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery(`SELECT id, requirement_id, assignee_id, creator_tl_id`).
		WithArgs("task-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "requirement_id", "assignee_id", "creator_tl_id"}).
			AddRow("task-1", "req-1", nil, "tl-1"))
	mock.ExpectExec(`UPDATE tasks SET`).
		WithArgs("B task", "task-1", int64(1)).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectQuery(`SELECT version FROM tasks WHERE id = \$1`).
		WithArgs("task-1").
		WillReturnRows(sqlmock.NewRows([]string{"version"}).AddRow(int64(2)))

	h := NewTaskHandler(db)
	req := httptest.NewRequest(http.MethodPut, "/tasks/task-1", bytes.NewBufferString(`{"title":"B task","base_version":1}`))
	req = requestWithUser(requestWithReportID(req, "task-1"), &model.User{ID: "pm-1", Role: "pm"})
	rec := httptest.NewRecorder()

	h.Update(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, body=%s", rec.Code, rec.Body.String())
	}
	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload["code"] != editConflictCode {
		t.Fatalf("code = %#v, want %s", payload["code"], editConflictCode)
	}
	if payload["current_version"] != float64(2) {
		t.Fatalf("current_version = %#v, want 2", payload["current_version"])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}
