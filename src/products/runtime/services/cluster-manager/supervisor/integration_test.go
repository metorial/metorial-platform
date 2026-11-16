package supervisor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/functionruntimerpc"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/auth/authtest"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/bundle/bundletest"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/gateway/gatewaytest"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/policygate"
)

const testVersionID = "fnv_integration"

var bootstrapPath = filepath.Join("..", "..", "functions", "packages", "runtime-node", "dist", "bootstrap.cjs")

const handlerSource = `
let net = require('node:net');
exports.handler = async input => {
  if (input.log) console.log(input.log);
  if (input.logBytes) {
    let line = 'x'.repeat(1023);
    for (let i = 0; i < input.logBytes / 1024; i++) console.log(line);
  }
  if (input.sleepMs) await new Promise(resolve => setTimeout(resolve, input.sleepMs));
  if (input.exit) process.exit(input.exit);
  if (input.fetch) {
    try {
      let res = await fetch(input.fetch);
      return { status: res.status, body: await res.text() };
    } catch (err) {
      return { fetchError: err.cause?.code ?? err.message, message: err.cause?.message };
    }
  }
  if (input.lookup) {
    return await require('node:dns').promises.lookup(input.lookup).catch(err => ({ lookupError: err.code }));
  }
  return { echo: input, pid: process.pid };
};
`

type harness struct {
	t        *testing.T
	signer   *authtest.Signer
	sup      *Supervisor
	client   *functionruntimerpc.Client
	server   *httptest.Server
	gateway  *gatewaytest.Fake
	upstream string
	stdout   *syncBuffer
}

type harnessOptions struct {
	mode    Mode
	files   map[string]string
	timeout time.Duration
	gate    policygate.Mode
	targets []string
}

type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func newHarness(t *testing.T, opts harnessOptions) *harness {
	t.Helper()

	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node is not installed")
	}
	bootstrap, _ := filepath.Abs(bootstrapPath)
	if _, err := os.Stat(bootstrap); err != nil {
		t.Skipf("runtime-node bootstrap not built (run bun run build in services/functions/packages/runtime-node): %v", err)
	}

	if opts.mode == "" {
		opts.mode = ModeShared
	}
	if opts.files == nil {
		opts.files = map[string]string{"index.js": handlerSource}
	}
	if opts.timeout == 0 {
		opts.timeout = 30 * time.Second
	}

	dir := t.TempDir()
	signer := authtest.NewSigner()
	keysFile := filepath.Join(dir, "keys.json")
	tokenFile := filepath.Join(dir, "token")
	must(t, os.WriteFile(keysFile, authtest.KeysJSON(signer), 0o600))
	must(t, os.WriteFile(tokenFile, []byte("pod-token\n"), 0o600))

	var entries []bundletest.Entry
	for name, body := range opts.files {
		entries = append(entries, bundletest.File(name, body))
	}
	archive := bundletest.Pack(entries...)
	bundleServer := bundletest.NewServer("pod-token", archive)
	t.Cleanup(bundleServer.Close)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "upstream:"+r.URL.Path)
	}))
	t.Cleanup(upstream.Close)

	keys, err := egress.ParseKeySet(authtest.KeysJSON(signer))
	must(t, err)
	gw := gatewaytest.New(keys, map[string][]string{"api.test": {"127.0.0.1"}, "denied.test": {"127.0.0.1"}})
	t.Cleanup(gw.Close)

	socketDir, err := os.MkdirTemp("/tmp", "sv-")
	must(t, err)
	t.Cleanup(func() { _ = os.RemoveAll(socketDir) })

	cfg := &Config{
		FunctionID:         "fn_test",
		VersionID:          testVersionID,
		TenantID:           "ten_test",
		ExecutionEnv:       "knative",
		Runtime:            "nodejs:24",
		Entrypoint:         Entrypoint{Path: "index.js", Export: "handler", Kind: "module"},
		Mode:               opts.mode,
		Timeout:            opts.timeout,
		MemoryMB:           256,
		BundleSHA256:       bundletest.SHA256(archive),
		BundleSize:         int64(len(archive)),
		ClusterManagerAddr: bundleServer.URL,
		GatewayAddr:        gw.Addr,
		TokenFile:          tokenFile,
		KeysFile:           keysFile,
		CAFile:             filepath.Join(dir, "missing-ca.crt"),
		BundleDir:          filepath.Join(dir, "bundle"),
		SocketDir:          socketDir,
		NodeBinary:         node,
		BootstrapPath:      bootstrap,
		Environ:            []string{"PATH=" + os.Getenv("PATH"), "USER_SETTING=1", "NODE_OPTIONS=--inspect", "METORIAL_TENANT_ID=leak"},
		PolicyGate:         opts.gate,
		PolicyGateTargets:  opts.targets,
		PolicyGateTimeout:  500 * time.Millisecond,
	}
	must(t, os.MkdirAll(cfg.BundleDir, 0o755))

	stdout := &syncBuffer{}
	sup, err := New(cfg, stdout)
	must(t, err)
	t.Cleanup(sup.Close)

	server := httptest.NewServer(sup.Handler())
	t.Cleanup(server.Close)

	client, err := functionruntimerpc.NewClient(server.URL+"/rpc", ldrpc.ClientOptions{DirectRoute: true, Timeout: time.Minute})
	must(t, err)

	must(t, sup.boot(context.Background()))

	return &harness{t: t, signer: signer, sup: sup, client: client, server: server, gateway: gw, upstream: upstream.URL, stdout: stdout}
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func (h *harness) waitReady() {
	h.t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		resp, err := http.Get(h.server.URL + "/ready")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(20 * time.Millisecond)
	}
	h.t.Fatalf("supervisor never became ready (phase %s): %s", h.sup.Phase(), h.stdout.String())
}

var invocationSeq struct {
	sync.Mutex
	n int
}

func nextInvocationID() string {
	invocationSeq.Lock()
	defer invocationSeq.Unlock()
	invocationSeq.n++
	return "inv_" + strconv.Itoa(invocationSeq.n) + "_" + strconv.FormatInt(time.Now().UnixNano(), 36)
}

func (h *harness) input(payload any, pol *policy.Policy) *functionruntimerpc.InvokeInput {
	payloadJSON, _ := json.Marshal(payload)
	inv := authtest.Invocation{ID: nextInvocationID(), VersionID: testVersionID, PayloadJSON: string(payloadJSON), Policy: pol, AllowAll: pol == nil}
	return &functionruntimerpc.InvokeInput{
		VersionID:       testVersionID,
		PayloadJSON:     string(payloadJSON),
		InvocationToken: h.signer.InvocationToken(inv),
		EgressGrant:     h.signer.EgressGrant(inv),
		DeadlineMs:      20_000,
	}
}

type envelope struct {
	StatusCode int `json:"statusCode"`
	Body       struct {
		Result map[string]any `json:"result"`
		Error  struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	} `json:"body"`
}

func (h *harness) invoke(in *functionruntimerpc.InvokeInput) (*functionruntimerpc.InvokeOutput, envelope) {
	h.t.Helper()
	out, err := h.client.Invoke(context.Background(), in)
	if err != nil {
		h.t.Fatalf("invoke: %v\n%s", err, h.stdout.String())
	}
	var env envelope
	if err := json.Unmarshal(out.Payload, &env); err != nil {
		h.t.Fatalf("payload %s: %v", out.Payload, err)
	}
	return out, env
}

func (h *harness) rejection(in *functionruntimerpc.InvokeInput) string {
	h.t.Helper()
	_, err := h.client.Invoke(context.Background(), in)
	var rpcErr *ldrpc.Error
	if !errors.As(err, &rpcErr) || rpcErr.Code != functionruntimerpc.CodeInvocationUnauthorized {
		h.t.Fatalf("expected invocation_unauthorized, got %v", err)
	}
	return rpcErr.Reason
}

func TestIntegrationInvoke(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.waitReady()

	out, env := h.invoke(h.input(map[string]any{"hello": "wörld", "log": "inside the request"}, nil))
	if env.StatusCode != 200 || env.Body.Result["echo"].(map[string]any)["hello"] != "wörld" {
		t.Fatalf("unexpected envelope %+v", env)
	}
	if out.BootError || out.LogsTruncated || out.ComputeTimeMs < 0 {
		t.Fatalf("unexpected output %+v", out)
	}
	if len(out.Logs) != 1 || out.Logs[0].Line != "inside the request" || out.Logs[0].Stream != functionruntimerpc.InvokeLogLineStreamStdout {
		t.Fatalf("unexpected logs %+v", out.Logs)
	}
	if !strings.Contains(h.stdout.String(), `"line":"inside the request"`) || !strings.Contains(h.stdout.String(), `"requestId":"req_`) {
		t.Fatalf("log line not forwarded to stdout:\n%s", h.stdout.String())
	}
}

func TestIntegrationScrubsEnvironment(t *testing.T) {
	h := newHarness(t, harnessOptions{files: map[string]string{"index.js": `
		exports.handler = async () => ({ env: Object.keys(process.env).filter(k => k != 'PATH' && !k.startsWith('__CF')).sort(), argv: process.execArgv });
	`}})
	h.waitReady()

	_, env := h.invoke(h.input(map[string]any{"x": 1}, nil))
	got, _ := json.Marshal(env.Body.Result["env"])
	want := `["METORIAL_EXECUTION_ENV","METORIAL_FUNCTION_ID","METORIAL_FUNCTION_VERSION_ID","METORIAL_MEMORY_MB","METORIAL_RUNTIME","METORIAL_TIMEOUT_SECONDS","USER_SETTING"]`
	if string(got) != want {
		t.Fatalf("worker env = %s, want %s", got, want)
	}
}

func TestIntegrationEgress(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.waitReady()

	_, port, _ := net.SplitHostPort(strings.TrimPrefix(h.upstream, "http://"))
	portNum, _ := strconv.Atoi(port)
	allowAPI := &policy.Policy{Hosts: []policy.HostRule{{Pattern: "api.test", Ports: []int{portNum}}}}

	_, env := h.invoke(h.input(map[string]any{"fetch": "http://api.test:" + port + "/allowed"}, allowAPI))
	if env.Body.Result["body"] != "upstream:/allowed" {
		t.Fatalf("allowed fetch failed: %+v", env.Body.Result)
	}

	_, env = h.invoke(h.input(map[string]any{"fetch": "http://denied.test:" + port + "/x"}, allowAPI))
	if env.Body.Result["fetchError"] != "ECONNREFUSED" || !strings.Contains(env.Body.Result["message"].(string), "egress denied (policy)") {
		t.Fatalf("denied fetch: %+v", env.Body.Result)
	}

	_, env = h.invoke(h.input(map[string]any{"lookup": "api.test"}, allowAPI))
	if env.Body.Result["address"] != "127.0.0.1" {
		t.Fatalf("lookup: %+v", env.Body.Result)
	}

	t.Run("concurrent shared-mode grants don't cross", func(t *testing.T) {
		allowNothing := &policy.Policy{Hosts: []policy.HostRule{{Pattern: "nothing.test"}}}
		var wg sync.WaitGroup
		results := make([]map[string]any, 8)
		for i := range results {
			wg.Add(1)
			go func() {
				defer wg.Done()
				pol := allowAPI
				if i%2 == 1 {
					pol = allowNothing
				}
				_, env := h.invoke(h.input(map[string]any{"fetch": "http://api.test:" + port + "/c" + strconv.Itoa(i), "sleepMs": 50}, pol))
				results[i] = env.Body.Result
			}()
		}
		wg.Wait()
		for i, result := range results {
			if i%2 == 0 && result["body"] != "upstream:/c"+strconv.Itoa(i) {
				t.Errorf("request %d should have been allowed: %+v", i, result)
			}
			if i%2 == 1 && result["fetchError"] != "ECONNREFUSED" {
				t.Errorf("request %d should have been denied: %+v", i, result)
			}
		}
	})

	deadline := time.Now().Add(2 * time.Second)
	for h.gateway.OpenTunnels() > 0 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if open := h.gateway.OpenTunnels(); open != 0 {
		t.Fatalf("%d tunnels still open after the requests ended", open)
	}
}

func TestIntegrationRejections(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.waitReady()

	payload := `{"a":1}`
	valid := func() (*functionruntimerpc.InvokeInput, authtest.Invocation) {
		inv := authtest.Invocation{ID: nextInvocationID(), VersionID: testVersionID, PayloadJSON: payload, AllowAll: true}
		return &functionruntimerpc.InvokeInput{
			VersionID:       testVersionID,
			PayloadJSON:     payload,
			InvocationToken: h.signer.InvocationToken(inv),
			EgressGrant:     h.signer.EgressGrant(inv),
			DeadlineMs:      10_000,
		}, inv
	}

	cases := map[string]func() *functionruntimerpc.InvokeInput{
		"payload_mismatch": func() *functionruntimerpc.InvokeInput {
			in, _ := valid()
			in.PayloadJSON = `{"a":2}`
			return in
		},
		"grant_binding_mismatch": func() *functionruntimerpc.InvokeInput {
			in, inv := valid()
			inv.ID = nextInvocationID()
			in.EgressGrant = h.signer.EgressGrant(inv)
			return in
		},
		"version_mismatch": func() *functionruntimerpc.InvokeInput {
			in, _ := valid()
			in.VersionID = "fnv_other"
			return in
		},
		"token_version_mismatch": func() *functionruntimerpc.InvokeInput {
			in, inv := valid()
			inv.VersionID = "fnv_other"
			in.InvocationToken = h.signer.InvocationToken(inv)
			return in
		},
		"token_unknown_kid": func() *functionruntimerpc.InvokeInput {
			in, inv := valid()
			in.InvocationToken = authtest.NewSigner().InvocationToken(inv)
			return in
		},
		"token_bad_signature": func() *functionruntimerpc.InvokeInput {
			in, _ := valid()
			parts := strings.Split(in.InvocationToken, ".")
			in.InvocationToken = parts[0] + "." + parts[1] + ".AAAA" + parts[2][4:]
			return in
		},
	}
	for want, build := range cases {
		t.Run(want, func(t *testing.T) {
			if got := h.rejection(build()); got != want {
				t.Fatalf("reason = %q, want %q", got, want)
			}
		})
	}

	t.Run("replayed", func(t *testing.T) {
		in, _ := valid()
		if _, env := h.invoke(in); env.StatusCode != 200 {
			t.Fatalf("first use failed: %+v", env)
		}
		if got := h.rejection(in); got != "replayed" {
			t.Fatalf("reason = %q, want replayed", got)
		}
	})

	if !strings.Contains(h.stdout.String(), `"msg":"invocation rejected"`) {
		t.Fatal("rejections are not logged")
	}
}

func TestIntegrationPayloadTooLarge(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.waitReady()

	in := h.input(map[string]any{"x": strings.Repeat("ü", MaxPayloadBytes/2)}, nil)
	_, err := h.client.Invoke(context.Background(), in)
	var rpcErr *ldrpc.Error
	if !errors.As(err, &rpcErr) || rpcErr.Code != "invalid_data" {
		t.Fatalf("expected invalid_data, got %v", err)
	}
}

func TestIntegrationSharedTimeout(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.waitReady()

	_, first := h.invoke(h.input(map[string]any{}, nil))

	in := h.input(map[string]any{"sleepMs": 5000}, nil)
	in.DeadlineMs = 300
	started := time.Now()
	out, env := h.invoke(in)
	if env.StatusCode != 504 || env.Body.Error.Code != "function_bay.timeout" {
		t.Fatalf("unexpected envelope %+v", env)
	}
	if elapsed := time.Since(started); elapsed > 2*time.Second || out.ComputeTimeMs < 250 {
		t.Fatalf("timeout took %s (compute %dms)", elapsed, out.ComputeTimeMs)
	}

	_, after := h.invoke(h.input(map[string]any{}, nil))
	if after.Body.Result["pid"] != first.Body.Result["pid"] {
		t.Fatal("shared-mode timeout restarted the worker")
	}
}

func TestIntegrationExclusiveTimeoutRestartsWorker(t *testing.T) {
	h := newHarness(t, harnessOptions{mode: ModeExclusive, timeout: 1 * time.Second})
	h.waitReady()

	_, first := h.invoke(h.input(map[string]any{}, nil))

	_, env := h.invoke(h.input(map[string]any{"sleepMs": 5000}, nil))
	if env.StatusCode != 504 || env.Body.Error.Message != "Function timed out after 1s" {
		t.Fatalf("unexpected envelope %+v", env)
	}

	_, after := h.invoke(h.input(map[string]any{}, nil))
	if after.StatusCode != 200 || after.Body.Result["pid"] == first.Body.Result["pid"] {
		t.Fatalf("worker was not replaced after an exclusive timeout: %+v", after)
	}
}

func TestIntegrationCrashRestartsWorker(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.waitReady()

	_, first := h.invoke(h.input(map[string]any{}, nil))

	_, env := h.invoke(h.input(map[string]any{"exit": 3}, nil))
	if env.StatusCode != 500 || env.Body.Error.Code != "function_bay.crash" {
		t.Fatalf("unexpected envelope %+v", env)
	}

	_, after := h.invoke(h.input(map[string]any{}, nil))
	if after.StatusCode != 200 || after.Body.Result["pid"] == first.Body.Result["pid"] {
		t.Fatalf("worker was not restarted: %+v", after)
	}
}

func TestIntegrationRepeatedCrashesFailReadiness(t *testing.T) {
	h := newHarness(t, harnessOptions{files: map[string]string{"index.js": `
		setTimeout(() => process.exit(7), 20);
		exports.handler = async () => 'never';
	`}})

	deadline := time.Now().Add(20 * time.Second)
	for h.sup.Phase() != "failed" && time.Now().Before(deadline) {
		time.Sleep(50 * time.Millisecond)
	}
	if h.sup.Phase() != "failed" {
		t.Fatalf("phase = %s", h.sup.Phase())
	}
	resp, err := http.Get(h.server.URL + "/ready")
	must(t, err)
	resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("/ready = %d", resp.StatusCode)
	}
}

func TestIntegrationBootError(t *testing.T) {
	h := newHarness(t, harnessOptions{files: map[string]string{"index.js": `throw new Error('config missing');`}})
	h.waitReady()

	out, env := h.invoke(h.input(map[string]any{}, nil))
	if !out.BootError || env.StatusCode != 500 || env.Body.Error.Code != "function_bay.boot_error" || !strings.Contains(env.Body.Error.Message, "config missing") {
		t.Fatalf("unexpected output %+v %+v", out, env)
	}
}

func TestIntegrationLogTruncation(t *testing.T) {
	h := newHarness(t, harnessOptions{})
	h.waitReady()

	out, env := h.invoke(h.input(map[string]any{"logBytes": 2 << 20}, nil))
	if env.StatusCode != 200 || !out.LogsTruncated {
		t.Fatalf("expected truncated logs, got %+v truncated=%v", env, out.LogsTruncated)
	}
	total := 0
	for _, line := range out.Logs {
		total += len(line.Line)
	}
	last := out.Logs[len(out.Logs)-1]
	if total > MaxLogBytes+len(truncationMarker) || last.Line != truncationMarker || last.Stream != functionruntimerpc.InvokeLogLineStreamStderr {
		t.Fatalf("logs total %d bytes, last %+v", total, last)
	}
}

// gateTarget is a target the "NetworkPolicy" doesn't deny until the returned func closes it.
func gateTarget(t *testing.T) (string, func()) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	must(t, err)
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			_ = conn.Close()
		}
	}()
	t.Cleanup(func() { _ = ln.Close() })
	return ln.Addr().String(), func() { _ = ln.Close() }
}

func TestIntegrationPolicyGateHoldsTheWorker(t *testing.T) {
	target, applyPolicy := gateTarget(t)
	applied := time.AfterFunc(300*time.Millisecond, applyPolicy)
	defer applied.Stop()

	started := time.Now()
	h := newHarness(t, harnessOptions{gate: policygate.ModeEnforce, targets: []string{target}})
	h.waitReady()

	logs := h.stdout.String()
	closed, spawned := strings.Index(logs, `"msg":"policy gate closed"`), strings.Index(logs, `"msg":"worker started"`)
	if time.Since(started) < 300*time.Millisecond || closed < 0 || spawned < closed {
		t.Fatalf("the worker started before the gate closed (after %s):\n%s", time.Since(started), logs)
	}
	if out, env := h.invoke(h.input(map[string]any{}, nil)); env.StatusCode != 200 || out.BootError {
		t.Fatalf("unexpected output %+v %+v", out, env)
	}
}

func TestIntegrationPolicyGateEnforce(t *testing.T) {
	target, _ := gateTarget(t)
	h := newHarness(t, harnessOptions{gate: policygate.ModeEnforce, targets: []string{target}})

	if h.sup.Phase() != "policy_gate_failed" || strings.Contains(h.stdout.String(), `"msg":"worker started"`) {
		t.Fatalf("phase %s:\n%s", h.sup.Phase(), h.stdout.String())
	}
	resp, err := http.Get(h.server.URL + "/ready")
	must(t, err)
	resp.Body.Close()
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("/ready = %d", resp.StatusCode)
	}
	_, err = h.client.Invoke(context.Background(), h.input(map[string]any{}, nil))
	if rpcErr, ok := ldrpc.AsError(err); !ok || rpcErr.Status != 503 || rpcErr.Code != "policy_gate_failed" {
		t.Fatalf("invoke without a worker: %v", err)
	}
}

func TestIntegrationPolicyGateWarn(t *testing.T) {
	target, _ := gateTarget(t)
	h := newHarness(t, harnessOptions{gate: policygate.ModeWarn, targets: []string{target}})
	h.waitReady()
	if !strings.Contains(h.stdout.String(), "NetworkPolicy is not in force; starting the worker anyway") {
		t.Fatalf("no warning logged:\n%s", h.stdout.String())
	}
}
