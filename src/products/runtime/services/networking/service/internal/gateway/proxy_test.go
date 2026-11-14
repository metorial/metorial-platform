package gateway

import (
	"bufio"
	"encoding/base64"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
)

func basicAuth(grant string) string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(grant+":x"))
}

func readStatus(t *testing.T, reader *bufio.Reader) (int, string) {
	t.Helper()
	response, err := http.ReadResponse(reader, nil)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(response.Body)
	return response.StatusCode, string(body)
}

func TestProxyConnectAllowed(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	env.route("93.184.216.34:443", startEcho(t))

	for name, authorization := range map[string]string{
		"basic":  basicAuth(env.grant()),
		"bearer": "Bearer " + env.grant(),
	} {
		t.Run(name, func(t *testing.T) {
			conn, reader := env.proxyConn()
			_, _ = conn.Write([]byte("CONNECT example.test:443 HTTP/1.1\r\nHost: example.test:443\r\nProxy-Authorization: " + authorization + "\r\n\r\nearly"))

			line, err := reader.ReadString('\n')
			if err != nil || line != "HTTP/1.1 200 Connection Established\r\n" {
				t.Fatalf("status line %q %v", line, err)
			}
			if blank, _ := reader.ReadString('\n'); blank != "\r\n" {
				t.Fatalf("expected empty header block, got %q", blank)
			}

			_, _ = conn.Write([]byte("-more"))
			buf := make([]byte, len("early-more"))
			if _, err := io.ReadFull(reader, buf); err != nil || string(buf) != "early-more" {
				t.Fatalf("echo %q %v", buf, err)
			}
		})
	}
	env.requireObservation("example.test", "93.184.216.34", 443, DecisionAllowed)
}

func TestProxyAbsoluteFormForwarding(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	received := make(chan *http.Request, 1)
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		received <- r.Clone(r.Context())
		w.Header().Set("X-Target", "yes")
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("short and stout"))
	}))
	t.Cleanup(target.Close)
	env.route("93.184.216.34:80", target.Listener.Addr().String())

	conn, reader := env.proxyConn()
	_, _ = conn.Write([]byte("GET http://example.test/brew?pot=1 HTTP/1.1\r\nHost: example.test\r\nProxy-Authorization: " + basicAuth(env.grant()) + "\r\nProxy-Connection: keep-alive\r\nX-Client: 1\r\n\r\n"))

	response, err := http.ReadResponse(reader, nil)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode != http.StatusTeapot || string(body) != "short and stout" || response.Header.Get("X-Target") != "yes" {
		t.Fatalf("response %d %q %v", response.StatusCode, body, response.Header)
	}

	request := <-received
	if request.URL.RequestURI() != "/brew?pot=1" || request.Host != "example.test" || request.Header.Get("X-Client") != "1" {
		t.Fatalf("forwarded request %s %s %v", request.Host, request.URL, request.Header)
	}
	if request.Header.Get("Proxy-Authorization") != "" || request.Header.Get("Proxy-Connection") != "" {
		t.Fatalf("proxy headers leaked: %v", request.Header)
	}
	env.requireObservation("example.test", "93.184.216.34", 80, DecisionAllowed)
}

func TestProxyUpgrade(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Upgrade") != "echo" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		conn, buffered, err := http.NewResponseController(w).Hijack()
		if err != nil {
			return
		}
		defer conn.Close()
		_, _ = conn.Write([]byte("HTTP/1.1 101 Switching Protocols\r\nUpgrade: echo\r\nConnection: Upgrade\r\n\r\n"))
		_, _ = io.Copy(conn, buffered)
	}))
	t.Cleanup(target.Close)
	env.route("93.184.216.34:80", target.Listener.Addr().String())

	conn, reader := env.proxyConn()
	_, _ = conn.Write([]byte("GET http://example.test/ws HTTP/1.1\r\nHost: example.test\r\nConnection: Upgrade\r\nUpgrade: echo\r\nProxy-Authorization: " + basicAuth(env.grant()) + "\r\n\r\n"))

	response, err := http.ReadResponse(reader, nil)
	if err != nil || response.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("upgrade response %v %v", response, err)
	}
	_, _ = conn.Write([]byte("frame"))
	buf := make([]byte, 5)
	if _, err := io.ReadFull(reader, buf); err != nil || string(buf) != "frame" {
		t.Fatalf("echo %q %v", buf, err)
	}
}

func TestProxyErrorsMatchDeflector(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	grant := env.grant()
	auth := "Proxy-Authorization: " + basicAuth(grant) + "\r\n"
	explicit := env.grant(withPolicy(&policy.Policy{Entries: []policy.Entry{{CIDR: "1.1.1.0/24"}}}))

	cases := []struct {
		name    string
		request string
		status  int
		body    string
	}{
		{"missing auth", "CONNECT example.test:443 HTTP/1.1\r\nHost: example.test:443\r\n\r\n", 407, "Metorial Magic Network: proxy authentication failed\n"},
		{"unsupported scheme", "CONNECT example.test:443 HTTP/1.1\r\nHost: example.test:443\r\nProxy-Authorization: Digest abc\r\n\r\n", 407, "Metorial Magic Network: proxy authentication failed\n"},
		{"basic without colon", "CONNECT example.test:443 HTTP/1.1\r\nHost: example.test:443\r\nProxy-Authorization: Basic " + base64.StdEncoding.EncodeToString([]byte(grant)) + "\r\n\r\n", 407, "Metorial Magic Network: proxy authentication failed\n"},
		{"bad token", "CONNECT example.test:443 HTTP/1.1\r\nHost: example.test:443\r\nProxy-Authorization: Bearer abc.def.ghi\r\n\r\n", 407, "Metorial Magic Network: proxy authentication failed\n"},
		{"absolute healthz needs auth", "GET http://example.test/healthz HTTP/1.1\r\nHost: example.test\r\n\r\n", 407, "Metorial Magic Network: proxy authentication failed\n"},
		{"invalid connect target", "CONNECT example.test HTTP/1.1\r\nHost: example.test\r\n" + auth + "\r\n", 400, "Metorial Magic Network: invalid CONNECT target\n"},
		{"internal destination", "CONNECT internal.test:443 HTTP/1.1\r\nHost: internal.test:443\r\n" + auth + "\r\n", 403, "Metorial Magic Network: policy denied outgoing request\n"},
		{"metadata absolute form", "GET http://169.254.169.254/latest/meta-data HTTP/1.1\r\nHost: 169.254.169.254\r\n" + auth + "\r\n", 403, "Metorial Magic Network: policy denied outgoing request\n"},
		{"outside explicit policy", "CONNECT example.test:443 HTTP/1.1\r\nHost: example.test:443\r\nProxy-Authorization: Bearer " + explicit + "\r\n\r\n", 403, "Metorial Magic Network: policy denied outgoing request\n"},
		{"dns failure", "CONNECT missing.test:443 HTTP/1.1\r\nHost: missing.test:443\r\n" + auth + "\r\n", 403, "Metorial Magic Network: policy denied outgoing request\n"},
		{"dial failure", "CONNECT down.example.test:443 HTTP/1.1\r\nHost: down.example.test:443\r\n" + auth + "\r\n", 403, "Metorial Magic Network: policy denied outgoing request\n"},
		{"healthz", "GET /healthz HTTP/1.1\r\nHost: gateway\r\n\r\n", 200, "ok"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			conn, reader := env.proxyConn()
			_, _ = conn.Write([]byte(tc.request))
			status, body := readStatus(t, reader)
			if status != tc.status || body != tc.body {
				t.Fatalf("got %d %q, want %d %q", status, body, tc.status, tc.body)
			}
		})
	}
}

func TestProxyUpstreamReadFailure(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })
	go func() {
		conn, err := listener.Accept()
		if err != nil {
			return
		}
		_, _ = bufio.NewReader(conn).ReadString('\n')
		_ = conn.Close()
	}()
	env.route("93.184.216.34:80", listener.Addr().String())

	conn, reader := env.proxyConn()
	_, _ = conn.Write([]byte("GET http://example.test/ HTTP/1.1\r\nHost: example.test\r\nProxy-Authorization: " + basicAuth(env.grant()) + "\r\n\r\n"))
	status, body := readStatus(t, reader)
	if status != http.StatusBadGateway || body != "Metorial Magic Network: upstream read failed\n" {
		t.Fatalf("got %d %q", status, body)
	}
}

func TestProxyIdleTimeout(t *testing.T) {
	env := newTestEnv(t, envOptions{idleTimeout: 150 * time.Millisecond})
	env.route("93.184.216.34:443", startEcho(t))

	conn, reader := env.proxyConn()
	_, _ = conn.Write([]byte("CONNECT example.test:443 HTTP/1.1\r\nHost: example.test:443\r\nProxy-Authorization: " + basicAuth(env.grant()) + "\r\n\r\n"))
	if line, _ := reader.ReadString('\n'); !strings.HasPrefix(line, "HTTP/1.1 200") {
		t.Fatalf("status line %q", line)
	}
	_, _ = reader.ReadString('\n')

	started := time.Now()
	if _, err := reader.ReadByte(); err == nil {
		t.Fatal("expected the idle connection to close")
	}
	if time.Since(started) > 5*time.Second {
		t.Fatal("idle timeout did not apply")
	}
}

func TestTokenFromProxyAuthorization(t *testing.T) {
	encode := func(s string) string { return base64.StdEncoding.EncodeToString([]byte(s)) }

	cases := map[string]string{
		"Bearer abc":                 "abc",
		"bearer abc":                 "abc",
		"Basic " + encode("abc:x"):   "abc",
		"basic " + encode("abc:"):    "abc",
		"Basic " + encode("abc:x:y"): "abc",
		"":                           "",
		"Bearer":                     "",
		"Bearer ":                    "",
		"Basic !!!":                  "",
		"Basic " + encode(":x"):      "",
		"Basic " + encode("abc"):     "",
		"Digest abc":                 "",
	}
	for header, want := range cases {
		got, err := TokenFromProxyAuthorization(header)
		if got != want || (want == "") != (err != nil) {
			t.Errorf("%q: got %q err %v, want %q", header, got, err, want)
		}
	}
}
