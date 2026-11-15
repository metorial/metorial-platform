package proxy

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"log/slog"
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

	token := proxyToken(t, "secret", policy.Claims{
		TenantID:          "tenant_123",
		FunctionID:        "function_123",
		FunctionVersionID: "functionVersion_123",
		EgressPolicy: &policy.CompiledNetworkAllowList{
			Direction: "egress",
			Entries: []policy.CompiledNetworkAllowEntry{
				{CIDR: "93.184.216.34/32", PortRange: &policy.PortRange{From: 443, To: 443}},
			},
		},
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
	if !requestPolicy.Compiled.AllowsDestination(net.ParseIP("93.184.216.34"), 443) {
		t.Fatal("expected verified claims to allow configured destination")
	}
	if requestPolicy.Compiled.AllowsDestination(net.ParseIP("93.184.216.34"), 80) {
		t.Fatal("expected verified claims to deny unconfigured port")
	}
}

func TestPolicyFromRequestAllowsAllWhenAuthenticationDisabled(t *testing.T) {
	server := &Server{DisableAuthentication: true}
	request := httptest.NewRequest("GET", "http://example.com", nil)

	requestPolicy, err := server.policyFromRequest(request)
	if err != nil {
		t.Fatal(err)
	}
	if !requestPolicy.Claims.LegacyFallback {
		t.Fatal("expected disabled auth to use legacy fallback claims")
	}
	if !requestPolicy.Compiled.AllowsDestination(net.ParseIP("10.0.0.1"), 443) {
		t.Fatal("expected disabled auth to allow private destinations")
	}
	if !requestPolicy.Compiled.AllowsDestination(net.ParseIP("169.254.169.254"), 80) {
		t.Fatal("expected disabled auth to allow metadata destination")
	}
}

func TestExplicitPrivateIPAllowlistOverridesDefaultBlock(t *testing.T) {
	compiled, err := policy.Compile(policy.Claims{
		EgressPolicy: &policy.CompiledNetworkAllowList{
			Direction: "egress",
			Entries: []policy.CompiledNetworkAllowEntry{
				{CIDR: "10.0.0.1/32"},
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !compiled.AllowsDestination(net.ParseIP("10.0.0.1"), 443) {
		t.Fatal("expected explicit private IP allowlist to allow matching IP")
	}
}

func TestLogAuthorizedRequestIncludesJTIAndPolicySummary(t *testing.T) {
	var buf bytes.Buffer
	server := &Server{
		Logger: slog.New(slog.NewJSONHandler(&buf, nil)),
	}

	request := httptest.NewRequest("GET", "http://example.com/resource", nil)
	server.logAuthorizedRequest(request, &requestPolicy{
		Claims: policy.Claims{
			TenantID:          "tenant_123",
			FunctionID:        "function_123",
			FunctionVersionID: "functionVersion_123",
			EgressPolicy: &policy.CompiledNetworkAllowList{
				Direction: "egress",
				Entries: []policy.CompiledNetworkAllowEntry{
					{CIDR: "93.184.216.34/32", PortRange: &policy.PortRange{From: 443, To: 443}},
				},
			},
			RegisteredClaims: jwt.RegisteredClaims{
				ID: "jti_123",
			},
		},
	})

	var logged map[string]any
	if err := json.Unmarshal(buf.Bytes(), &logged); err != nil {
		t.Fatal(err)
	}
	if logged["msg"] != "proxy request authorized" {
		t.Fatalf("unexpected log message %q", logged["msg"])
	}
	if logged["jti"] != "jti_123" {
		t.Fatalf("unexpected jti %q", logged["jti"])
	}
	if logged["policyMode"] != "explicit" || logged["policyDirection"] != "egress" {
		t.Fatalf("unexpected policy summary %#v", logged)
	}
	if logged["policyEntries"] != float64(1) {
		t.Fatalf("unexpected policy entries %#v", logged["policyEntries"])
	}
	if logged["policyFingerprint"] == "" {
		t.Fatal("expected policy fingerprint")
	}
}

func TestLegacyFallbackSkipsAuthorizedRequestLog(t *testing.T) {
	var buf bytes.Buffer
	server := &Server{
		Logger:   slog.New(slog.NewJSONHandler(&buf, nil)),
		Verifier: auth.NewVerifier("secret", "deflector"),
	}
	token := proxyToken(t, "secret", policy.Claims{
		LegacyFallback: true,
		RegisteredClaims: jwt.RegisteredClaims{
			Audience:  jwt.ClaimStrings{"deflector"},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
		},
	})
	request := httptest.NewRequest("GET", "http://127.0.0.1:1/resource", nil)
	request.Header.Set(
		"Proxy-Authorization",
		"Basic "+base64.StdEncoding.EncodeToString([]byte(token+":x")),
	)

	server.ServeHTTP(httptest.NewRecorder(), request)

	if bytes.Contains(buf.Bytes(), []byte("proxy request authorized")) {
		t.Fatal("legacy fallback should not emit authorized request logs")
	}
}
