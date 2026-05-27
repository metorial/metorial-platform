package proxy

import (
	"bufio"
	"context"
	"encoding/base64"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/metorial/function-bay-deflector/internal/auth"
	"github.com/metorial/function-bay-deflector/internal/policy"
)

type Server struct {
	Logger   *slog.Logger
	Dialer   *net.Dialer
	Verifier *auth.Verifier
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/healthz" {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
		return
	}

	compiled, err := s.policyFromRequest(r)
	if err != nil {
		http.Error(w, "proxy authentication failed", http.StatusProxyAuthRequired)
		return
	}

	if r.Method == http.MethodConnect {
		s.handleConnect(w, r, compiled)
		return
	}

	s.handleHTTP(w, r, compiled)
}

func (s *Server) policyFromRequest(r *http.Request) (*policy.Compiled, error) {
	if s.Verifier == nil {
		return nil, errors.New("jwt verifier is required")
	}

	token, err := tokenFromProxyAuthorization(r.Header.Get("Proxy-Authorization"))
	if err != nil {
		return nil, err
	}

	claims, err := s.Verifier.Verify(r.Context(), token)
	if err != nil {
		return nil, err
	}
	return policy.Compile(claims)
}

func tokenFromProxyAuthorization(header string) (string, error) {
	if header == "" {
		return "", errors.New("missing proxy authorization")
	}

	scheme, value, ok := strings.Cut(header, " ")
	if !ok || value == "" {
		return "", errors.New("invalid proxy authorization")
	}

	if strings.EqualFold(scheme, "Bearer") {
		return value, nil
	}
	if !strings.EqualFold(scheme, "Basic") {
		return "", errors.New("unsupported proxy authorization scheme")
	}

	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	username, _, ok := strings.Cut(string(decoded), ":")
	if !ok || username == "" {
		return "", errors.New("invalid proxy authorization credentials")
	}
	return username, nil
}

func (s *Server) handleConnect(w http.ResponseWriter, r *http.Request, compiled *policy.Compiled) {
	host, port, err := net.SplitHostPort(r.Host)
	if err != nil {
		http.Error(w, "invalid CONNECT target", http.StatusBadRequest)
		return
	}

	upstream, err := s.dialAllowed(r.Context(), host, port, compiled)
	if err != nil {
		s.Logger.Warn("proxy denied connect", "host", host, "error", err)
		http.Error(w, "destination not allowed", http.StatusForbidden)
		return
	}
	defer upstream.Close()

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "hijacking unsupported", http.StatusInternalServerError)
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

func (s *Server) handleHTTP(w http.ResponseWriter, r *http.Request, compiled *policy.Compiled) {
	host := r.URL.Hostname()
	port := r.URL.Port()
	if port == "" {
		if r.URL.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	upstream, err := s.dialAllowed(r.Context(), host, port, compiled)
	if err != nil {
		s.Logger.Warn("proxy denied http request", "host", host, "error", err)
		http.Error(w, "destination not allowed", http.StatusForbidden)
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
		http.Error(w, "upstream write failed", http.StatusBadGateway)
		return
	}

	resp, err := http.ReadResponse(bufio.NewReader(upstream), r)
	if err != nil {
		http.Error(w, "upstream read failed", http.StatusBadGateway)
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
		http.Error(w, "hijacking unsupported", http.StatusInternalServerError)
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

func (s *Server) dialAllowed(ctx context.Context, host string, port string, compiled *policy.Compiled) (net.Conn, error) {
	if !compiled.AllowsHost(host) {
		return nil, errors.New("host denied")
	}

	resolver := net.DefaultResolver
	ips, err := resolver.LookupIP(ctx, "ip", host)
	if err != nil {
		return nil, err
	}

	for _, ip := range ips {
		if !compiled.AllowsIP(ip) {
			continue
		}
		dialer := s.Dialer
		if dialer == nil {
			dialer = &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
		}
		conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(ip.String(), port))
		if err == nil {
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
