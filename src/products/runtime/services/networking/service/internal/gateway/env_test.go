package gateway

import (
	"bufio"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/rpc/networklogsrpc"
)

const testLogsSecret = "network-logs-test-secret"

var testHosts = map[string][]string{
	"example.test":      {"93.184.216.34"},
	"api.example.test":  {"93.184.216.40"},
	"v6.example.test":   {"2606:2800:220:1::10"},
	"internal.test":     {"10.20.0.5"},
	"multi.test":        {"10.20.0.5", "93.184.216.34"},
	"metadata.test":     {"169.254.169.254"},
	"evil.rebind.test":  {"10.20.0.5", "127.0.0.1"},
	"cluster.test":      {"10.42.1.7"},
	"nat64.test":        {"64:ff9b::a14:5"},
	"down.example.test": {"93.184.216.99"},
	"mapped.test":       {"::ffff:93.184.216.34"},
	"mapped.meta.test":  {"::ffff:169.254.169.254"},
}

type testEnv struct {
	t         *testing.T
	key       *egress.SigningKey
	evaluator *policy.Evaluator
	core      *Core
	metrics   *Metrics

	routesMu sync.Mutex
	routes   map[netip.AddrPort]string

	tunnelURL string
	proxyAddr string
}

type envOptions struct {
	allowInternal bool
	hardDeny      []string
	idleTimeout   time.Duration
}

func newTestEnv(t *testing.T, opts envOptions) *testEnv {
	t.Helper()

	seed := sha256.Sum256([]byte("gateway-test"))
	key, err := egress.NewSigningKey(seed[:], "test")
	if err != nil {
		t.Fatal(err)
	}

	hardDeny, err := policy.ParsePrefixes(opts.hardDeny)
	if err != nil {
		t.Fatal(err)
	}

	env := &testEnv{
		t:         t,
		key:       key,
		evaluator: &policy.Evaluator{AllowInternalDestinations: opts.allowInternal, HardDeny: hardDeny},
		metrics:   NewMetrics(),
		routes:    map[netip.AddrPort]string{},
	}
	env.core = &Core{
		Keys:        egress.NewKeySet(map[string]ed25519.PublicKey{"test": key.PublicKey()}),
		Evaluator:   env.evaluator,
		Resolver:    fakeResolver(testHosts),
		Dial:        env.dial,
		DialTimeout: 2 * time.Second,
		Memory:      NewResolveMemory(),
		Recorder:    NewRecorder("gw-test", time.Hour, nil),
		Metrics:     env.metrics,
		Logger:      testLogger(),
	}

	idle := opts.idleTimeout
	if idle == 0 {
		idle = time.Minute
	}

	tunnel := httptest.NewUnstartedServer(&TunnelServer{Core: env.core, IdleTimeout: idle})
	tunnel.Config.Protocols = new(http.Protocols)
	tunnel.Config.Protocols.SetHTTP1(true)
	tunnel.Config.Protocols.SetUnencryptedHTTP2(true)
	tunnel.Start()
	t.Cleanup(tunnel.Close)
	env.tunnelURL = tunnel.URL

	proxy := httptest.NewServer(&ProxyServer{Core: env.core, IdleTimeout: idle})
	t.Cleanup(proxy.Close)
	env.proxyAddr = proxy.Listener.Addr().String()

	return env
}

func (e *testEnv) route(addrPort string, target string) {
	e.routesMu.Lock()
	defer e.routesMu.Unlock()
	e.routes[netip.MustParseAddrPort(addrPort)] = target
}

func (e *testEnv) dial(ctx context.Context, network, address string) (net.Conn, error) {
	addrPort, err := netip.ParseAddrPort(address)
	if err != nil {
		return nil, err
	}

	e.routesMu.Lock()
	target, ok := e.routes[addrPort]
	e.routesMu.Unlock()
	if !ok {
		return nil, fmt.Errorf("dial %s: connection refused", address)
	}

	var dialer net.Dialer
	return dialer.DialContext(ctx, network, target)
}

type grantOption func(*egress.Grant)

func withPolicy(p *policy.Policy) grantOption {
	return func(g *egress.Grant) { g.Policy = p }
}

func withAllowAll() grantOption {
	return func(g *egress.Grant) { g.AllowAll = true }
}

func (e *testEnv) grant(opts ...grantOption) string {
	e.t.Helper()
	return e.mint(e.newGrant(opts...))
}

func (e *testEnv) newGrant(opts ...grantOption) *egress.Grant {
	now := time.Now()
	g := &egress.Grant{
		ID:                  "inv_" + rand.Text(),
		TenantID:            "ten_1",
		FunctionID:          "fn_1",
		EffectiveFunctionID: "fn_eff_1",
		FunctionVersionID:   "fnv_1",
		EnclaveID:           "enc_1",
		Source:              egress.SourceLambda,
		IssuedAt:            now.Unix(),
		ExpiresAt:           now.Add(5 * time.Minute).Unix(),
	}
	for _, opt := range opts {
		opt(g)
	}
	return g
}

func (e *testEnv) mint(g *egress.Grant) string {
	e.t.Helper()
	token, err := egress.MintGrant(e.key, *g)
	if err != nil {
		e.t.Fatal(err)
	}
	return token
}

func (e *testEnv) tunnelClient() *http.Client {
	transport := &http.Transport{Protocols: new(http.Protocols)}
	transport.Protocols.SetUnencryptedHTTP2(true)
	e.t.Cleanup(transport.CloseIdleConnections)
	return &http.Client{Transport: transport}
}

type tunnel struct {
	status int
	header http.Header
	writer *io.PipeWriter
	reader io.ReadCloser
}

func (e *testEnv) openTunnel(client *http.Client, target string, grant string) *tunnel {
	e.t.Helper()

	gatewayURL, _ := url.Parse(e.tunnelURL)
	reader, writer := io.Pipe()
	request := &http.Request{
		Method: http.MethodConnect,
		URL:    &url.URL{Scheme: gatewayURL.Scheme, Host: gatewayURL.Host},
		Host:   target,
		Header: http.Header{},
		Body:   reader,
	}
	if grant != "" {
		request.Header.Set(GrantHeader, grant)
	}

	response, err := client.Do(request)
	if err != nil {
		e.t.Fatalf("CONNECT %s: %v", target, err)
	}
	e.t.Cleanup(func() {
		_ = writer.Close()
		_ = response.Body.Close()
	})
	return &tunnel{status: response.StatusCode, header: response.Header, writer: writer, reader: response.Body}
}

func (tn *tunnel) roundTrip(t *testing.T, message string) string {
	t.Helper()
	if _, err := tn.writer.Write([]byte(message)); err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, len(message))
	if _, err := io.ReadFull(tn.reader, buf); err != nil {
		t.Fatal(err)
	}
	return string(buf)
}

func (e *testEnv) resolve(client *http.Client, host string, grant string) (int, []string) {
	e.t.Helper()

	request, _ := http.NewRequest(http.MethodGet, e.tunnelURL+"/v1/resolve?host="+url.QueryEscape(host), nil)
	request.Header.Set(GrantHeader, grant)
	response, err := client.Do(request)
	if err != nil {
		e.t.Fatal(err)
	}
	defer response.Body.Close()

	var body struct {
		Addresses []string `json:"addresses"`
	}
	if response.StatusCode == http.StatusOK {
		if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
			e.t.Fatal(err)
		}
	}
	return response.StatusCode, body.Addresses
}

func (e *testEnv) proxyConn() (net.Conn, *bufio.Reader) {
	e.t.Helper()
	conn, err := net.Dial("tcp", e.proxyAddr)
	if err != nil {
		e.t.Fatal(err)
	}
	e.t.Cleanup(func() { _ = conn.Close() })
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
	return conn, bufio.NewReader(conn)
}

func (e *testEnv) observations() []Observation {
	var out []Observation
	e.core.Recorder.mu.Lock()
	defer e.core.Recorder.mu.Unlock()
	for _, observation := range e.core.Recorder.active {
		out = append(out, observation)
	}
	return out
}

func (e *testEnv) findObservation(hostname, ip string, port int, decision Decision) *Observation {
	for _, observation := range e.observations() {
		if observation.Hostname == hostname && observation.IP == ip && observation.Port == port && observation.Decision == decision {
			return &observation
		}
	}
	return nil
}

func (e *testEnv) requireObservation(hostname, ip string, port int, decision Decision) Observation {
	e.t.Helper()
	observation := e.findObservation(hostname, ip, port, decision)
	if observation == nil {
		e.t.Fatalf("no %s observation for %s/%s:%d; have %+v", decision, hostname, ip, port, e.observations())
	}
	return *observation
}

type fakeResolver map[string][]string

func (f fakeResolver) LookupNetIP(_ context.Context, _ string, host string) ([]netip.Addr, error) {
	raw, ok := f[strings.TrimSuffix(strings.ToLower(host), ".")]
	if !ok {
		return nil, &net.DNSError{Err: "no such host", Name: host, IsNotFound: true}
	}
	addrs := make([]netip.Addr, 0, len(raw))
	for _, value := range raw {
		addrs = append(addrs, netip.MustParseAddr(value))
	}
	return addrs, nil
}

func startEcho(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = listener.Close() })

	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			go func() {
				defer conn.Close()
				_, _ = io.Copy(conn, conn)
			}()
		}
	}()
	return listener.Addr().String()
}

type fakeLogStore struct {
	mu       sync.Mutex
	batches  []networklogsrpc.ObservationIngestManyInput
	seen     map[string]bool
	failures int
}

func (f *fakeLogStore) ObservationIngestMany(_ context.Context, in *networklogsrpc.ObservationIngestManyInput) (*networklogsrpc.ObservationIngestManyOutput, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if f.failures > 0 {
		f.failures--
		return nil, ldrpc.NewError(503, "unavailable", "try again")
	}
	if f.seen[in.BatchID] {
		return &networklogsrpc.ObservationIngestManyOutput{Inserted: false}, nil
	}
	f.seen[in.BatchID] = true
	f.batches = append(f.batches, *in)
	return &networklogsrpc.ObservationIngestManyOutput{Inserted: true}, nil
}

func (f *fakeLogStore) ObservationList(context.Context, *networklogsrpc.ObservationListInput) (*networklogsrpc.ObservationListOutput, error) {
	return nil, ldrpc.ForbiddenError()
}

func startFakeLogStore(t *testing.T) (*fakeLogStore, *RPCSender) {
	t.Helper()

	store := &fakeLogStore{seen: map[string]bool{}}
	server := ldrpc.NewServer(ldrpc.ServerOptions{
		Path: "/rpc",
		Authenticate: ldrpc.HMACAuth(func(*http.Request) (string, error) {
			return testLogsSecret, nil
		}),
	})
	networklogsrpc.Register(server, store)
	mux := http.NewServeMux()
	server.Mount(mux)
	httpServer := httptest.NewServer(mux)
	t.Cleanup(httpServer.Close)

	client, err := networklogsrpc.NewClient(httpServer.URL+"/rpc", ldrpc.ClientOptions{
		HMACToken:    testLogsSecret,
		DisableRetry: true,
		Timeout:      5 * time.Second,
	})
	if err != nil {
		t.Fatal(err)
	}
	return store, &RPCSender{Client: client}
}

func splitTarget(t *testing.T, target string) (string, int) {
	t.Helper()
	parsed, err := ParseTarget(target)
	if err != nil {
		t.Fatal(err)
	}
	return parsed.Host, parsed.Port
}

func dialRaw(t *testing.T, addr string) (net.Conn, *bufio.Reader) {
	t.Helper()
	conn, err := net.Dial("tcp", addr)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
	return conn, bufio.NewReader(conn)
}
