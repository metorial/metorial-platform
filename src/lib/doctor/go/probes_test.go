package doctor

import (
	"context"
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func probeResult(t *testing.T, body func(context.Context, *Result) error) CheckResult {
	t.Helper()

	check := Check{ID: "probe", Title: "Probe", Category: CategoryExternal, Severity: SeverityWarning, Run: body}
	doctor := newTestDoctor(t, Options{}, check)
	return run(t, doctor, false).Checks[0]
}

func TestHTTPProbe(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/denied" {
			w.WriteHeader(http.StatusForbidden)
		}
	}))
	defer server.Close()

	if result := probeResult(t, HTTPProbe(nil, server.URL)); result.Status != StatusPass {
		t.Fatalf("ok: %+v", result)
	}

	denied := probeResult(t, HTTPProbe(nil, server.URL+"/denied"))
	if denied.Status != StatusError || denied.Details["error"].(map[string]any)["kind"] != "permission" {
		t.Fatalf("denied: %+v", denied)
	}
}

func TestProbeWarnsWhenSlow(t *testing.T) {
	slow := func(ctx context.Context) error {
		time.Sleep(15 * time.Millisecond)
		return nil
	}

	result := probeResult(t, Probe("Cache", slow, 5*time.Millisecond))
	if result.Status != StatusWarn || result.Details["thresholdMs"] != int64(5) {
		t.Fatalf("slow: %+v", result)
	}
}

func TestTCPProbe(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Skip(err)
	}
	address := listener.Addr().String()

	if result := probeResult(t, TCPProbe(address)); result.Status != StatusPass {
		t.Fatalf("open: %+v", result)
	}

	listener.Close()
	refused := probeResult(t, TCPProbe(address))
	if refused.Status != StatusError || refused.Details["error"].(map[string]any)["kind"] != "connection_refused" {
		t.Fatalf("refused: %+v", refused)
	}
}

func TestTLSCertificateProbe(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer server.Close()

	host, port, _ := net.SplitHostPort(server.Listener.Addr().String())
	portNumber, _ := strconv.Atoi(port)

	untrusted := probeResult(t, TLSCertificateProbe(host, portNumber, nil, 0))
	if untrusted.Status != StatusError || untrusted.Details["error"].(map[string]any)["kind"] != "tls" {
		t.Fatalf("untrusted: %+v", untrusted)
	}

	config := server.Client().Transport.(*http.Transport).TLSClientConfig.Clone()
	config.ServerName = "example.com"
	trusted := probeResult(t, TLSCertificateProbe(host, portNumber, config, 0))
	if trusted.Status != StatusPass {
		t.Fatalf("trusted: %+v", trusted)
	}
}
