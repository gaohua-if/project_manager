package service

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAIHubClientUsesServiceTokenForBackendUserAPIs(t *testing.T) {
	const serviceToken = "configured-service-token"
	requests := make(map[string]string)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests[r.URL.Path] = r.Header.Get("Authorization")
		switch r.URL.Path {
		case "/api/v1/users/42":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{
					"id":       42,
					"username": "u42",
					"nickname": "User 42",
					"email":    "u42@example.com",
				},
			})
		case "/api/v1/users":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code": 0,
				"data": map[string]any{
					"total":     1,
					"page_size": 10,
					"page_num":  1,
					"data": []map[string]any{{
						"id":       42,
						"username": "u42",
						"nickname": "User 42",
						"email":    "u42@example.com",
					}},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewAIHubClient(server.URL, serviceToken)
	if _, err := client.GetUser(42); err != nil {
		t.Fatalf("GetUser failed: %v", err)
	}
	if _, err := client.ListUsers(10, 1, "u42"); err != nil {
		t.Fatalf("ListUsers failed: %v", err)
	}

	want := "Bearer " + serviceToken
	if got := requests["/api/v1/users/42"]; got != want {
		t.Fatalf("GetUser authorization = %q, want %q", got, want)
	}
	if got := requests["/api/v1/users"]; got != want {
		t.Fatalf("ListUsers authorization = %q, want %q", got, want)
	}
}

func TestAIHubClientLoginDoesNotUseServiceToken(t *testing.T) {
	const serviceToken = "configured-service-token"
	var loginAuth string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/v1/auth/login" {
			http.NotFound(w, r)
			return
		}
		loginAuth = r.Header.Get("Authorization")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"access_token": "user-aihub-jwt",
			"uid":          42,
		})
	}))
	defer server.Close()

	client := NewAIHubClient(server.URL, serviceToken)
	result, err := client.Login("u42", "password")
	if err != nil {
		t.Fatalf("Login failed: %v", err)
	}
	if result.Token != "user-aihub-jwt" || result.UserID != 42 {
		t.Fatalf("unexpected login result: %+v", result)
	}
	if loginAuth != "" {
		t.Fatalf("Login authorization = %q, want empty", loginAuth)
	}
}
