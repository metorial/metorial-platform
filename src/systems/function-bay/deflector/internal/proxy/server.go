package proxy

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/metorial/function-bay-deflector/internal/auth"
	"github.com/metorial/function-bay-deflector/internal/observer"
	"github.com/metorial/function-bay-deflector/internal/policy"
)

var (
	errMissingProxyAuthorization            = errors.New("missing proxy authorization")
	errInvalidProxyAuthorization            = errors.New("invalid proxy authorization")
	errUnsupportedProxyAuthorizationScheme  = errors.New("unsupported proxy authorization scheme")
	errInvalidProxyAuthorizationCredentials = errors.New("invalid proxy authorization credentials")
	errVerifierRequired                     = errors.New("jwt verifier is required")
	errInvalidEgressPolicy                  = errors.New("invalid egress policy")
)

type Server struct {
	Logger   *slog.Logger
	Dialer   *net.Dialer
	Verifier *auth.Verifier
	Recorder *observer.Recorder
}

type requestPolicy struct {
	Claims   policy.Claims
	Compiled *policy.Compiled
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/healthz" {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
		return
	}

	requestPolicy, err := s.policyFromRequest(r)
	if err != nil {
		s.logAuthFailure(r, err)
		http.Error(w, "Metorial Magic Network: proxy authentication failed", http.StatusProxyAuthRequired)
		return
	}
	if !requestPolicy.Claims.LegacyFallback {
		s.logAuthorizedRequest(r, requestPolicy)
	}

	if r.Method == http.MethodConnect {
		s.handleConnect(w, r, requestPolicy)
		return
	}

	s.handleHTTP(w, r, requestPolicy)
}

func (s *Server) policyFromRequest(r *http.Request) (*requestPolicy, error) {
	if s.Verifier == nil {
		return nil, errVerifierRequired
	}

	token, err := tokenFromProxyAuthorization(r.Header.Get("Proxy-Authorization"))
	if err != nil {
		return nil, err
	}

	claims, err := s.Verifier.Verify(r.Context(), token)
	if err != nil {
		return nil, err
	}
	compiled, err := policy.Compile(claims)
	if err != nil {
		return nil, errors.Join(errInvalidEgressPolicy, err)
	}
	return &requestPolicy{Claims: claims, Compiled: compiled}, nil
}

func tokenFromProxyAuthorization(header string) (string, error) {
	if header == "" {
		return "", errMissingProxyAuthorization
	}

	scheme, value, ok := strings.Cut(header, " ")
	if !ok || value == "" {
		return "", errInvalidProxyAuthorization
	}

	if strings.EqualFold(scheme, "Bearer") {
		return value, nil
	}
	if !strings.EqualFold(scheme, "Basic") {
		return "", errUnsupportedProxyAuthorizationScheme
	}

	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", errors.Join(errInvalidProxyAuthorizationCredentials, err)
	}
	username, _, ok := strings.Cut(string(decoded), ":")
	if !ok || username == "" {
		return "", errInvalidProxyAuthorizationCredentials
	}
	return username, nil
}

func (s *Server) logAuthFailure(r *http.Request, err error) {
	if s.Logger == nil {
		return
	}
	s.Logger.Warn(
		"proxy authentication failed",
		"reason", authFailureReason(err),
		"method", r.Method,
		"host", r.Host,
		"path", r.URL.Path,
	)
}

func authFailureReason(err error) string {
	switch {
	case errors.Is(err, errVerifierRequired):
		return "verifier_unconfigured"
	case errors.Is(err, errMissingProxyAuthorization):
		return "missing_proxy_authorization"
	case errors.Is(err, errInvalidProxyAuthorization):
		return "invalid_proxy_authorization"
	case errors.Is(err, errUnsupportedProxyAuthorizationScheme):
		return "unsupported_proxy_authorization_scheme"
	case errors.Is(err, errInvalidProxyAuthorizationCredentials):
		return "invalid_proxy_authorization_credentials"
	case errors.Is(err, errInvalidEgressPolicy):
		return "invalid_egress_policy"
	}

	message := strings.ToLower(err.Error())
	switch {
	case strings.Contains(message, "expired"):
		return "jwt_expired"
	case strings.Contains(message, "audience"):
		return "jwt_audience_mismatch"
	case strings.Contains(message, "not valid yet"):
		return "jwt_not_before"
	case strings.Contains(message, "signature"):
		return "jwt_signature_invalid"
	case strings.Contains(message, "missing required invocation claims"):
		return "jwt_missing_invocation_claims"
	default:
		return "jwt_invalid"
	}
}

func (s *Server) logAuthorizedRequest(r *http.Request, requestPolicy *requestPolicy) {
	if s.Logger == nil {
		return
	}

	summary := policyLogSummary(requestPolicy.Claims.EgressPolicy)
	s.Logger.Info(
		"proxy request authorized",
		"jti", requestPolicy.Claims.ID,
		"tenantId", requestPolicy.Claims.TenantID,
		"functionId", requestPolicy.Claims.FunctionID,
		"effectiveFunctionId", requestPolicy.Claims.EffectiveFunctionID,
		"functionVersionId", requestPolicy.Claims.FunctionVersionID,
		"enclaveId", requestPolicy.Claims.EnclaveID,
		"method", r.Method,
		"host", r.Host,
		"path", r.URL.Path,
		"policyMode", summary.Mode,
		"policyDirection", summary.Direction,
		"policyEntries", summary.Entries,
		"policyFingerprint", summary.Fingerprint,
	)
}

type policySummary struct {
	Mode        string
	Direction   string
	Entries     int
	Fingerprint string
}

func policyLogSummary(egressPolicy *policy.CompiledNetworkAllowList) policySummary {
	if egressPolicy == nil {
		return policySummary{Mode: "default"}
	}

	serialized, err := json.Marshal(egressPolicy)
	if err != nil {
		return policySummary{
			Mode:      "explicit",
			Direction: egressPolicy.Direction,
			Entries:   len(egressPolicy.Entries),
		}
	}

	hash := sha256.Sum256(serialized)
	return policySummary{
		Mode:        "explicit",
		Direction:   egressPolicy.Direction,
		Entries:     len(egressPolicy.Entries),
		Fingerprint: hex.EncodeToString(hash[:]),
	}
}

func (s *Server) handleConnect(w http.ResponseWriter, r *http.Request, requestPolicy *requestPolicy) {
	host, port, err := net.SplitHostPort(r.Host)
	if err != nil {
		http.Error(w, "Metorial Magic Network: invalid CONNECT target", http.StatusBadRequest)
		return
	}

	upstream, err := s.dialAllowed(r.Context(), host, port, requestPolicy)
	if err != nil {
		s.Logger.Warn("proxy denied connect", "host", host, "error", err)
		http.Error(w, "Metorial Magic Network: policy denied outgoing request", http.StatusForbidden)
		return
	}
	defer upstream.Close()

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "Metorial Magic Network: hijacking unsupported", http.StatusInternalServerError)
		return
	}
	client, _, err := hijacker.Hijack()
	if err != nil {
		return
	}
	defer client.Close()

	_, _ = client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))
	pipe(client, upstream)
}

func (s *Server) handleHTTP(w http.ResponseWriter, r *http.Request, requestPolicy *requestPolicy) {
	host := r.URL.Hostname()
	port := r.URL.Port()
	if port == "" {
		if r.URL.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	upstream, err := s.dialAllowed(r.Context(), host, port, requestPolicy)
	if err != nil {
		s.Logger.Warn("proxy denied http request", "host", host, "error", err)
		http.Error(w, "Metorial Magic Network: policy denied outgoing request", http.StatusForbidden)
		return
	}
	defer upstream.Close()

	if isUpgradeRequest(r) {
		s.handleUpgrade(w, r, upstream)
		return
	}

	out := r.Clone(r.Context())
	out.RequestURI = ""
	out.URL.Scheme = ""
	out.URL.Host = ""
	out.Header.Del("Proxy-Authorization")
	out.Header.Del("Proxy-Connection")

	if err := out.Write(upstream); err != nil {
		http.Error(w, "Metorial Magic Network: upstream write failed", http.StatusBadGateway)
		return
	}

	resp, err := http.ReadResponse(bufio.NewReader(upstream), r)
	if err != nil {
		http.Error(w, "Metorial Magic Network: upstream read failed", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(resp.StatusCode)
	copyStreaming(w, resp.Body)
}

func isUpgradeRequest(r *http.Request) bool {
	hasUpgradeToken := false
	for _, part := range strings.Split(r.Header.Get("Connection"), ",") {
		if strings.EqualFold(strings.TrimSpace(part), "upgrade") {
			hasUpgradeToken = true
			break
		}
	}
	return hasUpgradeToken && r.Header.Get("Upgrade") != ""
}

func (s *Server) handleUpgrade(w http.ResponseWriter, r *http.Request, upstream net.Conn) {
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "Metorial Magic Network: hijacking unsupported", http.StatusInternalServerError)
		return
	}

	client, buffered, err := hijacker.Hijack()
	if err != nil {
		return
	}
	defer client.Close()

	out := r.Clone(r.Context())
	out.RequestURI = ""
	out.URL.Scheme = ""
	out.URL.Host = ""
	out.Header.Del("Proxy-Authorization")
	out.Header.Del("Proxy-Connection")

	if err := out.Write(upstream); err != nil {
		_, _ = client.Write([]byte("HTTP/1.1 502 Bad Gateway\r\n\r\n"))
		return
	}
	if buffered.Reader.Buffered() > 0 {
		_, _ = io.Copy(upstream, buffered)
	}

	pipe(client, upstream)
}

func copyStreaming(w http.ResponseWriter, r io.Reader) {
	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 32*1024)
	for {
		n, readErr := r.Read(buf)
		if n > 0 {
			if _, writeErr := w.Write(buf[:n]); writeErr != nil {
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if readErr != nil {
			return
		}
	}
}

func (s *Server) dialAllowed(ctx context.Context, host string, port string, requestPolicy *requestPolicy) (net.Conn, error) {
	resolver := net.DefaultResolver
	ips, err := resolver.LookupIP(ctx, "ip", host)
	if err != nil {
		return nil, err
	}

	portNum, err := net.LookupPort("tcp", port)
	if err != nil {
		return nil, err
	}

	for _, ip := range ips {
		if !requestPolicy.Compiled.AllowsDestination(ip, portNum) {
			continue
		}
		dialer := s.Dialer
		if dialer == nil {
			dialer = &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
		}
		conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(ip.String(), port))
		if err == nil {
			if s.Recorder != nil && !requestPolicy.Claims.LegacyFallback {
				s.Recorder.Record(requestPolicy.Claims, host, ip.String(), port)
			}
			return conn, nil
		}
	}

	return nil, errors.New("no allowed resolved IPs")
}

func pipe(a net.Conn, b net.Conn) {
	done := make(chan struct{}, 2)
	go func() {
		_, _ = io.Copy(a, b)
		done <- struct{}{}
	}()
	go func() {
		_, _ = io.Copy(b, a)
		done <- struct{}{}
	}()
	<-done
}
