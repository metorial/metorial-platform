package supervisor

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/functionruntimerpc"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/auth/authtest"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/bundle/bundletest"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/gateway/gatewaytest"
)

// TestImageSmoke runs the function image the way the pod spec does (read-only root, uid 65532,
// no capabilities, emptyDir-like tmpfs mounts) against a fake bundle endpoint and gateway on the
// host. Opt in with RUNTIME_FUNCTION_IMAGE=dev.local/runtime-function-nodejs-24:dev; the
// container reaches the host through RUNTIME_SMOKE_HOST (default host.docker.internal).
func TestImageSmoke(t *testing.T) {
	image := os.Getenv("RUNTIME_FUNCTION_IMAGE")
	if image == "" {
		t.Skip("set RUNTIME_FUNCTION_IMAGE to run the image smoke test")
	}
	hostAlias := os.Getenv("RUNTIME_SMOKE_HOST")
	if hostAlias == "" {
		hostAlias = "host.docker.internal"
	}

	dir, err := os.MkdirTemp("", "smoke-")
	must(t, err)
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	identityDir, trustDir := filepath.Join(dir, "identity"), filepath.Join(dir, "trust")
	must(t, os.MkdirAll(identityDir, 0o755))
	must(t, os.MkdirAll(trustDir, 0o755))

	signer := authtest.NewSigner()
	must(t, os.WriteFile(filepath.Join(trustDir, "keys.json"), authtest.KeysJSON(signer), 0o644))
	must(t, os.WriteFile(filepath.Join(identityDir, "token"), []byte("pod-token"), 0o644))

	archive := bundletest.Pack(bundletest.File("index.js", `
		exports.handler = async input => {
		  console.log('smoke', input.n);
		  let res = await fetch(input.url);
		  return { n: input.n, upstream: await res.text(), uid: process.getuid(), node: process.version };
		};
	`))
	bundleServer := bundletest.NewServer("pod-token", archive)
	t.Cleanup(bundleServer.Close)

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "hello from upstream")
	}))
	t.Cleanup(upstream.Close)
	_, upstreamPort, _ := net.SplitHostPort(strings.TrimPrefix(upstream.URL, "http://"))

	keys, err := egress.ParseKeySet(authtest.KeysJSON(signer))
	must(t, err)
	gw := gatewaytest.New(keys, map[string][]string{"api.test": {"127.0.0.1"}})
	t.Cleanup(gw.Close)

	reachable := func(addr string) string {
		_, port, _ := net.SplitHostPort(addr)
		return net.JoinHostPort(hostAlias, port)
	}

	name := "runtime-smoke-" + strings.ToLower(nextInvocationID())
	run := exec.Command("docker", "run", "-d", "--rm", "--name", name,
		"--read-only", "--user", "65532:65532", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
		"--tmpfs", "/tmp:rw,mode=1777",
		"--tmpfs", "/var/runtime/bundle:rw,uid=65532,gid=65532,mode=0755",
		"-v", identityDir+":/var/run/metorial/identity:ro",
		"-v", trustDir+":/var/run/metorial/trust:ro",
		"-p", "127.0.0.1::8080",
		"-e", "METORIAL_FUNCTION_ID=fn_test",
		"-e", "METORIAL_FUNCTION_VERSION_ID="+testVersionID,
		"-e", "METORIAL_TENANT_ID=ten_test",
		"-e", "METORIAL_EXECUTION_ENV=knative",
		"-e", "METORIAL_RUNTIME=nodejs:24",
		"-e", `METORIAL_ENTRYPOINT={"path":"index.js","export":"handler","kind":"module"}`,
		"-e", "METORIAL_CONCURRENCY=exclusive",
		"-e", "METORIAL_POLICY_GATE=off",
		"-e", "METORIAL_TIMEOUT_SECONDS=30",
		"-e", "METORIAL_MEMORY_MB=256",
		"-e", "METORIAL_BUNDLE_SHA256="+bundletest.SHA256(archive),
		"-e", "METORIAL_BUNDLE_SIZE_BYTES="+strconv.Itoa(len(archive)),
		"-e", "CLUSTER_MANAGER_POD_ADDR=http://"+reachable(strings.TrimPrefix(bundleServer.URL, "http://")),
		"-e", "EGRESS_GATEWAY_ADDR="+reachable(gw.Addr),
		image,
	)
	out, err := run.CombinedOutput()
	if err != nil {
		t.Fatalf("docker run: %v\n%s", err, out)
	}
	t.Cleanup(func() {
		if t.Failed() {
			logs, _ := exec.Command("docker", "logs", name).CombinedOutput()
			t.Logf("container logs:\n%s", logs)
		}
		_ = exec.Command("docker", "rm", "-f", name).Run()
	})

	portOut, err := exec.Command("docker", "port", name, "8080/tcp").Output()
	must(t, err)
	base := "http://" + strings.TrimSpace(strings.Split(string(portOut), "\n")[0])

	deadline := time.Now().Add(60 * time.Second)
	for {
		resp, err := http.Get(base + "/ready")
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				break
			}
		}
		if time.Now().After(deadline) {
			t.Fatal("container never became ready")
		}
		time.Sleep(200 * time.Millisecond)
	}

	client, err := functionruntimerpc.NewClient(base+"/rpc", ldrpc.ClientOptions{DirectRoute: true, Timeout: time.Minute})
	must(t, err)

	payload, _ := json.Marshal(map[string]any{"n": 7, "url": "http://api.test:" + upstreamPort + "/"})
	inv := authtest.Invocation{ID: nextInvocationID(), VersionID: testVersionID, PayloadJSON: string(payload), AllowAll: true}
	result, err := client.Invoke(context.Background(), &functionruntimerpc.InvokeInput{
		VersionID:       testVersionID,
		PayloadJSON:     string(payload),
		InvocationToken: signer.InvocationToken(inv),
		EgressGrant:     signer.EgressGrant(inv),
		DeadlineMs:      20_000,
	})
	must(t, err)

	var env struct {
		StatusCode int `json:"statusCode"`
		Body       struct {
			Result struct {
				N        int    `json:"n"`
				Upstream string `json:"upstream"`
				UID      int    `json:"uid"`
				Node     string `json:"node"`
			} `json:"result"`
		} `json:"body"`
	}
	must(t, json.Unmarshal(result.Payload, &env))
	if env.StatusCode != 200 || env.Body.Result.Upstream != "hello from upstream" || env.Body.Result.UID != 65532 || !strings.HasPrefix(env.Body.Result.Node, "v24.") {
		t.Fatalf("unexpected result %s", result.Payload)
	}
	if len(result.Logs) != 1 || result.Logs[0].Line != "smoke 7" {
		t.Fatalf("unexpected logs %+v", result.Logs)
	}

	_, err = client.Invoke(context.Background(), &functionruntimerpc.InvokeInput{
		VersionID:       testVersionID,
		PayloadJSON:     string(payload),
		InvocationToken: signer.InvocationToken(inv),
		EgressGrant:     signer.EgressGrant(inv),
		DeadlineMs:      20_000,
	})
	var rpcErr *ldrpc.Error
	if !errors.As(err, &rpcErr) || rpcErr.Reason != "replayed" {
		t.Fatalf("expected a replay rejection, got %v", err)
	}
	t.Logf("node %s, uid %d, compute %dms", env.Body.Result.Node, env.Body.Result.UID, result.ComputeTimeMs)
}
