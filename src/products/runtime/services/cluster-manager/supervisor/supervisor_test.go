package supervisor

import (
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/policygate"
)

var validEnv = []string{
	"METORIAL_FUNCTION_ID=fn_1",
	"METORIAL_FUNCTION_VERSION_ID=fnv_1",
	"METORIAL_TENANT_ID=ten_1",
	"METORIAL_EXECUTION_ENV=knative",
	"METORIAL_RUNTIME=nodejs:24",
	`METORIAL_ENTRYPOINT={"path":"index.js","export":"handler","kind":"module"}`,
	"METORIAL_CONCURRENCY=exclusive",
	"METORIAL_TIMEOUT_SECONDS=30",
	"METORIAL_MEMORY_MB=512",
	"METORIAL_BUNDLE_SHA256=" + strings.Repeat("a", 64),
	"METORIAL_BUNDLE_SIZE_BYTES=1234",
	"CLUSTER_MANAGER_POD_ADDR=https://10.43.12.7:52241",
	"CLUSTER_MANAGER_POD_SERVER_NAME=cluster-manager.metorial",
	"EGRESS_GATEWAY_ADDR=10.43.9.1:8443",
	"PORT=8081",
	"KUBERNETES_SERVICE_HOST=10.43.0.1",
	"KUBERNETES_SERVICE_PORT=443",
}

func TestConfigFromEnv(t *testing.T) {
	cfg, err := ConfigFromEnv(validEnv)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Port != 8081 || cfg.Mode != ModeExclusive || cfg.Timeout != 30*time.Second || cfg.BundleSize != 1234 ||
		cfg.Entrypoint != (Entrypoint{Path: "index.js", Export: "handler", Kind: "module"}) || cfg.GatewayServerName != "" {
		t.Fatalf("unexpected config %+v", cfg)
	}

	for _, drop := range []string{"METORIAL_CONCURRENCY", "METORIAL_ENTRYPOINT", "METORIAL_BUNDLE_SHA256", "EGRESS_GATEWAY_ADDR", "METORIAL_TIMEOUT_SECONDS"} {
		env := slices.DeleteFunc(slices.Clone(validEnv), func(kv string) bool { return strings.HasPrefix(kv, drop+"=") })
		if _, err := ConfigFromEnv(env); err == nil || !strings.Contains(err.Error(), drop) {
			t.Errorf("without %s: err = %v", drop, err)
		}
	}
}

func TestWorkerEnvStripsReservedNames(t *testing.T) {
	cfg, err := ConfigFromEnv(append(slices.Clone(validEnv),
		"USER_VAR=1", "NODE_OPTIONS=--inspect", "NODE_PATH=/x", "NODE_EXTRA_CA_CERTS=/x", "LD_PRELOAD=/x",
		"EGRESS_GATEWAY_TOKEN=x", "CLUSTER_MANAGER_SECRET=x", "KUBERNETES_SERVICE_HOST=10.0.0.1",
	))
	if err != nil {
		t.Fatal(err)
	}

	env := workerEnv(cfg, "/tmp/s/tunnel.sock")
	for _, kv := range env {
		name, _, _ := strings.Cut(kv, "=")
		if strings.HasPrefix(name, "NODE_") || strings.HasPrefix(name, "LD_") || strings.HasPrefix(name, "EGRESS_") ||
			strings.HasPrefix(name, "CLUSTER_") || strings.HasPrefix(name, "KUBERNETES_") || name == "PORT" || name == "METORIAL_TENANT_ID" {
			t.Errorf("reserved variable %s reached the worker", name)
		}
	}
	for _, want := range []string{"USER_VAR=1", "METORIAL_SUPERVISOR_SOCKET=/tmp/s/tunnel.sock", "METORIAL_CONTROL_FD=3", "METORIAL_CONCURRENCY=exclusive"} {
		if !slices.Contains(env, want) {
			t.Errorf("worker env misses %s", want)
		}
	}
	if args := nodeArgs(cfg); args[0] != "--max-old-space-size=435" || args[len(args)-1] != DefaultBootstrapPath {
		t.Errorf("node args = %v", args)
	}
}

func TestLogBufferCap(t *testing.T) {
	buf := logBuffer{limit: 10}
	buf.add(LogLine{Line: "12345"})
	buf.add(LogLine{Line: "12345"})
	buf.add(LogLine{Line: "1"})
	buf.add(LogLine{Line: "after"})

	if !buf.truncated || len(buf.lines) != 3 || buf.lines[2].Line != truncationMarker || buf.lines[2].Stream != "stderr" {
		t.Fatalf("unexpected buffer %+v", buf)
	}
}

func TestPolicyGateConfig(t *testing.T) {
	cfg, err := ConfigFromEnv(validEnv)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.PolicyGate != policygate.ModeEnforce || !slices.Equal(cfg.PolicyGateTargets, []string{"10.43.0.1:443"}) || cfg.PolicyGateTimeout != policygate.DefaultTimeout {
		t.Fatalf("defaults: %q %v %s", cfg.PolicyGate, cfg.PolicyGateTargets, cfg.PolicyGateTimeout)
	}

	cfg, err = ConfigFromEnv(append(slices.Clone(validEnv), "METORIAL_POLICY_GATE=warn", "METORIAL_POLICY_GATE_TARGETS=10.43.12.7:52240,[fd00::1]:443", "METORIAL_POLICY_GATE_TIMEOUT_SECONDS=5"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.PolicyGate != policygate.ModeWarn || !slices.Equal(cfg.PolicyGateTargets, []string{"10.43.12.7:52240", "[fd00::1]:443"}) || cfg.PolicyGateTimeout != 5*time.Second {
		t.Fatalf("explicit: %q %v %s", cfg.PolicyGate, cfg.PolicyGateTargets, cfg.PolicyGateTimeout)
	}

	withoutAPIServer := slices.DeleteFunc(slices.Clone(validEnv), func(kv string) bool { return strings.HasPrefix(kv, "KUBERNETES_") })
	if _, err := ConfigFromEnv(withoutAPIServer); err == nil || !strings.Contains(err.Error(), "policy gate") {
		t.Fatalf("enforce without targets: %v", err)
	}
	if _, err := ConfigFromEnv(append(withoutAPIServer, "METORIAL_POLICY_GATE=off")); err != nil {
		t.Fatalf("off without targets: %v", err)
	}
	for _, bad := range []string{"METORIAL_POLICY_GATE=strict", "METORIAL_POLICY_GATE_TARGETS=kubernetes.default.svc:443"} {
		if _, err := ConfigFromEnv(append(slices.Clone(validEnv), bad)); err == nil {
			t.Errorf("%s accepted", bad)
		}
	}
}
