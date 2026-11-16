package config

import (
	"strings"
	"testing"
	"time"
)

func TestPolicyGate(t *testing.T) {
	t.Setenv("CLUSTER_MANAGER_FUNCTION_IMAGE_NODE24", "fn")
	t.Setenv("CLUSTER_MANAGER_BUILD_IMAGE_UBUNTU", "build")
	t.Setenv("OBJECT_STORAGE_URL", "http://object-storage")
	t.Setenv("CLUSTER_MANAGER_POD_ADDR", "https://10.43.0.20:52241")

	cases := []struct {
		name        string
		env         map[string]string
		wantMode    PreflightMode
		wantTargets string
	}{
		{"follows enforcing preflight", map[string]string{}, PreflightEnforce, ""},
		{"follows warning preflight", map[string]string{"CLUSTER_MANAGER_PREFLIGHT": "warn"}, PreflightWarn, ""},
		{"off without the policy probe", map[string]string{"CLUSTER_MANAGER_PREFLIGHT_NETWORK_POLICY_PROBE": "false"}, PreflightOff, ""},
		{"explicit wins", map[string]string{"CLUSTER_MANAGER_PREFLIGHT": "off", "CLUSTER_MANAGER_POLICY_GATE": "enforce"}, PreflightEnforce, ""},
		{"ip probe target carries over", map[string]string{"CLUSTER_MANAGER_PREFLIGHT_PROBE_TARGET": "10.43.0.9:52240"}, PreflightEnforce, "10.43.0.9:52240"},
		{"hostname probe target doesn't", map[string]string{"CLUSTER_MANAGER_PREFLIGHT_PROBE_TARGET": "probe.example:443"}, PreflightEnforce, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for k, v := range tc.env {
				t.Setenv(k, v)
			}
			c, err := Load()
			if err != nil {
				t.Fatal(err)
			}
			if c.PolicyGate != tc.wantMode || c.PolicyGateTargets != tc.wantTargets || c.PolicyGateTimeout != 30*time.Second {
				t.Fatalf("got %q %q %s", c.PolicyGate, c.PolicyGateTargets, c.PolicyGateTimeout)
			}
		})
	}

	t.Setenv("CLUSTER_MANAGER_POLICY_GATE", "strict")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "CLUSTER_MANAGER_POLICY_GATE") {
		t.Fatalf("unknown mode: %v", err)
	}
}
