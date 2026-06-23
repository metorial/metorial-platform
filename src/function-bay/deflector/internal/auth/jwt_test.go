package auth

import (
	"context"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/metorial/function-bay-deflector/internal/policy"
)

func signedToken(t *testing.T, secret string, audience string, expiresAt time.Time) string {
	t.Helper()

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, policy.Claims{
		TenantID:          "tenant_123",
		FunctionID:        "function_123",
		FunctionVersionID: "functionVersion_123",
		RegisteredClaims: jwt.RegisteredClaims{
			Audience:  jwt.ClaimStrings{audience},
			Subject:   "functionVersion_123",
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func signedLegacyToken(t *testing.T, secret string, audience string, expiresAt time.Time) string {
	t.Helper()

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, policy.Claims{
		LegacyFallback: true,
		RegisteredClaims: jwt.RegisteredClaims{
			Audience:  jwt.ClaimStrings{audience},
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func TestVerifierAcceptsValidToken(t *testing.T) {
	verifier := NewVerifier("secret", "deflector")

	claims, err := verifier.Verify(
		context.Background(),
		signedToken(t, "secret", "deflector", time.Now().Add(time.Minute)),
	)
	if err != nil {
		t.Fatal(err)
	}
	if claims.TenantID != "tenant_123" || claims.FunctionID != "function_123" {
		t.Fatalf("unexpected claims: %#v", claims)
	}
}

func TestVerifierRejectsWrongAudience(t *testing.T) {
	verifier := NewVerifier("secret", "deflector")

	_, err := verifier.Verify(
		context.Background(),
		signedToken(t, "secret", "other", time.Now().Add(time.Minute)),
	)
	if err == nil {
		t.Fatal("expected wrong audience to be rejected")
	}
}

func TestVerifierRejectsExpiredToken(t *testing.T) {
	verifier := NewVerifier("secret", "deflector")

	_, err := verifier.Verify(
		context.Background(),
		signedToken(t, "secret", "deflector", time.Now().Add(-time.Minute)),
	)
	if err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}

func TestVerifierAcceptsTokenWithinClockSkewLeeway(t *testing.T) {
	verifier := NewVerifier("secret", "deflector")

	claims, err := verifier.Verify(
		context.Background(),
		signedToken(t, "secret", "deflector", time.Now().Add(-10*time.Second)),
	)
	if err != nil {
		t.Fatal(err)
	}
	if claims.FunctionVersionID != "functionVersion_123" {
		t.Fatalf("unexpected function version id %q", claims.FunctionVersionID)
	}
}

func TestVerifierAcceptsLegacyFallbackWithoutInvocationClaims(t *testing.T) {
	verifier := NewVerifier("secret", "deflector")

	claims, err := verifier.Verify(
		context.Background(),
		signedLegacyToken(t, "secret", "deflector", time.Now().Add(time.Minute)),
	)
	if err != nil {
		t.Fatal(err)
	}
	if !claims.LegacyFallback {
		t.Fatal("expected legacy fallback claim")
	}
	if claims.TenantID != "" || claims.FunctionID != "" || claims.FunctionVersionID != "" {
		t.Fatalf("expected no invocation identifiers: %#v", claims)
	}
}
