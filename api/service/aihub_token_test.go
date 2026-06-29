package service

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// signAIHubToken mints an HS256 token shaped like AIHub's ({exp,iat,uid}).
func signAIHubToken(t *testing.T, secret string, uid int64) string {
	t.Helper()
	claims := jwt.MapClaims{
		"exp": time.Now().Add(time.Hour).Unix(),
		"iat": time.Now().Unix(),
		"uid": uid,
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return s
}

func TestParseAIHubUID_ReadsUidClaim(t *testing.T) {
	tok := signAIHubToken(t, "any-secret-does-not-matter-here", 42)
	uid, err := ParseAIHubUID(tok)
	if err != nil {
		t.Fatalf("ParseAIHubUID: unexpected error %v", err)
	}
	if uid != 42 {
		t.Fatalf("uid = %d, want 42", uid)
	}
}

func TestParseAIHubUID_DoesNotRequireSecret(t *testing.T) {
	// A token signed with one secret must still yield its uid without the secret
	// (unverified parse is the introspection-fallback path).
	tok := signAIHubToken(t, "issuer-secret", 7)
	uid, err := ParseAIHubUID(tok)
	if err != nil {
		t.Fatalf("ParseAIHubUID: unexpected error %v", err)
	}
	if uid != 7 {
		t.Fatalf("uid = %d, want 7", uid)
	}
}

func TestVerifyAIHubToken_AcceptsCorrectSecret(t *testing.T) {
	const secret = "shared-aihub-secret"
	tok := signAIHubToken(t, secret, 2)
	uid, err := VerifyAIHubToken(tok, secret)
	if err != nil {
		t.Fatalf("VerifyAIHubToken: unexpected error %v", err)
	}
	if uid != 2 {
		t.Fatalf("uid = %d, want 2", uid)
	}
}

func TestVerifyAIHubToken_RejectsWrongSecret(t *testing.T) {
	tok := signAIHubToken(t, "real-secret", 2)
	if _, err := VerifyAIHubToken(tok, "wrong-secret"); err == nil {
		t.Fatal("VerifyAIHubToken: expected error for wrong secret, got nil")
	}
}

func TestVerifyAIHubToken_RejectsUnsignedTampered(t *testing.T) {
	tok := signAIHubToken(t, "real-secret", 2) + "tamper"
	if _, err := VerifyAIHubToken(tok, "real-secret"); err == nil {
		t.Fatal("VerifyAIHubToken: expected error for tampered token, got nil")
	}
}

func TestVerifyAIHubToken_RequiresSecret(t *testing.T) {
	tok := signAIHubToken(t, "real-secret", 2)
	if _, err := VerifyAIHubToken(tok, ""); err == nil {
		t.Fatal("VerifyAIHubToken: expected error for empty secret, got nil")
	}
}

func TestAIHubUserInfo_UnmarshalStringRoles(t *testing.T) {
	var info AIHubUserInfo
	if err := json.Unmarshal([]byte(`{"id":2,"username":"aida","roles":["超级管理员","算法"]}`), &info); err != nil {
		t.Fatalf("Unmarshal AIHubUserInfo: %v", err)
	}
	got := info.RoleNames()
	if len(got) != 2 || got[0] != "超级管理员" || got[1] != "算法" {
		t.Fatalf("RoleNames() = %#v, want two string roles", got)
	}
}

func TestAIHubUserInfo_UnmarshalObjectRoles(t *testing.T) {
	var info AIHubUserInfo
	if err := json.Unmarshal([]byte(`{"id":2,"username":"aida","roles":[{"id":1,"name":"超级管理员","role_type":1}]}`), &info); err != nil {
		t.Fatalf("Unmarshal AIHubUserInfo: %v", err)
	}
	got := info.RoleNames()
	if len(got) != 1 || got[0] != "超级管理员" {
		t.Fatalf("RoleNames() = %#v, want object role name", got)
	}
}
