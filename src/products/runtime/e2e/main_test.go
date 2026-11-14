// Package e2e runs the real runtime end to end: the cluster-manager, the function-node24 and
// build-ubuntu images (supervisor and Node bootstrap), the egress gateway and the network log
// store, deployed by services/cluster-manager/deploy/dev-real. It only runs with RUNTIME_E2E=1.
//
//	RUNTIME_E2E=1 go test ./e2e/ -count=1 -v -timeout 30m
//
// RUNTIME_E2E_STRICT_NETWORK_POLICY=1 additionally requires that NetworkPolicy blocks egress to the
// internet and the API server. Without it those checks only log, since not every CNI enforces
// egress policy (OrbStack does, but only a few hundred milliseconds after a pod starts).
// TestForgeKnativeBuild renders forge's build script with bun and skips without it.
package e2e

import (
	"archive/zip"
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	authenticationv1 "k8s.io/api/authentication/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	objectstorage "github.com/metorial/object-storage/clients/go"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
	logs "github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/rpc/networklogsrpc"
)

const (
	controlAudience = "metorial-cluster-manager"
	podAudience     = "metorial-cluster-manager-pods"
	logsAudience    = "metorial-network-logs"
	artifactBucket  = "artifacts"
	tenantID        = "ten-runtime-e2e"
	devKeySeedLabel = "metorial-runtime-dev-e2e-signing-key"
	versionLabel    = "runtime.metorial.com/version-id"
)

type env struct {
	kube        *kubernetes.Clientset
	platformNS  string
	functionsNS string
	buildsNS    string
	runID       string
	strictNP    bool

	key   *egress.SigningKey
	store *objectstorage.Client

	functions *cm.Client
	builds    *cm.Client
	logs      *logs.Client

	clusterManagerIP  string
	clusterManagerPod string
	gatewayIP         string
	apiServerIP       string
	kourierIP         string
}

func getenv(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

func setup(t *testing.T) *env {
	t.Helper()
	if os.Getenv("RUNTIME_E2E") != "1" {
		t.Skip("set RUNTIME_E2E=1 to run against a cluster with services/cluster-manager/deploy/dev-real applied")
	}

	loading := clientcmd.NewDefaultClientConfigLoadingRules()
	overrides := &clientcmd.ConfigOverrides{CurrentContext: getenv("E2E_KUBE_CONTEXT", "orbstack")}
	cfg, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loading, overrides).ClientConfig()
	if err != nil {
		t.Fatal(err)
	}
	clientset, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		t.Fatal(err)
	}

	seed := sha256.Sum256([]byte(devKeySeedLabel))
	key, err := egress.NewSigningKey(seed[:], "")
	if err != nil {
		t.Fatal(err)
	}

	e := &env{
		kube:        clientset,
		platformNS:  getenv("E2E_PLATFORM_NAMESPACE", "metorial-runtime-dev"),
		functionsNS: getenv("E2E_FUNCTIONS_NAMESPACE", "metorial-runtime-functions"),
		buildsNS:    getenv("E2E_BUILDS_NAMESPACE", "metorial-runtime-builds"),
		runID:       fmt.Sprintf("rt%d", time.Now().Unix()),
		strictNP:    os.Getenv("RUNTIME_E2E_STRICT_NETWORK_POLICY") == "1",
		key:         key,
	}

	ctx := context.Background()
	e.requireTrust(t, ctx)

	e.clusterManagerIP = e.serviceIP(t, e.platformNS, "runtime-cluster-manager")
	e.gatewayIP = e.serviceIP(t, e.platformNS, "runtime-egress-gateway")
	e.apiServerIP = e.serviceIP(t, "default", "kubernetes")
	e.kourierIP = e.serviceIP(t, "kourier-system", "kourier-internal")

	pods, err := clientset.CoreV1().Pods(e.platformNS).List(ctx, metav1.ListOptions{LabelSelector: "app=runtime-cluster-manager"})
	if err != nil || len(pods.Items) == 0 {
		t.Fatalf("no cluster-manager pods: %v", err)
	}
	e.clusterManagerPod = pods.Items[0].Status.PodIP

	e.store = objectstorage.NewClient("http://" + e.serviceIP(t, e.platformNS, "object-storage") + ":8080")
	if _, err := e.store.UpsertBucket(artifactBucket); err != nil {
		t.Fatal(err)
	}

	controlURL := "http://" + e.clusterManagerIP + ":52240/rpc"
	e.functions = newCMClient(t, controlURL, e.token(t, e.platformNS, "metorial-functions", controlAudience))
	e.builds = newCMClient(t, controlURL, e.token(t, e.platformNS, "metorial-build", controlAudience))

	logsHeader := http.Header{"Authorization": {"Bearer " + e.token(t, e.platformNS, "metorial-functions", logsAudience)}}
	e.logs, err = logs.NewClient("http://"+e.serviceIP(t, e.platformNS, "runtime-network-logs")+":52250/rpc", ldrpc.ClientOptions{Header: logsHeader, DisableRetry: true})
	if err != nil {
		t.Fatal(err)
	}
	return e
}

func (e *env) requireTrust(t *testing.T, ctx context.Context) {
	t.Helper()
	for _, ref := range [][2]string{{e.functionsNS, "runtime-trust"}, {e.platformNS, "egress-trust"}} {
		configMap, err := e.kube.CoreV1().ConfigMaps(ref[0]).Get(ctx, ref[1], metav1.GetOptions{})
		if err != nil {
			t.Fatalf("%s/%s: %v", ref[0], ref[1], err)
		}
		keys, err := egress.ParseKeySet([]byte(configMap.Data["keys.json"]))
		if err != nil {
			t.Fatalf("%s/%s: %v", ref[0], ref[1], err)
		}
		if pub, ok := keys.PublicKey(e.key.KeyID); !ok || !pub.Equal(e.key.PublicKey()) {
			t.Fatalf("%s/%s doesn't trust the dev key %s; apply deploy/dev-real", ref[0], ref[1], e.key.KeyID)
		}
	}
}

func (e *env) serviceIP(t *testing.T, namespace, name string) string {
	t.Helper()
	svc, err := e.kube.CoreV1().Services(namespace).Get(context.Background(), name, metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	return svc.Spec.ClusterIP
}

func (e *env) token(t *testing.T, namespace, serviceAccount, audience string) string {
	t.Helper()
	spec := authenticationv1.TokenRequestSpec{Audiences: []string{audience}, ExpirationSeconds: ptr.To(int64(3600))}
	res, err := e.kube.CoreV1().ServiceAccounts(namespace).CreateToken(context.Background(), serviceAccount, &authenticationv1.TokenRequest{Spec: spec}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("mint token for %s/%s: %v", namespace, serviceAccount, err)
	}
	return res.Status.Token
}

func newCMClient(t *testing.T, url, token string) *cm.Client {
	t.Helper()
	client, err := cm.NewClient(url, ldrpc.ClientOptions{
		Header:       http.Header{"Authorization": {"Bearer " + token}},
		DisableRetry: true,
		Timeout:      4 * time.Minute,
	})
	if err != nil {
		t.Fatal(err)
	}
	return client
}

func randomID(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + hex.EncodeToString(b)
}

func randomKey(t *testing.T) *egress.SigningKey {
	t.Helper()
	_, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	key, err := egress.NewSigningKey(private.Seed(), "")
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func rpcCode(err error) (int, string) {
	if err == nil {
		return 200, ""
	}
	if rpcErr, ok := ldrpc.AsError(err); ok {
		return rpcErr.Status, rpcErr.Code
	}
	return -1, err.Error()
}

func expectCode(t *testing.T, err error, wantCode string) {
	t.Helper()
	if status, code := rpcCode(err); code != wantCode {
		t.Fatalf("expected %s, got %d %s (%v)", wantCode, status, code, err)
	}
}

func eventually(t *testing.T, timeout time.Duration, what string, check func() (bool, error)) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		ok, err := check()
		if ok {
			return
		}
		lastErr = err
		time.Sleep(time.Second)
	}
	t.Fatalf("timed out waiting for %s (last error: %v)", what, lastErr)
}

func makeZip(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, body := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		_, _ = io.WriteString(w, body)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func (e *env) put(t *testing.T, key string, data []byte) {
	t.Helper()
	if _, err := e.store.PutObject(artifactBucket, key, data, nil, nil); err != nil {
		t.Fatal(err)
	}
}

type function struct {
	versionID  string
	functionID string
	name       string
	timeout    time.Duration
}

type deployOptions struct {
	files       map[string]string
	zip         []byte
	entrypoint  cm.FunctionEnsureInputEntrypoint
	concurrency cm.FunctionEnsureInputConcurrency
	timeout     int64
	env         map[string]string
}

func (e *env) deploy(t *testing.T, label string, opts deployOptions) *function {
	t.Helper()
	ctx := context.Background()
	versionID := e.runID + "-" + label
	if opts.entrypoint.Path == "" {
		opts.entrypoint = cm.FunctionEnsureInputEntrypoint{Path: "index.js", Export: "handler", Kind: cm.FunctionEnsureInputEntrypointKindModule}
	}
	if opts.concurrency == "" {
		opts.concurrency = cm.FunctionEnsureInputConcurrencyExclusive
	}
	if opts.timeout == 0 {
		opts.timeout = 30
	}
	if opts.env == nil {
		opts.env = map[string]string{}
	}

	key := "runtime-e2e/" + e.runID + "/" + label + ".zip"
	if opts.zip == nil {
		opts.zip = makeZip(t, opts.files)
	}
	e.put(t, key, opts.zip)
	ref, err := e.functions.BundleImport(ctx, &cm.BundleImportInput{VersionID: versionID, Source: cm.ObjectRef{Bucket: artifactBucket, Key: key}})
	if err != nil {
		t.Fatalf("bundle:import %s: %v", label, err)
	}

	start := time.Now()
	out, err := e.functions.FunctionEnsure(ctx, &cm.FunctionEnsureInput{
		VersionID:      versionID,
		FunctionID:     "fn-" + versionID,
		TenantID:       tenantID,
		Mode:           cm.FunctionEnsureInputModeOnDemand,
		Runtime:        cm.FunctionEnsureInputRuntime{Identifier: "nodejs", Version: "24"},
		Entrypoint:     opts.entrypoint,
		Bundle:         *ref,
		Env:            opts.env,
		MemoryMB:       256,
		TimeoutSeconds: opts.timeout,
		Concurrency:    opts.concurrency,
	})
	if err != nil {
		t.Fatalf("function:ensure %s: %v", label, err)
	}
	if out.State != cm.FunctionEnsureOutputStateMaterialized || out.Name == nil {
		t.Fatalf("function:ensure %s: unexpected %+v", label, out)
	}
	t.Logf("%s materialized as %s in %s", label, *out.Name, time.Since(start).Round(time.Millisecond))

	t.Cleanup(func() {
		if os.Getenv("RUNTIME_E2E_KEEP") == "1" {
			return
		}
		if _, err := e.functions.FunctionDelete(context.Background(), &cm.FunctionDeleteInput{VersionID: versionID}); err != nil {
			t.Logf("delete %s: %v", versionID, err)
		}
	})
	return &function{versionID: versionID, functionID: "fn-" + versionID, name: *out.Name, timeout: time.Duration(opts.timeout) * time.Second}
}

type invocation struct {
	payload string

	id             string
	tokenVersionID string
	grantVersionID string
	grantID        string
	payloadSHA256  string
	tokenKey       *egress.SigningKey
	grantKey       *egress.SigningKey
	issuedAt       time.Time
	tokenExpiresAt time.Time
	allowAll       bool
	policy         *policy.Policy
	deadline       time.Duration
	reuseToken     string
	reuseGrant     string
}

type invokeOption func(*invocation)

func withPolicy(p *policy.Policy) invokeOption { return func(i *invocation) { i.policy = p } }

func withAllowAll() invokeOption { return func(i *invocation) { i.allowAll = true } }

func (e *env) mint(t *testing.T, f *function, inv *invocation) (string, string) {
	t.Helper()
	grant, err := egress.MintGrant(inv.grantKey, egress.Grant{
		Issuer:              "function-bay",
		ID:                  inv.grantID,
		TenantID:            tenantID,
		FunctionID:          f.functionID,
		EffectiveFunctionID: f.functionID,
		FunctionVersionID:   inv.grantVersionID,
		Source:              egress.SourceKnative,
		Policy:              inv.policy,
		AllowAll:            inv.allowAll,
		IssuedAt:            inv.issuedAt.Unix(),
		NotBefore:           inv.issuedAt.Unix(),
		ExpiresAt:           inv.issuedAt.Add(f.timeout + 60*time.Second).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	token, err := egress.MintInvocationToken(inv.tokenKey, egress.InvocationToken{
		Issuer:            "function-bay",
		ID:                inv.id,
		FunctionVersionID: inv.tokenVersionID,
		PayloadSHA256:     inv.payloadSHA256,
		IssuedAt:          inv.issuedAt.Unix(),
		ExpiresAt:         inv.tokenExpiresAt.Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	return token, grant
}

func (e *env) newInvocation(f *function, payload any, opts ...invokeOption) *invocation {
	raw, ok := payload.(string)
	if !ok {
		b, _ := json.Marshal(payload)
		raw = string(b)
	}
	id := randomID("inv_")
	now := time.Now()
	inv := &invocation{
		payload:        raw,
		id:             id,
		grantID:        id,
		tokenVersionID: f.versionID,
		grantVersionID: f.versionID,
		payloadSHA256:  egress.PayloadSHA256(raw),
		tokenKey:       e.key,
		grantKey:       e.key,
		issuedAt:       now,
		tokenExpiresAt: now.Add(f.timeout + 30*time.Second),
		deadline:       f.timeout,
	}
	for _, opt := range opts {
		opt(inv)
	}
	return inv
}

func (e *env) invokeWith(t *testing.T, f *function, inv *invocation) (*cm.InvokeOutput, error) {
	t.Helper()
	token, grant := e.mint(t, f, inv)
	if inv.reuseToken != "" {
		token, grant = inv.reuseToken, inv.reuseGrant
	}
	return e.functions.FunctionInvoke(context.Background(), &cm.InvokeInput{
		VersionID:       f.versionID,
		PayloadJSON:     inv.payload,
		InvocationToken: token,
		EgressGrant:     grant,
		DeadlineMs:      inv.deadline.Milliseconds(),
	})
}

func (e *env) invoke(t *testing.T, f *function, payload any, opts ...invokeOption) *cm.InvokeOutput {
	t.Helper()
	out, err := e.invokeWith(t, f, e.newInvocation(f, payload, opts...))
	if err != nil {
		t.Fatalf("invoke %s: %v", f.versionID, err)
	}
	return out
}

type envelope struct {
	StatusCode int `json:"statusCode"`
	Body       struct {
		Result json.RawMessage `json:"result"`
		Error  *struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	} `json:"body"`
}

func decodeEnvelope(t *testing.T, out *cm.InvokeOutput) envelope {
	t.Helper()
	var env envelope
	if err := json.Unmarshal(out.Payload, &env); err != nil {
		t.Fatalf("decode envelope %s: %v", out.Payload, err)
	}
	return env
}

func result[T any](t *testing.T, out *cm.InvokeOutput) T {
	t.Helper()
	env := decodeEnvelope(t, out)
	if env.StatusCode != 200 {
		t.Fatalf("handler failed: %s (logs %v)", out.Payload, logLines(out))
	}
	var value T
	if err := json.Unmarshal(env.Body.Result, &value); err != nil {
		t.Fatalf("decode result %s: %v", env.Body.Result, err)
	}
	return value
}

func logLines(out *cm.InvokeOutput) []string {
	lines := make([]string, len(out.Logs))
	for i, l := range out.Logs {
		lines[i] = string(l.Stream) + ": " + l.Line
	}
	return lines
}

func hasLog(out *cm.InvokeOutput, stream cm.InvokeLogLineStream, substr string) bool {
	for _, l := range out.Logs {
		if l.Stream == stream && strings.Contains(l.Line, substr) {
			return true
		}
	}
	return false
}

func (e *env) runningPods(t *testing.T, namespace, selector string) []corev1.Pod {
	t.Helper()
	pods, err := e.kube.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{LabelSelector: selector})
	if err != nil {
		t.Fatal(err)
	}
	var running []corev1.Pod
	for _, p := range pods.Items {
		if p.Status.Phase == corev1.PodRunning && p.DeletionTimestamp == nil {
			running = append(running, p)
		}
	}
	return running
}
