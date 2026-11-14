// Package e2e drives a deployed cluster-manager (deploy/dev) on a real cluster with Knative.
// It only runs with CLUSTER_MANAGER_E2E=1, against a cluster with deploy/dev applied.
package e2e

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"testing"
	"time"

	authenticationv1 "k8s.io/api/authentication/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/utils/ptr"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	objectstorage "github.com/metorial/object-storage/clients/go"

	cm "github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/clustermanagerrpc"
)

type env struct {
	kube        *kubernetes.Clientset
	platformNS  string
	functionsNS string
	buildsNS    string
	controlURL  string
	podURL      string
	store       *objectstorage.Client
	functions   *cm.Client
	builds      *cm.Client
	runID       string
}

func getenv(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}

const (
	controlAudience = "metorial-cluster-manager"
	podAudience     = "metorial-cluster-manager-pods"
	artifactBucket  = "artifacts"
)

func setup(t *testing.T) *env {
	t.Helper()
	if os.Getenv("CLUSTER_MANAGER_E2E") != "1" {
		t.Skip("set CLUSTER_MANAGER_E2E=1 to run against a cluster with deploy/dev applied")
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

	e := &env{
		kube:        clientset,
		platformNS:  getenv("E2E_PLATFORM_NAMESPACE", "metorial-runtime-dev"),
		functionsNS: getenv("E2E_FUNCTIONS_NAMESPACE", "metorial-runtime-functions"),
		buildsNS:    getenv("E2E_BUILDS_NAMESPACE", "metorial-runtime-builds"),
		runID:       fmt.Sprintf("e2e%d", time.Now().Unix()),
	}

	ctx := context.Background()
	svc, err := clientset.CoreV1().Services(e.platformNS).Get(ctx, "runtime-cluster-manager", metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	e.controlURL = getenv("E2E_CONTROL_URL", "http://"+svc.Spec.ClusterIP+":52240/rpc")
	e.podURL = getenv("E2E_POD_URL", "http://"+svc.Spec.ClusterIP+":52241")

	storeSvc, err := clientset.CoreV1().Services(e.platformNS).Get(ctx, "object-storage", metav1.GetOptions{})
	if err != nil {
		t.Fatal(err)
	}
	e.store = objectstorage.NewClient(getenv("E2E_OBJECT_STORAGE_URL", "http://"+storeSvc.Spec.ClusterIP+":8080"))
	if _, err := e.store.UpsertBucket(artifactBucket); err != nil {
		t.Fatal(err)
	}

	e.functions = e.client(t, e.token(t, e.platformNS, "metorial-functions", controlAudience, nil))
	e.builds = e.client(t, e.token(t, e.platformNS, "metorial-build", controlAudience, nil))
	return e
}

func (e *env) token(t *testing.T, ns, sa, audience string, pod *corev1.Pod) string {
	t.Helper()
	spec := authenticationv1.TokenRequestSpec{Audiences: []string{audience}, ExpirationSeconds: ptr.To(int64(600))}
	if pod != nil {
		spec.BoundObjectRef = &authenticationv1.BoundObjectReference{Kind: "Pod", APIVersion: "v1", Name: pod.Name, UID: pod.UID}
	}
	res, err := e.kube.CoreV1().ServiceAccounts(ns).CreateToken(context.Background(), sa, &authenticationv1.TokenRequest{Spec: spec}, metav1.CreateOptions{})
	if err != nil {
		t.Fatalf("mint token for %s/%s: %v", ns, sa, err)
	}
	return res.Status.Token
}

func (e *env) client(t *testing.T, token string) *cm.Client {
	t.Helper()
	header := http.Header{}
	if token != "" {
		header.Set("Authorization", "Bearer "+token)
	}
	c, err := cm.NewClient(e.controlURL, ldrpc.ClientOptions{Header: header, DisableRetry: true, Timeout: 3 * time.Minute})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func status(err error) (int, string) {
	if e, ok := ldrpc.AsError(err); ok {
		return e.Status, e.Code
	}
	if err == nil {
		return 200, ""
	}
	return -1, err.Error()
}

func expectError(t *testing.T, err error, wantStatus int, wantCode string) {
	t.Helper()
	s, c := status(err)
	if s != wantStatus || (wantCode != "" && c != wantCode) {
		t.Fatalf("expected %d %s, got %d %s (%v)", wantStatus, wantCode, s, c, err)
	}
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

func (e *env) podGet(t *testing.T, path, token string) (int, []byte) {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, e.podURL+path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	return res.StatusCode, body
}

func (e *env) runningPod(t *testing.T, ns, selector string) *corev1.Pod {
	t.Helper()
	var found *corev1.Pod
	eventually(t, 3*time.Minute, "a running pod for "+selector, func() (bool, error) {
		pods, err := e.kube.CoreV1().Pods(ns).List(context.Background(), metav1.ListOptions{LabelSelector: selector})
		if err != nil {
			return false, err
		}
		for i := range pods.Items {
			if p := &pods.Items[i]; p.Status.Phase == corev1.PodRunning && p.DeletionTimestamp == nil {
				found = p
				return true, nil
			}
		}
		return false, nil
	})
	return found
}

func quiet() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

type invokeBody struct {
	StatusCode int `json:"statusCode"`
	Body       struct {
		VersionID string `json:"versionId"`
		Pod       string `json:"pod"`
		BundleSha string `json:"bundleSha"`
		Message   string `json:"message"`
		Payload   struct {
			Hello string `json:"hello"`
		} `json:"payload"`
	} `json:"body"`
}

func decodeInvoke(t *testing.T, out *cm.InvokeOutput) invokeBody {
	t.Helper()
	var body invokeBody
	if err := json.Unmarshal(out.Payload, &body); err != nil {
		t.Fatalf("decode %s: %v", out.Payload, err)
	}
	return body
}

func ignoreNotFound(err error) error {
	if apierrors.IsNotFound(err) {
		return nil
	}
	return err
}

func contains(haystack []string, needle string) bool {
	for _, s := range haystack {
		if s == needle {
			return true
		}
	}
	return false
}
