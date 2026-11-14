package gateway

import (
	"bufio"
	"encoding/base64"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
)

const (
	messageAuthFailed        = "Metorial Magic Network: proxy authentication failed"
	messageInvalidTarget     = "Metorial Magic Network: invalid CONNECT target"
	messageDenied            = "Metorial Magic Network: policy denied outgoing request"
	messageUpstreamWrite     = "Metorial Magic Network: upstream write failed"
	messageUpstreamRead      = "Metorial Magic Network: upstream read failed"
	messageHijackUnsupported = "Metorial Magic Network: hijacking unsupported"
)

var (
	errMissingProxyAuthorization = errors.New("missing proxy authorization")
	errInvalidProxyAuthorization = errors.New("invalid proxy authorization")
)

// ProxyServer is the HTTP/1.1 forward proxy used by Lambda wrappers and build pods. Its
// status codes and messages match the deflector it replaces.
type ProxyServer struct {
	Core        *Core
	IdleTimeout time.Duration
}

func (s *ProxyServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodConnect && r.URL.Host == "" && r.URL.Path == "/healthz" {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
		return
	}

	grant, err := s.grantFromRequest(r)
	if err != nil {
		s.Core.logger().Warn("proxy authentication failed", "reason", authFailureReason(err), "method", r.Method, "host", r.Host)
		http.Error(w, messageAuthFailed, http.StatusProxyAuthRequired)
		return
	}

	if r.Method == http.MethodConnect {
		s.handleConnect(w, r, grant)
		return
	}
	s.handleHTTP(w, r, grant)
}

func (s *ProxyServer) grantFromRequest(r *http.Request) (*egress.Grant, error) {
	token, err := TokenFromProxyAuthorization(r.Header.Get("Proxy-Authorization"))
	if err != nil {
		s.Core.metrics().GrantFailures.WithLabelValues(string(FrontEndProxy), "missing_credentials").Inc()
		return nil, err
	}
	return s.Core.VerifyGrant(FrontEndProxy, token)
}

// TokenFromProxyAuthorization accepts "Bearer <grant>" or "Basic base64(<grant>:<anything>)".
func TokenFromProxyAuthorization(header string) (string, error) {
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
		return "", errInvalidProxyAuthorization
	}

	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", errInvalidProxyAuthorization
	}
	username, _, ok := strings.Cut(string(decoded), ":")
	if !ok || username == "" {
		return "", errInvalidProxyAuthorization
	}
	return username, nil
}

func authFailureReason(err error) string {
	switch {
	case errors.Is(err, errMissingProxyAuthorization):
		return "missing_proxy_authorization"
	case errors.Is(err, errInvalidProxyAuthorization):
		return "invalid_proxy_authorization"
	}
	if code := egress.CodeOf(err); code != "" {
		return string(code)
	}
	return "invalid"
}

func (s *ProxyServer) handleConnect(w http.ResponseWriter, r *http.Request, grant *egress.Grant) {
	host, port, err := net.SplitHostPort(r.Host)
	if err != nil || host == "" {
		http.Error(w, messageInvalidTarget, http.StatusBadRequest)
		return
	}

	upstream, ok := s.dial(w, r, grant, host, port)
	if !ok {
		return
	}
	defer upstream.Close()

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, messageHijackUnsupported, http.StatusInternalServerError)
		return
	}
	client, buffered, err := hijacker.Hijack()
	if err != nil {
		return
	}
	defer client.Close()

	if _, err := client.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n")); err != nil {
		return
	}
	s.pipe(client, buffered.Reader, upstream, grant)
}

func (s *ProxyServer) handleHTTP(w http.ResponseWriter, r *http.Request, grant *egress.Grant) {
	host := r.URL.Hostname()
	port := r.URL.Port()
	if port == "" {
		if r.URL.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	upstream, ok := s.dial(w, r, grant, host, port)
	if !ok {
		return
	}
	defer upstream.Close()

	out := r.Clone(r.Context())
	out.RequestURI = ""
	out.URL.Scheme = ""
	out.URL.Host = ""
	out.Header.Del("Proxy-Authorization")
	out.Header.Del("Proxy-Connection")

	if isUpgradeRequest(r) {
		s.handleUpgrade(w, out, upstream, grant)
		return
	}

	if err := out.Write(upstream); err != nil {
		http.Error(w, messageUpstreamWrite, http.StatusBadGateway)
		return
	}

	response, err := http.ReadResponse(bufio.NewReader(upstream), r)
	if err != nil {
		http.Error(w, messageUpstreamRead, http.StatusBadGateway)
		return
	}
	defer response.Body.Close()

	for key, values := range response.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	w.WriteHeader(response.StatusCode)

	metrics := s.Core.metrics()
	flush := func() { _ = http.NewResponseController(w).Flush() }
	copyCounted(w, response.Body, flush, func() {}, byteCounters(metrics, FrontEndProxy).downstream)
}

func (s *ProxyServer) handleUpgrade(w http.ResponseWriter, out *http.Request, upstream *Upstream, grant *egress.Grant) {
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, messageHijackUnsupported, http.StatusInternalServerError)
		return
	}
	client, buffered, err := hijacker.Hijack()
	if err != nil {
		return
	}
	defer client.Close()

	if err := out.Write(upstream); err != nil {
		_, _ = client.Write([]byte("HTTP/1.1 502 Bad Gateway\r\n\r\n"))
		return
	}
	s.pipe(client, buffered.Reader, upstream, grant)
}

// dial writes the deflector's 403 for every failure, including DNS and dial errors.
func (s *ProxyServer) dial(w http.ResponseWriter, r *http.Request, grant *egress.Grant, host, port string) (*Upstream, bool) {
	portNumber, err := net.LookupPort("tcp", port)
	if err != nil || portNumber < 1 || portNumber > 65535 || host == "" {
		http.Error(w, messageDenied, http.StatusForbidden)
		return nil, false
	}

	upstream, err := s.Core.Connect(r.Context(), FrontEndProxy, grant, Target{Host: host, Port: portNumber})
	if err != nil {
		s.Core.logger().Warn("proxy denied request", "method", r.Method, "host", host, "error", err)
		http.Error(w, messageDenied, http.StatusForbidden)
		return nil, false
	}
	return upstream, true
}

func (s *ProxyServer) pipe(client net.Conn, buffered *bufio.Reader, upstream *Upstream, grant *egress.Grant) {
	metrics := s.Core.metrics()
	metrics.OpenConnections.WithLabelValues(string(FrontEndProxy)).Inc()
	defer metrics.OpenConnections.WithLabelValues(string(FrontEndProxy)).Dec()

	var reader io.Reader = client
	if buffered != nil && buffered.Buffered() > 0 {
		reader = io.MultiReader(io.LimitReader(buffered, int64(buffered.Buffered())), client)
	}

	relay(upstream.Conn, clientSide{
		reader: reader,
		writer: client,
		close:  func() { _ = client.Close() },
	}, relayLimits{
		idle:     s.IdleTimeout,
		deadline: grant.Expiry().Add(egress.ClockSkew),
	}, byteCounters(metrics, FrontEndProxy))
}

func isUpgradeRequest(r *http.Request) bool {
	for _, part := range strings.Split(r.Header.Get("Connection"), ",") {
		if strings.EqualFold(strings.TrimSpace(part), "upgrade") {
			return r.Header.Get("Upgrade") != ""
		}
	}
	return false
}
