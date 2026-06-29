package service

import (
	"errors"
	"strconv"

	"github.com/golang-jwt/jwt/v5"
)

// ErrAIHubNoUID is returned when an AIHub token carries no user-id claim.
var ErrAIHubNoUID = errors.New("aihub token missing uid claim")

// ParseAIHubUID extracts the uid claim WITHOUT verifying the signature.
// Use only to read the user id for a subsequent introspection call; the token's
// actual validity must be confirmed via AIHubClient.GetUserInfo (which AIHub
// rejects for invalid/expired tokens) or VerifyAIHubToken when a secret exists.
func ParseAIHubUID(tokenString string) (int64, error) {
	unverified, _, err := new(jwt.Parser).ParseUnverified(tokenString, jwt.MapClaims{})
	if err != nil {
		return 0, err
	}
	claims, ok := unverified.Claims.(jwt.MapClaims)
	if !ok {
		return 0, errors.New("aihub token invalid claims")
	}
	return aiHubUIDFromClaims(claims)
}

// VerifyAIHubToken verifies the HS256 signature with the shared secret and
// returns the uid. Use when AIHUB_JWT_SECRET is configured to avoid a per-request
// introspection round-trip. Mirrors the secret the managed-agent platform uses.
func VerifyAIHubToken(tokenString, secret string) (int64, error) {
	if secret == "" {
		return 0, errors.New("aihub jwt secret not configured")
	}
	token, err := jwt.Parse(tokenString, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return 0, errors.New("aihub token verification failed")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, errors.New("aihub token invalid claims")
	}
	return aiHubUIDFromClaims(claims)
}

// aiHubUIDFromClaims reads the user id from any of the common claim names.
func aiHubUIDFromClaims(claims jwt.MapClaims) (int64, error) {
	for _, key := range []string{"uid", "userId", "user_id", "sub"} {
		v, ok := claims[key]
		if !ok {
			continue
		}
		switch n := v.(type) {
		case float64:
			return int64(n), nil
		case int64:
			return n, nil
		case int:
			return int64(n), nil
		case string:
			if id, err := strconv.ParseInt(n, 10, 64); err == nil {
				return id, nil
			}
		}
	}
	return 0, ErrAIHubNoUID
}
