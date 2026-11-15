package builds

import (
	"bytes"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type gateRun struct {
	passed   bool
	stderr   string
	attempts int
	elapsed  time.Duration
}

// runGate runs the rendered prelude followed by a marker command under a minimal environment.
// A timeout shim counts probe attempts, using the real timeout where there is one.
func runGate(t *testing.T, env ...string) gateRun {
	t.Helper()
	bash, err := exec.LookPath("bash")
	if err != nil {
		t.Skip("bash not available")
	}
	realTimeout, _ := exec.LookPath("timeout")
	dir := t.TempDir()
	attempts := filepath.Join(dir, "attempts")
	shim := "#!/bin/bash\necho >> \"$GATE_ATTEMPTS\"\nif [ -n \"$REAL_TIMEOUT\" ]; then exec \"$REAL_TIMEOUT\" \"$@\"; fi\nshift\nexec \"$@\"\n"
	if err := os.WriteFile(filepath.Join(dir, "timeout"), []byte(shim), 0o755); err != nil {
		t.Fatal(err)
	}

	cmd := exec.Command(bash, "-c", policyGate+"echo passed")
	cmd.Env = append([]string{"PATH=" + dir + ":" + os.Getenv("PATH"), "GATE_ATTEMPTS=" + attempts, "REAL_TIMEOUT=" + realTimeout}, env...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	started := time.Now()
	err = cmd.Run()
	run := gateRun{passed: strings.TrimSpace(stdout.String()) == "passed", stderr: stderr.String(), elapsed: time.Since(started)}
	if run.passed != (err == nil) {
		t.Fatalf("exit %v with stdout %q", err, stdout.String())
	}
	if raw, err := os.ReadFile(attempts); err == nil {
		run.attempts = strings.Count(string(raw), "\n")
	}
	return run
}

func listen(t *testing.T) (net.Listener, string, string) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = ln.Close() })
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			_ = conn.Close()
		}
	}()
	host, port, _ := net.SplitHostPort(ln.Addr().String())
	return ln, host, port
}

func closedTarget(t *testing.T) string {
	ln, _, _ := listen(t)
	addr := ln.Addr().String()
	_ = ln.Close()
	return addr
}

func TestPolicyGatePassesWhenDenied(t *testing.T) {
	run := runGate(t, "METORIAL_POLICY_GATE=enforce", "METORIAL_POLICY_GATE_TARGETS="+closedTarget(t))
	if !run.passed || run.stderr != "" || run.attempts != 1 {
		t.Fatalf("%+v", run)
	}
}

func TestPolicyGateFallsBackToTheAPIServer(t *testing.T) {
	_, host, port := listen(t)
	run := runGate(t, "KUBERNETES_SERVICE_HOST="+host, "KUBERNETES_SERVICE_PORT="+port, "METORIAL_POLICY_GATE_TIMEOUT_SECONDS=1")
	if run.passed || !strings.Contains(run.stderr, host+":"+port+" is reachable") {
		t.Fatalf("missing mode must enforce against the API server: %+v", run)
	}
}

func TestPolicyGateWaitsForThePolicy(t *testing.T) {
	ln, host, port := listen(t)
	time.AfterFunc(500*time.Millisecond, func() { _ = ln.Close() })
	run := runGate(t, "METORIAL_POLICY_GATE=enforce", "METORIAL_POLICY_GATE_TARGETS="+closedTarget(t)+","+host+":"+port)
	if !run.passed || run.attempts < 2 || run.elapsed < 500*time.Millisecond {
		t.Fatalf("%+v", run)
	}
}

func TestPolicyGateModes(t *testing.T) {
	_, host, port := listen(t)
	open := "METORIAL_POLICY_GATE_TARGETS=" + host + ":" + port

	if run := runGate(t, "METORIAL_POLICY_GATE=enforce", open, "METORIAL_POLICY_GATE_TIMEOUT_SECONDS=1"); run.passed || !strings.Contains(run.stderr, "not running the build") {
		t.Errorf("enforce: %+v", run)
	}
	if run := runGate(t, "METORIAL_POLICY_GATE=bogus", open, "METORIAL_POLICY_GATE_TIMEOUT_SECONDS=1"); run.passed {
		t.Errorf("unknown mode: %+v", run)
	}
	if run := runGate(t, "METORIAL_POLICY_GATE=warn", open, "METORIAL_POLICY_GATE_TIMEOUT_SECONDS=1"); !run.passed || !strings.Contains(run.stderr, "running the build anyway") {
		t.Errorf("warn: %+v", run)
	}
	if run := runGate(t, "METORIAL_POLICY_GATE=off", open); !run.passed || run.attempts != 0 {
		t.Errorf("off: %+v", run)
	}
	if run := runGate(t, "METORIAL_POLICY_GATE=enforce"); run.passed || !strings.Contains(run.stderr, "no targets") {
		t.Errorf("no targets: %+v", run)
	}
}

func TestPolicyGateRunsBeforeTheUserEnv(t *testing.T) {
	gate := strings.Index(launch, "metorial_policy_gate || exit 1")
	source := strings.Index(launch, ". "+BuildMountPath+"/"+SecretKeyEnv)
	if gate < 0 || source < gate {
		t.Fatalf("launch sources the user env before the gate:\n%s", launch)
	}

	req := testRequest()
	req.Env = map[string]string{"METORIAL_POLICY_GATE": "off", "METORIAL_POLICY_GATE_TARGETS": "10.0.0.1:1"}
	if issues := Validate(req); len(issues) != 2 || issues[0].Code != "reserved_name" || issues[1].Code != "reserved_name" {
		t.Fatalf("issues %+v", issues)
	}
}
