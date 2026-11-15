package e2e

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
)

type echoResult struct {
	Value    map[string]any `json:"value"`
	Greeting string         `json:"greeting"`
	Host     string         `json:"host"`
	PID      int            `json:"pid"`
}

type sleepResult struct {
	Host      string `json:"host"`
	PID       int    `json:"pid"`
	StartedAt int64  `json:"startedAt"`
	EndedAt   int64  `json:"endedAt"`
}

func TestFunctionInvocation(t *testing.T) {
	e := setup(t)
	probe := e.deploy(t, "probe", deployOptions{
		files:   map[string]string{"index.js": probeFunction},
		env:     map[string]string{"GREETING": "hi from env"},
		timeout: 6,
	})

	var firstPID int
	t.Run("module entrypoint returns the result and per-request logs", func(t *testing.T) {
		out := e.invoke(t, probe, map[string]any{"op": "echo", "value": map[string]any{"hello": "wörld ✓"}})
		res := result[echoResult](t, out)
		if res.Value["hello"] != "wörld ✓" || res.Greeting != "hi from env" {
			t.Fatalf("unexpected result %+v", res)
		}
		firstPID = res.PID
		for _, want := range []struct {
			stream cm.InvokeLogLineStream
			line   string
		}{{cm.InvokeLogLineStreamStdout, `echo {"hello":"wörld ✓"}`}, {cm.InvokeLogLineStreamStderr, "to stderr"}, {cm.InvokeLogLineStreamStdout, "raw stdout write"}} {
			if !hasLog(out, want.stream, want.line) {
				t.Fatalf("missing %s log %q in %q", want.stream, want.line, logLines(out))
			}
		}
		if out.BootError || out.LogsTruncated {
			t.Fatalf("unexpected flags %+v", out)
		}
	})

	t.Run("worker environment is scrubbed", func(t *testing.T) {
		res := result[struct {
			Keys []string `json:"keys"`
		}](t, e.invoke(t, probe, map[string]any{"op": "env"}))
		informational := []string{"METORIAL_FUNCTION_ID", "METORIAL_FUNCTION_VERSION_ID", "METORIAL_EXECUTION_ENV", "METORIAL_RUNTIME", "METORIAL_TIMEOUT_SECONDS", "METORIAL_MEMORY_MB"}
		for _, k := range res.Keys {
			if contains(informational, k) {
				continue
			}
			for _, prefix := range []string{"METORIAL_", "CLUSTER_MANAGER_", "EGRESS_GATEWAY_", "KUBERNETES_", "K_", "PORT"} {
				if strings.HasPrefix(k, prefix) {
					t.Errorf("worker sees reserved variable %s", k)
				}
			}
		}
		if !contains(res.Keys, "GREETING") {
			t.Fatalf("function env missing: %v", res.Keys)
		}
	})

	t.Run("worker runs non-root on a read-only root filesystem", func(t *testing.T) {
		res := result[struct {
			Token        bool `json:"token"`
			RootWritable bool `json:"rootWritable"`
			UID          int  `json:"uid"`
		}](t, e.invoke(t, probe, map[string]any{"op": "files"}))
		if res.UID != 65532 || res.RootWritable {
			t.Fatalf("unexpected pod hardening %+v", res)
		}
		t.Logf("projected pod token readable by worker code: %v (accepted, PLAN 7.6)", res.Token)
	})

	t.Run("handler errors and bad payloads use the launcher envelope", func(t *testing.T) {
		out := e.invoke(t, probe, map[string]any{"op": "throw"})
		env := decodeEnvelope(t, out)
		if env.StatusCode != 500 || env.Body.Error == nil || env.Body.Error.Code != "function_bay.handler_error" || !strings.Contains(env.Body.Error.Message, "handler exploded") {
			t.Fatalf("unexpected handler error %s", out.Payload)
		}
		if !hasLog(out, cm.InvokeLogLineStreamStderr, "handler exploded") {
			t.Fatalf("thrown error not logged: %q", logLines(out))
		}

		out = e.invoke(t, probe, "not json")
		env = decodeEnvelope(t, out)
		if env.StatusCode != 400 || env.Body.Error == nil || env.Body.Error.Code != "function_bay.launcher" {
			t.Fatalf("unexpected invalid payload result %s", out.Payload)
		}
	})

	t.Run("bad invocation tokens are rejected", func(t *testing.T) {
		cases := map[string]func(*invocation){
			"payload hash mismatch":     func(i *invocation) { i.payloadSHA256 = egress.PayloadSHA256(`{"op":"env"}`) },
			"token for another version": func(i *invocation) { i.tokenVersionID = e.runID + "-other" },
			"grant for another version": func(i *invocation) { i.grantVersionID = e.runID + "-other" },
			"grant jti mismatch":        func(i *invocation) { i.grantID = randomID("inv_") },
			"expired token": func(i *invocation) {
				i.issuedAt = time.Now().Add(-10 * time.Minute)
				i.tokenExpiresAt = time.Now().Add(-2 * time.Minute)
			},
			"unknown kid":                 func(i *invocation) { i.tokenKey = randomKey(t) },
			"grant signed by unknown kid": func(i *invocation) { i.grantKey = randomKey(t) },
		}
		for name, mutate := range cases {
			t.Run(name, func(t *testing.T) {
				inv := e.newInvocation(probe, map[string]any{"op": "echo"})
				mutate(inv)
				_, err := e.invokeWith(t, probe, inv)
				expectCode(t, err, cm.CodeInvocationUnauthorized)
			})
		}

		t.Run("replayed token", func(t *testing.T) {
			inv := e.newInvocation(probe, map[string]any{"op": "echo"})
			token, grant := e.mint(t, probe, inv)
			inv.reuseToken, inv.reuseGrant = token, grant
			if _, err := e.invokeWith(t, probe, inv); err != nil {
				t.Fatal(err)
			}
			if pods := e.runningPods(t, e.functionsNS, versionLabel+"="+probe.versionID); len(pods) != 1 {
				t.Skipf("replay cache is per pod and %d pods are running", len(pods))
			}
			_, err := e.invokeWith(t, probe, inv)
			expectCode(t, err, cm.CodeInvocationUnauthorized)
		})
	})

	t.Run("logs are truncated at 1 MB", func(t *testing.T) {
		out := e.invoke(t, probe, map[string]any{"op": "log", "lines": 1500, "lineBytes": 1000})
		if !out.LogsTruncated {
			t.Fatalf("logs not truncated (%d lines)", len(out.Logs))
		}
		total := 0
		for _, l := range out.Logs {
			total += len(l.Line)
		}
		if total > 1<<20+1024 || len(out.Logs) < 900 {
			t.Fatalf("unexpected truncated logs: %d lines, %d bytes", len(out.Logs), total)
		}
		if last := out.Logs[len(out.Logs)-1].Line; !strings.Contains(last, "truncated") {
			t.Fatalf("missing truncation marker, last line %q", last)
		}
		if res := result[map[string]any](t, out); res["logged"] != float64(1500) {
			t.Fatalf("unexpected result %+v", res)
		}
	})

	t.Run("timeout kills and restarts the exclusive worker", func(t *testing.T) {
		start := time.Now()
		out := e.invoke(t, probe, map[string]any{"op": "sleep", "ms": 20_000})
		env := decodeEnvelope(t, out)
		if env.StatusCode != 504 || env.Body.Error == nil || env.Body.Error.Code != "function_bay.timeout" {
			t.Fatalf("unexpected timeout result %s", out.Payload)
		}
		if took := time.Since(start); took > 15*time.Second {
			t.Fatalf("timeout took %s", took)
		}

		res := result[echoResult](t, e.invoke(t, probe, map[string]any{"op": "echo"}))
		if res.PID == firstPID && len(e.runningPods(t, e.functionsNS, versionLabel+"="+probe.versionID)) == 1 {
			t.Fatalf("worker was not restarted after the timeout (pid %d)", res.PID)
		}
	})

	t.Run("an uncaught exception fails the request and the worker restarts", func(t *testing.T) {
		out := e.invoke(t, probe, map[string]any{"op": "crash"})
		env := decodeEnvelope(t, out)
		if env.StatusCode != 500 || env.Body.Error == nil || env.Body.Error.Code != "function_bay.crash" {
			t.Fatalf("unexpected crash result %s", out.Payload)
		}
		eventually(t, 30*time.Second, "the worker to come back", func() (bool, error) {
			out, err := e.invokeWith(t, probe, e.newInvocation(probe, map[string]any{"op": "echo"}))
			if err != nil {
				return false, err
			}
			return decodeEnvelope(t, out).StatusCode == 200, nil
		})
	})

	t.Run("exclusive mode never runs two requests in one worker", func(t *testing.T) {
		results := e.concurrently(t, probe, repeat(3, map[string]any{"op": "sleep", "ms": 1500})...)
		byWorker := map[string][]sleepResult{}
		for _, out := range results {
			r := result[sleepResult](t, out)
			byWorker[r.Host] = append(byWorker[r.Host], r)
		}
		for host, runs := range byWorker {
			for i := range runs {
				for j := i + 1; j < len(runs); j++ {
					if runs[i].StartedAt < runs[j].EndedAt && runs[j].StartedAt < runs[i].EndedAt {
						t.Fatalf("overlapping requests on %s: %+v", host, runs)
					}
				}
			}
		}
		t.Logf("3 concurrent exclusive requests ran on %d pods", len(byWorker))
	})

	t.Run("cold start after scale to zero", func(t *testing.T) {
		start := time.Now()
		eventually(t, 5*time.Minute, "scale to zero", func() (bool, error) {
			pods, err := e.kube.CoreV1().Pods(e.functionsNS).List(context.Background(), metav1.ListOptions{LabelSelector: versionLabel + "=" + probe.versionID})
			return err == nil && len(pods.Items) == 0, err
		})
		t.Logf("scaled to zero after %s", time.Since(start).Round(time.Second))

		start = time.Now()
		res := result[echoResult](t, e.invoke(t, probe, map[string]any{"op": "echo", "value": map[string]any{"cold": true}}))
		if res.Value["cold"] != true {
			t.Fatalf("unexpected cold result %+v", res)
		}
		t.Logf("cold invoke took %s", time.Since(start).Round(time.Millisecond))
	})
}

func TestFunctionEntrypoints(t *testing.T) {
	e := setup(t)

	t.Run("ES module default export", func(t *testing.T) {
		f := e.deploy(t, "esm", deployOptions{
			files:      map[string]string{"index.mjs": esmFunction},
			entrypoint: cm.FunctionEnsureInputEntrypoint{Path: "index.mjs", Export: "handler", Kind: cm.FunctionEnsureInputEntrypointKindModule},
		})
		res := result[map[string]any](t, e.invoke(t, f, map[string]any{"value": 7}))
		if res["esm"] != true || res["value"] != float64(7) {
			t.Fatalf("unexpected result %+v", res)
		}
	})

	t.Run("enveloped entrypoint passes the envelope through", func(t *testing.T) {
		f := e.deploy(t, "enveloped", deployOptions{
			files:      map[string]string{"index.js": envelopedFunction},
			entrypoint: cm.FunctionEnsureInputEntrypoint{Path: "index.js", Export: "handler", Kind: cm.FunctionEnsureInputEntrypointKindEnveloped},
		})
		out := e.invoke(t, f, map[string]any{"a": 1})
		env := decodeEnvelope(t, out)
		if env.StatusCode != 201 || string(env.Body.Result) != `{"enveloped":{"a":1}}` {
			t.Fatalf("unexpected enveloped result %s", out.Payload)
		}
		if !hasLog(out, cm.InvokeLogLineStreamStdout, "enveloped got object") {
			t.Fatalf("missing log: %q", logLines(out))
		}
	})

	t.Run("boot error", func(t *testing.T) {
		f := e.deploy(t, "booterror", deployOptions{files: map[string]string{"index.js": bootErrorFunction}})
		out := e.invoke(t, f, map[string]any{})
		env := decodeEnvelope(t, out)
		if !out.BootError || env.StatusCode != 500 || env.Body.Error == nil || env.Body.Error.Code != "function_bay.boot_error" || !strings.Contains(env.Body.Error.Message, "boom at boot") {
			t.Fatalf("unexpected boot error result %s (bootError=%v)", out.Payload, out.BootError)
		}
	})
}

func TestSharedConcurrency(t *testing.T) {
	e := setup(t)
	f := e.deploy(t, "shared", deployOptions{
		files:       map[string]string{"index.js": probeFunction},
		concurrency: cm.FunctionEnsureInputConcurrencyShared,
		timeout:     5,
	})

	t.Run("concurrent requests share one worker", func(t *testing.T) {
		start := time.Now()
		results := e.concurrently(t, f, repeat(5, map[string]any{"op": "sleep", "ms": 2000})...)
		elapsed := time.Since(start)
		workers := map[int]bool{}
		for _, out := range results {
			workers[result[sleepResult](t, out).PID] = true
		}
		if len(workers) != 1 || elapsed > 3900*time.Millisecond {
			t.Fatalf("5 shared requests took %s on %d workers", elapsed, len(workers))
		}
	})

	t.Run("a timed out request doesn't take the worker down", func(t *testing.T) {
		before := result[echoResult](t, e.invoke(t, f, map[string]any{"op": "echo"}))

		results := e.concurrently(t, f, map[string]any{"op": "sleep", "ms": 20_000}, map[string]any{"op": "sleep", "ms": 1000})
		timedOut, other := results[0], results[1]

		if env := decodeEnvelope(t, timedOut); env.StatusCode != 504 || env.Body.Error.Code != "function_bay.timeout" {
			t.Fatalf("unexpected timeout result %s", timedOut.Payload)
		}
		if r := result[sleepResult](t, other); r.PID != before.PID {
			t.Fatalf("the concurrent request ran on another worker: %d vs %d", r.PID, before.PID)
		}
		if after := result[echoResult](t, e.invoke(t, f, map[string]any{"op": "echo"})); after.PID != before.PID {
			t.Fatalf("shared worker was restarted after a timeout: %d vs %d", after.PID, before.PID)
		}
	})
}

func (e *env) concurrently(t *testing.T, f *function, payloads ...any) []*cm.InvokeOutput {
	t.Helper()
	invocations := make([]*invocation, len(payloads))
	for i, payload := range payloads {
		invocations[i] = e.newInvocation(f, payload)
	}

	results := make([]*cm.InvokeOutput, len(payloads))
	errs := make([]error, len(payloads))
	var wg sync.WaitGroup
	for i, inv := range invocations {
		token, grant := e.mint(t, f, inv)
		inv.reuseToken, inv.reuseGrant = token, grant
		wg.Go(func() { results[i], errs[i] = e.invokeWith(t, f, inv) })
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Fatalf("concurrent invoke %d: %v", i, err)
		}
	}
	return results
}

func repeat(n int, payload any) []any {
	out := make([]any, n)
	for i := range out {
		out[i] = payload
	}
	return out
}

func contains(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}
