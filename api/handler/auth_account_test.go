package handler

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aidashboard/api/model"
	"github.com/aidashboard/api/service"
)

func newAIHubTestServer(t *testing.T, users map[string]service.AIHubUser) (*httptest.Server, *string) {
	t.Helper()
	authHeader := ""
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader = r.Header.Get("Authorization")
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/api/v1/auth/login":
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "user-token", "uid": 1})
		case r.Method == http.MethodGet && r.URL.Path == "/api/v1/users":
			items := make([]service.AIHubUser, 0, len(users))
			for _, user := range users {
				items = append(items, user)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{
					"total":     len(items),
					"page_size": 20,
					"page_num":  1,
					"data":      items,
				},
			})
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/api/v1/users/"):
			id := strings.TrimPrefix(r.URL.Path, "/api/v1/users/")
			user, ok := users[id]
			if !ok {
				http.NotFound(w, r)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"code": 0, "data": user})
		default:
			http.NotFound(w, r)
		}
	}))
	return server, &authHeader
}

func userRows(rows ...[]any) *sqlmock.Rows {
	cols := []string{
		"id", "username", "nickname", "email", "display_name", "employee_id", "app_role",
		"team_id", "team_name", "local_enabled", "last_synced_at", "created_at", "updated_at",
	}
	out := sqlmock.NewRows(cols)
	for _, row := range rows {
		values := make([]driver.Value, len(row))
		for i, value := range row {
			values[i] = value
		}
		out.AddRow(values...)
	}
	return out
}

func aidaUserRow(id, role string, teamID any, localEnabled bool) []any {
	now := time.Date(2026, 6, 29, 10, 0, 0, 0, time.UTC)
	return []any{id, "u" + id, "User " + id, "u" + id + "@example.com", "User " + id, id, role, teamID, "", localEnabled, now, now, now}
}

func TestSearchAIHubUsersReturnsAidaStatusAndCurrentProfile(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	aihubServer, authHeader := newAIHubTestServer(t, map[string]service.AIHubUser{
		"1": {ID: 1, Username: "active", Nickname: "Active", Email: "active@example.com"},
		"2": {ID: 2, Username: "disabled", Nickname: "Disabled", Email: "disabled@example.com"},
		"3": {ID: 3, Username: "new", Nickname: "New", Email: "new@example.com"},
	})
	defer aihubServer.Close()

	mock.ExpectQuery("SELECT u.id, u.local_enabled, u.app_role").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "local_enabled", "app_role", "team_id", "name"}).
			AddRow(int64(1), true, "employee", "team-1", "端侧工程").
			AddRow(int64(2), false, "team_leader", "team-1", "端侧工程"))

	h := NewAuthHandler(db, service.NewAIHubClient(aihubServer.URL, "service-token"), "")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/aihub/users/search?search_key=u", nil)
	rec := httptest.NewRecorder()
	h.SearchAIHubUsers(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if *authHeader != "Bearer service-token" {
		t.Fatalf("aihub auth = %q", *authHeader)
	}
	var got struct {
		Items []model.AIHubUserSearchItem `json:"items"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	statusByID := map[int64]model.AIHubUserSearchItem{}
	for _, item := range got.Items {
		statusByID[item.ID] = item
	}
	if statusByID[1].AidaStatus != "active" || statusByID[2].AidaStatus != "disabled" || statusByID[3].AidaStatus != "not_added" {
		t.Fatalf("statuses = %#v", statusByID)
	}
	if statusByID[1].CurrentAppRole == nil || *statusByID[1].CurrentAppRole != "employee" {
		t.Fatalf("current app role missing: %#v", statusByID[1])
	}
	if statusByID[1].CurrentTeamID == nil || *statusByID[1].CurrentTeamID != "team-1" {
		t.Fatalf("current team id missing: %#v", statusByID[1])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestAdminBatchAddUsersClearsTeamForCrossTeamRoles(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	aihubServer, _ := newAIHubTestServer(t, map[string]service.AIHubUser{
		"42": {ID: 42, Username: "pm_user", Nickname: "PM", Email: "pm@example.com"},
	})
	defer aihubServer.Close()

	mock.ExpectQuery("SELECT id FROM users WHERE aida_enabled = true").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}))
	mock.ExpectExec("INSERT INTO users").
		WithArgs(int64(42), "42", "pm_user", "PM", "PM", "pm@example.com", "pm", "", true, "active").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT u.id::text")).
		WithArgs("42").
		WillReturnRows(userRows(aidaUserRow("42", "pm", nil, true)))

	h := NewAuthHandler(db, service.NewAIHubClient(aihubServer.URL, "service-token"), "")
	body := bytes.NewBufferString(`{"user_ids":[42],"app_role":"pm","team_id":"a0000000-0000-0000-0000-000000000001","local_enabled":true}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users/batch", body)
	req = requestWithUser(req, &model.User{ID: "1", Role: "admin"})
	rec := httptest.NewRecorder()
	h.AdminBatchAddUsers(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var got model.AdminBatchAddUsersResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Created != 1 || got.SkippedExisting != 0 {
		t.Fatalf("response = %#v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestAdminBatchAddUsersRequiresTeamForEmployeeAndTeamLeader(t *testing.T) {
	for _, role := range []string{"employee", "team_leader"} {
		t.Run(role, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM teams").
				WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

			h := NewAuthHandler(db, nil, "")
			body := bytes.NewBufferString(`{"user_ids":[42],"app_role":"` + role + `"}`)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users/batch", body)
			req = requestWithUser(req, &model.User{ID: "1", Role: "admin"})
			rec := httptest.NewRecorder()
			h.AdminBatchAddUsers(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("sql expectations: %v", err)
			}
		})
	}
}

func TestAdminBatchAddUsersSkipsExistingUsers(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT id FROM users WHERE aida_enabled = true").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(int64(42)))

	h := NewAuthHandler(db, nil, "")
	body := bytes.NewBufferString(`{"user_ids":[42],"app_role":"admin","local_enabled":true}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/users/batch", body)
	req = requestWithUser(req, &model.User{ID: "1", Role: "admin"})
	rec := httptest.NewRecorder()
	h.AdminBatchAddUsers(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var got model.AdminBatchAddUsersResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.SkippedExisting != 1 || got.Skipped != 1 {
		t.Fatalf("response = %#v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestAdminUpdateUserAppliesRoleTeamRules(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT u.id::text")).
		WithArgs("42").
		WillReturnRows(userRows(aidaUserRow("42", "admin", nil, true)))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM teams").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	h := NewAuthHandler(db, nil, "")
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/users/42/profile", bytes.NewBufferString(`{"app_role":"employee"}`))
	req = requestWithURLParam(req, "id", "42")
	req = requestWithUser(req, &model.User{ID: "1", Role: "admin"})
	rec := httptest.NewRecorder()
	h.AdminUpdateUser(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestAdminUpdateUserProtectsLastAdmin(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT u.id::text")).
		WithArgs("42").
		WillReturnRows(userRows(aidaUserRow("42", "admin", nil, true)))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE aida_enabled = true AND local_enabled = true AND app_role = 'admin'").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	h := NewAuthHandler(db, nil, "")
	req := httptest.NewRequest(http.MethodPut, "/api/v1/admin/users/42/profile", bytes.NewBufferString(`{"local_enabled":false}`))
	req = requestWithURLParam(req, "id", "42")
	req = requestWithUser(req, &model.User{ID: "1", Role: "admin"})
	rec := httptest.NewRecorder()
	h.AdminUpdateUser(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestBootstrapAdminExistingLoginDoesNotOverwriteProfile(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	aihubServer, _ := newAIHubTestServer(t, map[string]service.AIHubUser{
		"1": {ID: 1, Username: "bootstrap", Nickname: "Bootstrap", Email: "bootstrap@example.com"},
	})
	defer aihubServer.Close()

	now := time.Date(2026, 6, 29, 10, 0, 0, 0, time.UTC)
	existing := []any{"1", "old", "Old", "old@example.com", "Old", "1", "employee", "team-1", "端侧工程", false, now, now, now}
	synced := []any{"1", "bootstrap", "Bootstrap", "bootstrap@example.com", "Bootstrap", "1", "employee", "team-1", "端侧工程", false, now, now, now}
	mock.ExpectQuery(regexp.QuoteMeta("SELECT u.id::text")).
		WithArgs("1").
		WillReturnRows(userRows(existing))
	mock.ExpectExec("UPDATE users").
		WithArgs("1", "1", "bootstrap", "Bootstrap", "Bootstrap", "bootstrap@example.com").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT u.id::text")).
		WithArgs("1").
		WillReturnRows(userRows(synced))

	h := NewAuthHandler(db, service.NewAIHubClient(aihubServer.URL, "service-token"), "1")
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(`{"username":"bootstrap","password":"pw"}`))
	rec := httptest.NewRecorder()
	h.Login(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestAdminDeleteTeamRejectsBusinessReferences(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE team_id").
		WithArgs("team-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT").
		WithArgs("team-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	h := NewAuthHandler(db, nil, "")
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/teams/team-1", nil)
	req = requestWithURLParam(req, "id", "team-1")
	req = requestWithUser(req, &model.User{ID: "1", Role: "admin"})
	rec := httptest.NewRecorder()
	h.AdminDeleteTeam(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}

func TestAdminDeleteTeamAllowsUnusedTeam(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE team_id").
		WithArgs("team-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT").
		WithArgs("team-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectExec("DELETE FROM teams").
		WithArgs("team-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	h := NewAuthHandler(db, nil, "")
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/admin/teams/team-1", nil)
	req = requestWithURLParam(req, "id", "team-1")
	req = requestWithUser(req, &model.User{ID: "1", Role: "admin"})
	rec := httptest.NewRecorder()
	h.AdminDeleteTeam(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("sql expectations: %v", err)
	}
}
