package builds

import (
	"encoding/json"
	"flag"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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

func testOptions() *RenderOptions {
	return &RenderOptions{
		Namespace:         "metorial-runtime-builds",
		Image:             "registry.example.com/build-ubuntu@sha256:0000",
		ServiceAccount:    "build-runtime",
		PodAudience:       "runtime-cluster-manager-pod",
		CAConfigMap:       "runtime-ca",
		UserNamespaces:    true,
		CPU:               resource.MustParse("2"),
		Memory:            resource.MustParse("4Gi"),
		EphemeralStorage:  resource.MustParse("10Gi"),
		WorkspaceSize:     resource.MustParse("8Gi"),
		TTLAfterFinished:  3600,
		PodClusterManager: "https://10.43.0.20:52241",
		PodCMServerName:   "runtime-cluster-manager-pod.metorial.svc",
		EgressProxyAddr:   "egress-proxy.metorial.svc:3128",
		PolicyGate:        kube.PolicyGate{Mode: "enforce", TimeoutSeconds: 30},
	}
}

func testRequest() *StartRequest {
	return &StartRequest{
		RunID:          "brun_01HZY3K8Q2W7",
		Image:          "build-ubuntu",
		Script:         "set -e\nnpm ci\nnpm run build\n",
		Env:            map[string]string{"NODE_ENV": "production", "QUOTED": "it's $HOME"},
		Downloads:      []Download{{ArtifactID: "source", Bucket: "artifacts", Key: "src.zip"}},
		Uploads:        []Upload{{StepID: "bundle", Bucket: "artifacts", Key: "out.zip"}},
		TimeoutSeconds: 1200,
		Sandbox:        "gvisor",
		EgressGrant:    "grant-token",
	}
}

func TestRenderJobGolden(t *testing.T) {
	golden(t, "job-gvisor.yaml", RenderJob(testOptions(), testRequest(), "gvisor"))
}

func TestRenderJobWithoutProxyOrUserNamespaces(t *testing.T) {
	opts := testOptions()
	opts.EgressProxyAddr = ""
	opts.UserNamespaces = false
	job := RenderJob(opts, testRequest(), "")

	spec := job.Spec.Template.Spec
	if spec.HostUsers != nil || spec.RuntimeClassName != nil {
		t.Fatal("hostUsers and runtimeClassName must be unset")
	}
	for _, env := range spec.Containers[0].Env {
		if strings.Contains(strings.ToLower(env.Name), "proxy") {
			t.Fatalf("unexpected proxy env %s", env.Name)
		}
	}
}

func TestRenderSecretKeepsSpecUnmounted(t *testing.T) {
	opts, req := testOptions(), testRequest()
	secret, err := RenderSecret(opts, req)
	if err != nil {
		t.Fatal(err)
	}

	var spec BuildSpec
	if err := json.Unmarshal(secret.Data[SecretKeySpec], &spec); err != nil {
		t.Fatal(err)
	}
	if d, ok := spec.Download("source"); !ok || d.Key != "src.zip" {
		t.Fatalf("download missing from spec: %+v", spec)
	}
	if string(secret.Data[SecretKeyProxyURL]) != "http://grant-token:x@egress-proxy.metorial.svc:3128" {
		t.Fatalf("unexpected proxy url %q", secret.Data[SecretKeyProxyURL])
	}

	job := RenderJob(opts, req, "")
	for _, v := range job.Spec.Template.Spec.Volumes {
		if v.Secret == nil {
			continue
		}
		for _, item := range v.Secret.Items {
			if item.Key == SecretKeySpec || item.Key == SecretKeyProxyURL {
				t.Fatalf("%s must not be mounted", item.Key)
			}
		}
	}
}

func TestValidateBuild(t *testing.T) {
	req := testRequest()
	if issues := Validate(req); len(issues) != 0 {
		t.Fatalf("unexpected issues %v", issues)
	}

	req.RunID = "has spaces"
	req.Env = map[string]string{"HTTPS_PROXY": "x", "https_proxy": "x", "METORIAL_BUILD_RUN_ID": "x", "CLUSTER_MANAGER_POD_ADDR": "x", "METORIAL_FUNCTION_BAY_BUILD_LAYER": "x", "my-var": "x", "OK": "x"}
	req.Downloads = append(req.Downloads, req.Downloads[0])
	req.Uploads = append(req.Uploads, req.Uploads[0])

	codes := map[string]string{}
	for _, issue := range Validate(req) {
		codes[strings.Join(issue.Path, ".")] = issue.Code
	}
	want := map[string]string{
		"runId":                        "invalid_identifier",
		"env.HTTPS_PROXY":              "reserved_name",
		"env.https_proxy":              "reserved_name",
		"env.METORIAL_BUILD_RUN_ID":    "reserved_name",
		"env.CLUSTER_MANAGER_POD_ADDR": "reserved_name",
		"env.my-var":                   "invalid_name",
		"downloads.1.artifactId":       "duplicate",
		"uploads.1.stepId":             "duplicate",
	}
	for path, code := range want {
		if codes[path] != code {
			t.Errorf("%s: got %q, want %q", path, codes[path], code)
		}
	}
	if len(codes) != len(want) {
		t.Errorf("unexpected issues %v", codes)
	}
}

func TestRenderEnvFileIsInertWhenSourced(t *testing.T) {
	bash, err := exec.LookPath("bash")
	if err != nil {
		t.Skip("bash not available")
	}
	env := map[string]string{
		"A": "it's",
		"B": "$(touch /tmp/should-not-exist) `id` $HOME",
		"C": "line1\nline2",
		"D": "",
	}
	file := filepath.Join(t.TempDir(), "env")
	if err := os.WriteFile(file, []byte(RenderEnvFile(env)), 0o600); err != nil {
		t.Fatal(err)
	}

	out, err := exec.Command(bash, "-c", `set -a; . "$1"; set +a; printf '%s\0' "$A" "$B" "$C" "$D"`, "_", file).Output()
	if err != nil {
		t.Fatal(err)
	}
	got := strings.Split(strings.TrimSuffix(string(out), "\x00"), "\x00")
	for i, key := range []string{"A", "B", "C", "D"} {
		if got[i] != env[key] {
			t.Errorf("%s: got %q, want %q", key, got[i], env[key])
		}
	}
}
