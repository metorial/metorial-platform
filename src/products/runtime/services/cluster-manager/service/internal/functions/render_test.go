package functions

import (
	"flag"
	"os"
	"path/filepath"
	"testing"

	"k8s.io/apimachinery/pkg/api/resource"
	"sigs.k8s.io/yaml"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/kube"
)

var update = flag.Bool("update", false, "rewrite golden files")

func golden(t *testing.T, name string, obj any) {
	t.Helper()

	got, err := yaml.Marshal(obj)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join("testdata", name)
	if *update {
		if err := os.MkdirAll("testdata", 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, got, 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("%v (run with -update to create)", err)
	}
	if string(got) != string(want) {
		t.Errorf("%s differs from golden file (run with -update to accept):\n%s", name, got)
	}
}

func testRenderOptions() *RenderOptions {
	return &RenderOptions{
		Namespace:         "metorial-runtime-functions",
		Image:             "registry.example.com/function-runtime-node24@sha256:0000",
		ServiceAccount:    "function-runtime",
		PodAudience:       "runtime-cluster-manager-pod",
		TrustConfigMap:    "runtime-trust",
		CAConfigMap:       "runtime-ca",
		SharedConcurrency: 25,
		MaxScale:          20,
		ScaleDownDelay:    "0s",
		BootAllowanceSecs: 60,
		CPUMillisPerGB:    500,
		EphemeralStorage:  resource.MustParse("2Gi"),
		TmpSize:           resource.MustParse("512Mi"),
		BundleVolumeSize:  resource.MustParse("1Gi"),
		PodClusterManager: "https://10.43.0.20:52241",
		PodCMServerName:   "runtime-cluster-manager-pod.metorial.svc",
		EgressGatewayAddr: "10.43.0.30:443",
		EgressServerName:  "egress-gateway.metorial.svc",
		PolicyGate:        kube.PolicyGate{Mode: "enforce", TimeoutSeconds: 30},
	}
}

func testSpec() *Spec {
	return &Spec{
		VersionID:      "fver_01HZY3K8Q2W7",
		FunctionID:     "fn_01HZY3K8Q2W6",
		TenantID:       "ten_01HZY3K8Q2W5",
		RuntimeID:      "nodejs",
		RuntimeVersion: "24",
		Entrypoint:     Entrypoint{Path: "dist/index.js", Export: "handler", Kind: "module"},
		Bundle: BundleRef{
			Bucket:    "function-bay-bundles",
			Key:       "runtime/bundles/abc.tar.zst",
			SHA256:    "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
			SizeBytes: 123456,
		},
		Env:            map[string]string{"API_KEY": "secret", "LOG_LEVEL": "debug"},
		MemoryMB:       1024,
		TimeoutSeconds: 300,
		Concurrency:    ConcurrencyExclusive,
		Sandbox:        "runc",
	}
}

func TestRenderServiceOnDemand(t *testing.T) {
	svc, err := RenderService(testRenderOptions(), testSpec(), "", 1, ModeOnDemand)
	if err != nil {
		t.Fatal(err)
	}
	obj, err := svc.ToUnstructured()
	if err != nil {
		t.Fatal(err)
	}
	golden(t, "ksvc-on-demand.yaml", obj.Object)
}

func TestRenderServiceSpeculativeSharedGVisor(t *testing.T) {
	opts := testRenderOptions()
	opts.AutoscalingWindow = "30s"
	opts.PolicyGate = kube.PolicyGate{Mode: "warn", TimeoutSeconds: 10, Targets: "10.43.0.9:52240"}
	spec := testSpec()
	spec.Concurrency = ConcurrencyShared
	spec.MemoryMB = 128
	spec.Sandbox = "gvisor"

	svc, err := RenderService(opts, spec, "gvisor", 3, ModeSpeculative)
	if err != nil {
		t.Fatal(err)
	}
	obj, err := svc.ToUnstructured()
	if err != nil {
		t.Fatal(err)
	}
	golden(t, "ksvc-speculative-shared-gvisor.yaml", obj.Object)
}

func TestRenderEnvSecretHoldsOnlyUserEnv(t *testing.T) {
	spec := testSpec()
	spec.Env["KUBERNETES_SERVICE_HOST"] = "10.99.0.1"
	secret := RenderEnvSecret(testRenderOptions(), spec)
	if len(secret.Data) != 2 || string(secret.Data["API_KEY"]) != "secret" {
		t.Fatalf("unexpected data: %v", secret.Data)
	}
	if secret.Name != kube.FunctionName(spec.VersionID)+"-env" {
		t.Fatalf("unexpected name %s", secret.Name)
	}
}

func TestValidateEnvReserved(t *testing.T) {
	cases := map[string]string{
		"NODE_OPTIONS":               "reserved_name",
		"NODE_PATH":                  "reserved_name",
		"NODE_EXTRA_CA_CERTS":        "reserved_name",
		"LD_PRELOAD":                 "reserved_name",
		"METORIAL_FUNCTION_ID":       "reserved_name",
		"CLUSTER_MANAGER_POD_ADDR":   "reserved_name",
		"EGRESS_GATEWAY_SERVER_NAME": "reserved_name",
		"1BAD":                       "invalid_name",
		"WITH SPACE":                 "invalid_name",
		"":                           "invalid_name",
		"API_KEY":                    "",
		"my.dotted-name":             "",
		"NODE_ENV":                   "",
	}
	for name, want := range cases {
		issues := ValidateEnv(map[string]string{name: "x"})
		got := ""
		if len(issues) > 0 {
			got = issues[0].Code
			if len(issues[0].Path) != 2 || issues[0].Path[0] != "env" || issues[0].Path[1] != name {
				t.Errorf("%q: unexpected path %v", name, issues[0].Path)
			}
		}
		if got != want {
			t.Errorf("%q: got %q, want %q", name, got, want)
		}
	}
}

func TestValidateLabels(t *testing.T) {
	spec := testSpec()
	if issues := ValidateLabels(spec); len(issues) != 0 {
		t.Fatalf("unexpected issues: %v", issues)
	}
	spec.TenantID = "not a label/value"
	if issues := ValidateLabels(spec); len(issues) == 0 || issues[0].Path[0] != "tenantId" {
		t.Fatalf("expected a tenantId issue, got %v", issues)
	}
}
