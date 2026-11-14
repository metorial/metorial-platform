package kubeauth

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
)

// Run with LDRPC_KUBEAUTH_IT=1 against a disposable cluster (LDRPC_KUBEAUTH_CONTEXT, default
// "orbstack"). It creates and deletes the ldrpc-kubeauth-it namespace and a ClusterRoleBinding.
const (
	itNamespace = "ldrpc-kubeauth-it"
	itBinding   = "ldrpc-kubeauth-it-reviewer"
	itAudience  = "cluster-manager"
)

type kubectl struct {
	t       *testing.T
	context string
}

func (k kubectl) run(stdin string, args ...string) (string, error) {
	cmd := exec.Command("kubectl", append([]string{"--context", k.context}, args...)...)
	cmd.Stdin = strings.NewReader(stdin)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("kubectl %s: %w: %s", strings.Join(args, " "), err, stderr.Bytes())
	}
	return strings.TrimSpace(string(out)), nil
}

func (k kubectl) must(stdin string, args ...string) string {
	k.t.Helper()

	out, err := k.run(stdin, args...)
	if err != nil {
		k.t.Fatal(err)
	}
	return out
}

func (k kubectl) writeFile(name, contents string) string {
	k.t.Helper()

	path := filepath.Join(k.t.TempDir(), name)
	if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
		k.t.Fatal(err)
	}
	return path
}

const itManifest = `
apiVersion: v1
kind: Namespace
metadata:
  name: ldrpc-kubeauth-it
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: reviewer
  namespace: ldrpc-kubeauth-it
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: caller
  namespace: ldrpc-kubeauth-it
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: ldrpc-kubeauth-it-reviewer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: system:auth-delegator
subjects:
  - kind: ServiceAccount
    name: reviewer
    namespace: ldrpc-kubeauth-it
---
apiVersion: v1
kind: Pod
metadata:
  name: caller
  namespace: ldrpc-kubeauth-it
spec:
  serviceAccountName: caller
  automountServiceAccountToken: false
  terminationGracePeriodSeconds: 0
  containers:
    - name: pause
      image: registry.k8s.io/pause:3.10
`

func TestIntegrationOrbStack(t *testing.T) {
	if os.Getenv("LDRPC_KUBEAUTH_IT") != "1" {
		t.Skip("set LDRPC_KUBEAUTH_IT=1 to run against a local cluster")
	}

	k := kubectl{t: t, context: os.Getenv("LDRPC_KUBEAUTH_CONTEXT")}
	if k.context == "" {
		k.context = "orbstack"
	}

	_, _ = k.run("", "delete", "namespace", itNamespace, "--ignore-not-found", "--wait=true")
	t.Cleanup(func() {
		_, _ = k.run("", "delete", "clusterrolebinding", itBinding, "--ignore-not-found")
		_, _ = k.run("", "delete", "namespace", itNamespace, "--ignore-not-found", "--wait=false")
	})
	k.must(itManifest, "apply", "-f", "-")

	server := k.must("", "config", "view", "--raw", "--minify", "-o", "jsonpath={.clusters[0].cluster.server}")
	caFile := k.must("", "config", "view", "--raw", "--minify", "-o", "jsonpath={.clusters[0].cluster.certificate-authority}")
	if caFile == "" {
		caData, err := base64.StdEncoding.DecodeString(k.must("", "config", "view", "--raw", "--minify", "-o", "jsonpath={.clusters[0].cluster.certificate-authority-data}"))
		if err != nil {
			t.Fatal(err)
		}
		caFile = k.writeFile("ca.crt", string(caData))
	}

	podUID := k.must("", "get", "pod", "caller", "-n", itNamespace, "-o", "jsonpath={.metadata.uid}")
	createToken := func(audience string, bound bool) string {
		args := []string{"create", "token", "caller", "-n", itNamespace, "--audience", audience, "--duration", "10m"}
		if bound {
			args = append(args, "--bound-object-kind", "Pod", "--bound-object-name", "caller")
		}
		return k.must("", args...)
	}

	cfg := Config{
		APIServer: server,
		CAFile:    caFile,
		TokenFile: k.writeFile("reviewer", k.must("", "create", "token", "reviewer", "-n", itNamespace, "--duration", "10m")),
		Audiences: []string{itAudience},
	}
	verifier := func() *Verifier {
		t.Helper()

		v, err := New(cfg)
		if err != nil {
			t.Fatal(err)
		}
		return v
	}

	podToken := createToken(itAudience, true)
	ctx := context.Background()

	t.Run("pod-bound token", func(t *testing.T) {
		identity, err := verifier().Verify(ctx, podToken)
		if err != nil {
			t.Fatal(err)
		}
		want := Identity{Namespace: itNamespace, ServiceAccount: "caller", PodName: "caller", PodUID: podUID}
		if *identity != want {
			t.Fatalf("got %+v, want %+v", *identity, want)
		}
	})

	t.Run("unbound token", func(t *testing.T) {
		identity, err := verifier().Verify(ctx, createToken(itAudience, false))
		if err != nil {
			t.Fatal(err)
		}
		if identity.ServiceAccount != "caller" || identity.PodName != "" {
			t.Fatalf("unexpected identity %+v", identity)
		}
	})

	t.Run("wrong audience", func(t *testing.T) {
		_, err := verifier().Verify(ctx, createToken("someone-else", true))
		assertStatus(t, err, http.StatusUnauthorized)

		other := cfg
		other.Audiences = []string{"someone-else"}
		v, err := New(other)
		if err != nil {
			t.Fatal(err)
		}
		_, err = v.Verify(ctx, podToken)
		assertStatus(t, err, http.StatusUnauthorized)
	})

	t.Run("through ldrpc", func(t *testing.T) {
		srv := ldrpc.NewServer(ldrpc.ServerOptions{Path: "/rpc", Authenticate: verifier().Authenticate()})
		srv.Use(MethodAllowlist(map[string]Allowlist{"whoami": {{Namespace: itNamespace, Name: "caller"}}}))
		srv.Handle("whoami", ldrpc.Unary(func(ctx context.Context, in *ldrpc.Void) (*Identity, error) {
			identity, _ := IdentityFromContext(ctx)
			return identity, nil
		}))
		ts := httptest.NewServer(srv)
		defer ts.Close()

		client, err := ldrpc.NewClient(ts.URL+"/rpc", ldrpc.ClientOptions{HeaderFunc: TokenFileHeader(k.writeFile("token", podToken))})
		if err != nil {
			t.Fatal(err)
		}
		identity, err := ldrpc.Call[Identity](ctx, client, "whoami", ldrpc.Void{})
		if err != nil {
			t.Fatal(err)
		}
		if identity.PodUID != podUID {
			t.Fatalf("unexpected identity %+v", identity)
		}
	})

	t.Run("rejected after pod deletion", func(t *testing.T) {
		k.must("", "delete", "pod", "caller", "-n", itNamespace, "--grace-period=0", "--force", "--wait=true")

		deadline := time.Now().Add(30 * time.Second)
		for {
			_, err := verifier().Verify(ctx, podToken)
			if rpcErr, ok := ldrpc.AsError(err); ok && rpcErr.Status == http.StatusUnauthorized {
				return
			}
			if time.Now().After(deadline) {
				t.Fatalf("token still accepted after the pod was deleted: %v", err)
			}
			time.Sleep(time.Second)
		}
	})
}
