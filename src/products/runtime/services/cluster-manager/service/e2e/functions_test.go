package e2e

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd"

	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/functions"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/gc"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/kube"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/metrics"
)

func ensureInput(versionID, functionID string, ref *cm.BundleRef, mode cm.FunctionEnsureInputMode) *cm.FunctionEnsureInput {
	return &cm.FunctionEnsureInput{
		VersionID:      versionID,
		FunctionID:     functionID,
		TenantID:       "ten-e2e",
		Mode:           mode,
		Runtime:        cm.FunctionEnsureInputRuntime{Identifier: "nodejs", Version: "24"},
		Entrypoint:     cm.FunctionEnsureInputEntrypoint{Path: "index.js", Export: "handler", Kind: cm.FunctionEnsureInputEntrypointKindModule},
		Bundle:         *ref,
		Env:            map[string]string{"GREETING": "hi"},
		MemoryMB:       256,
		TimeoutSeconds: 30,
		Concurrency:    cm.FunctionEnsureInputConcurrencyExclusive,
	}
}

func invokeInput(versionID string) *cm.InvokeInput {
	return &cm.InvokeInput{
		VersionID:       versionID,
		PayloadJSON:     `{"hello":"world"}`,
		InvocationToken: "e2e-token",
		EgressGrant:     "e2e-grant",
		DeadlineMs:      20_000,
	}
}

func (e *env) importBundle(t *testing.T, versionID, message string) *cm.BundleRef {
	t.Helper()
	key := "e2e/" + e.runID + "/" + versionID + ".zip"
	e.put(t, key, makeZip(t, map[string]string{
		"message.txt": message,
		"index.js":    "export const handler = () => 1;\n",
		"lib/util.js": "export {};\n",
	}))
	ref, err := e.functions.BundleImport(context.Background(), &cm.BundleImportInput{VersionID: versionID, Source: cm.ObjectRef{Bucket: artifactBucket, Key: key}})
	if err != nil {
		t.Fatal(err)
	}
	return ref
}

func (e *env) versionPods(t *testing.T, versionID string) int {
	t.Helper()
	pods, err := e.kube.CoreV1().Pods(e.functionsNS).List(context.Background(), metav1.ListOptions{LabelSelector: kube.LabelVersionID + "=" + versionID})
	if err != nil {
		t.Fatal(err)
	}
	return len(pods.Items)
}

func TestFunctionLifecycle(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	functionID := "fn-" + e.runID
	verA, verB := e.runID+"-a", e.runID+"-b"

	var refA, refB *cm.BundleRef
	t.Run("bundle import is idempotent and validated", func(t *testing.T) {
		refA = e.importBundle(t, verA, "hello from A")
		again := e.importBundle(t, verA, "hello from A")
		if *again != *refA {
			t.Fatalf("import not idempotent: %+v vs %+v", again, refA)
		}
		if !strings.HasSuffix(refA.Key, ".tar.zst") || len(refA.SHA256) != 64 {
			t.Fatalf("unexpected ref %+v", refA)
		}
		refB = e.importBundle(t, verB, "hello from B")
		if refB.SHA256 == refA.SHA256 {
			t.Fatal("different bundles share a digest")
		}

		e.put(t, "e2e/"+e.runID+"/evil.zip", makeZip(t, map[string]string{"../evil.js": "x"}))
		_, err := e.functions.BundleImport(ctx, &cm.BundleImportInput{VersionID: e.runID + "-evil", Source: cm.ObjectRef{Bucket: artifactBucket, Key: "e2e/" + e.runID + "/evil.zip"}})
		expectError(t, err, 422, cm.CodeBundleInvalid)
	})

	var nameA string
	t.Run("on-demand ensure waits for Ready and is idempotent", func(t *testing.T) {
		bad := ensureInput(verA, functionID, refA, cm.FunctionEnsureInputModeOnDemand)
		bad.Env = map[string]string{"NODE_OPTIONS": "--inspect"}
		_, err := e.functions.FunctionEnsure(ctx, bad)
		expectError(t, err, 400, "invalid_data")

		start := time.Now()
		out, err := e.functions.FunctionEnsure(ctx, ensureInput(verA, functionID, refA, cm.FunctionEnsureInputModeOnDemand))
		if err != nil {
			t.Fatal(err)
		}
		if out.State != cm.FunctionEnsureOutputStateMaterialized || out.Name == nil {
			t.Fatalf("unexpected ensure result %+v", out)
		}
		nameA = *out.Name
		t.Logf("ensure on-demand took %s", time.Since(start))

		again, err := e.functions.FunctionEnsure(ctx, ensureInput(verA, functionID, refA, cm.FunctionEnsureInputModeOnDemand))
		if err != nil || *again.Name != nameA {
			t.Fatalf("second ensure: %+v %v", again, err)
		}

		secret, err := e.kube.CoreV1().Secrets(e.functionsNS).Get(ctx, nameA+"-env", metav1.GetOptions{})
		if err != nil {
			t.Fatal(err)
		}
		if len(secret.OwnerReferences) != 1 || secret.OwnerReferences[0].Kind != "Service" || secret.OwnerReferences[0].Name != nameA {
			t.Fatalf("env Secret not owned by the Knative Service: %+v", secret.OwnerReferences)
		}
		if string(secret.Data["GREETING"]) != "hi" {
			t.Fatalf("unexpected env Secret data %v", secret.Data)
		}
	})

	t.Run("invoke goes through Knative to the pod", func(t *testing.T) {
		out, err := e.functions.FunctionInvoke(ctx, invokeInput(verA))
		if err != nil {
			t.Fatal(err)
		}
		body := decodeInvoke(t, out)
		if body.StatusCode != 200 || body.Body.VersionID != verA || body.Body.BundleSha != refA.SHA256 || body.Body.Message != "hello from A" || body.Body.Payload.Hello != "world" {
			t.Fatalf("unexpected invoke result %s", out.Payload)
		}
		if len(out.Logs) != 1 {
			t.Fatalf("expected the supervisor's log lines, got %+v", out.Logs)
		}

		_, err = e.functions.FunctionInvoke(ctx, invokeInput(e.runID+"-missing"))
		expectError(t, err, 404, cm.CodeFunctionNotMaterialized)
	})

	t.Run("speculative ensure", func(t *testing.T) {
		out, err := e.functions.FunctionEnsure(ctx, ensureInput(e.runID+"-lonely", "fn-"+e.runID+"-other", refA, cm.FunctionEnsureInputModeSpeculative))
		if err != nil || out.State != cm.FunctionEnsureOutputStateDeclined {
			t.Fatalf("speculative ensure without an invoked sibling should be declined: %+v %v", out, err)
		}

		out, err = e.functions.FunctionEnsure(ctx, ensureInput(verB, functionID, refB, cm.FunctionEnsureInputModeSpeculative))
		if err != nil || out.State != cm.FunctionEnsureOutputStateMaterialized {
			t.Fatalf("speculative ensure of an invoked function's sibling: %+v %v", out, err)
		}
	})

	t.Run("pod-facing endpoints are scoped to the calling pod", func(t *testing.T) {
		podA := e.runningPod(t, e.functionsNS, kube.LabelVersionID+"="+verA)
		podB := e.runningPod(t, e.functionsNS, kube.LabelVersionID+"="+verB)
		tokenA := e.token(t, e.functionsNS, "function-runtime", podAudience, podA)
		tokenB := e.token(t, e.functionsNS, "function-runtime", podAudience, podB)

		for token, want := range map[string]string{tokenA: refA.SHA256, tokenB: refB.SHA256} {
			code, body := e.podGet(t, "/v1/bundles/self", token)
			sum := sha256.Sum256(body)
			if code != 200 || hex.EncodeToString(sum[:]) != want {
				t.Fatalf("bundle/self returned %d with digest %x, want %s", code, sum, want)
			}
		}

		if code, _ := e.podGet(t, "/v1/builds/self/artifacts/source", tokenA); code != 403 && code != 404 {
			t.Fatalf("function pod reached the build artifact endpoint: %d", code)
		}
		if code, _ := e.podGet(t, "/v1/bundles/self", e.token(t, e.functionsNS, "function-runtime", podAudience, nil)); code == 200 {
			t.Fatal("a token not bound to a pod was served a bundle")
		}
		if code, _ := e.podGet(t, "/v1/bundles/self", e.token(t, e.functionsNS, "function-runtime", controlAudience, podA)); code != 401 {
			t.Fatalf("a control-audience token on the pod port: %d", code)
		}
		if code, _ := e.podGet(t, "/v1/bundles/self", ""); code != 401 {
			t.Fatalf("anonymous bundle request: %d", code)
		}
		_, err := e.client(t, tokenA).FunctionList(ctx, &cm.FunctionListInput{FunctionID: functionID})
		expectError(t, err, 401, "")
		_, err = e.client(t, e.token(t, e.functionsNS, "function-runtime", controlAudience, podA)).FunctionList(ctx, &cm.FunctionListInput{FunctionID: functionID})
		expectError(t, err, 403, "")
	})

	t.Run("list", func(t *testing.T) {
		out, err := e.functions.FunctionList(ctx, &cm.FunctionListInput{FunctionID: functionID})
		if err != nil {
			t.Fatal(err)
		}
		reasons := map[string]cm.MaterializedFunctionReason{}
		for _, item := range out.Items {
			reasons[item.VersionID] = item.Reason
		}
		if reasons[verA] != cm.MaterializedFunctionReasonOnDemand || reasons[verB] != cm.MaterializedFunctionReasonSpeculative || len(reasons) != 2 {
			t.Fatalf("unexpected list %+v", out.Items)
		}
	})

	t.Run("scale to zero and cold invoke", func(t *testing.T) {
		start := time.Now()
		eventually(t, 4*time.Minute, verA+" to scale to zero", func() (bool, error) {
			return e.versionPods(t, verA) == 0, nil
		})
		t.Logf("scaled to zero after %s", time.Since(start))

		start = time.Now()
		out, err := e.functions.FunctionInvoke(ctx, invokeInput(verA))
		if err != nil {
			t.Fatal(err)
		}
		if body := decodeInvoke(t, out); body.Body.BundleSha != refA.SHA256 {
			t.Fatalf("unexpected cold invoke result %s", out.Payload)
		}
		t.Logf("cold invoke took %s", time.Since(start))
	})

	t.Run("delete", func(t *testing.T) {
		if _, err := e.functions.FunctionDelete(ctx, &cm.FunctionDeleteInput{VersionID: verB}); err != nil {
			t.Fatal(err)
		}
		if _, err := e.functions.FunctionDelete(ctx, &cm.FunctionDeleteInput{VersionID: verB}); err != nil {
			t.Fatalf("delete is not idempotent: %v", err)
		}
		_, err := e.functions.FunctionInvoke(ctx, invokeInput(verB))
		expectError(t, err, 404, cm.CodeFunctionNotMaterialized)
	})

	t.Run("gc evicts idle versions", func(t *testing.T) {
		collector := e.collector(t, time.Now().Add(7*time.Hour))
		evicted, err := collector.RunOnce(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if len(evicted) != 1 || evicted[0].Candidate.VersionID != verA || evicted[0].Reason != gc.ReasonIdleTTL {
			t.Fatalf("unexpected evictions %+v", evicted)
		}
		eventually(t, time.Minute, "the env Secret to be garbage collected", func() (bool, error) {
			_, err := e.kube.CoreV1().Secrets(e.functionsNS).Get(ctx, nameA+"-env", metav1.GetOptions{})
			return ignoreNotFound(err) == nil && err != nil, err
		})
		out, err := e.functions.FunctionList(ctx, &cm.FunctionListInput{FunctionID: functionID})
		if err != nil || len(out.Items) != 0 {
			t.Fatalf("functions left after GC: %+v %v", out, err)
		}
	})
}

type scopedTarget struct {
	*functions.Manager
	prefix string
}

func (s scopedTarget) Candidates() ([]gc.Candidate, error) {
	all, err := s.Manager.Candidates()
	var mine []gc.Candidate
	for _, c := range all {
		if strings.HasPrefix(c.VersionID, s.prefix) {
			mine = append(mine, c)
		}
	}
	return mine, err
}

// collector runs the real GC against the cluster with a shifted clock, limited to this run's
// versions so other users of the namespace are never touched.
func (e *env) collector(t *testing.T, now time.Time) *gc.Collector {
	t.Helper()
	loading := clientcmd.NewDefaultClientConfigLoadingRules()
	cfg, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loading, &clientcmd.ConfigOverrides{CurrentContext: getenv("E2E_KUBE_CONTEXT", "orbstack")}).ClientConfig()
	if err != nil {
		t.Fatal(err)
	}
	cluster, err := kube.NewCluster(cfg)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	cache := kube.NewCache(cluster, cluster, e.functionsNS, e.buildsNS)
	if err := cache.Start(ctx); err != nil {
		t.Fatal(err)
	}

	clock := func() time.Time { return now }
	manager := functions.NewManager(functions.Options{
		Render:          functions.RenderOptions{Namespace: e.functionsNS},
		RuntimeClass:    func(string) (string, error) { return "", nil },
		MaxMaterialized: 1000,
		FlushInterval:   time.Minute,
	}, cluster, cache, functions.NewRPCInvoker(nil), metrics.New(), quiet(), clock)

	return &gc.Collector{
		Target: scopedTarget{Manager: manager, prefix: e.runID},
		Policy: gc.Policy{SpeculativeTTL: time.Hour, IdleTTL: 6 * time.Hour, MaxMaterialized: 1000, ProtectWindow: 5 * time.Minute},
		Log:    quiet(),
		Now:    clock,
	}
}
