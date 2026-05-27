package proxy

import (
	"encoding/base64"
	"net"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/metorial/function-bay-deflector/internal/auth"
	"github.com/metorial/function-bay-deflector/internal/policy"
)

func proxyToken(t *testing.T, secret string, claims policy.Claims) string {
	t.Helper()

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func TestTokenFromProxyAuthorizationReadsBasicUsername(t *testing.T) {
	header := "Basic " + base64.StdEncoding.EncodeToString([]byte("jwt-token:x"))

	token, err := tokenFromProxyAuthorization(header)
	if err != nil {
		t.Fatal(err)
	}
	if token != "jwt-token" {
		t.Fatalf("unexpected token %q", token)
	}
}

func TestPolicyFromRequestRequiresValidToken(t *testing.T) {
	server := &Server{Verifier: auth.NewVerifier("secret", "deflector")}
	request := httptest.NewRequest("GET", "http://example.com", nil)

	if _, err := server.policyFromRequest(request); err == nil {
		t.Fatal("expected missing token to be rejected")
	}

	allowedHosts := []string{"example.com"}
	token := proxyToken(t, "secret", policy.Claims{
		TenantID:          "tenant_123",
		FunctionID:        "function_123",
		FunctionVersionID: "functionVersion_123",
		AllowedHosts:      &allowedHosts,
		RegisteredClaims: jwt.RegisteredClaims{
			Audience:  jwt.ClaimStrings{"deflector"},
			Subject:   "functionVersion_123",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		},
	})
	request.Header.Set(
		"Proxy-Authorization",
		"Basic "+base64.StdEncoding.EncodeToString([]byte(token+":x")),
	)

	requestPolicy, err := server.policyFromRequest(request)
	if err != nil {
		t.Fatal(err)
	}
	if requestPolicy.Claims.TenantID != "tenant_123" {
		t.Fatalf("unexpected tenant id %q", requestPolicy.Claims.TenantID)
	}
	if !requestPolicy.Compiled.AllowsHost("example.com") {
		t.Fatal("expected verified claims to allow configured host")
	}
	if requestPolicy.Compiled.AllowsHost("other.example") {
		t.Fatal("expected verified claims to deny unconfigured host")
	}
}

func TestExplicitPrivateIPAllowlistOverridesDefaultBlock(t *testing.T) {
	allowedIPs := []string{"10.0.0.1"}
	compiled, err := policy.Compile(policy.Claims{AllowedIPs: &allowedIPs})
	if err != nil {
		t.Fatal(err)
	}
	if !compiled.AllowsIP(net.ParseIP("10.0.0.1")) {
		t.Fatal("expected explicit private IP allowlist to allow matching IP")
	}
}
