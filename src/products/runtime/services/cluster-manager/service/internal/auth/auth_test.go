package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"k8s.io/client-go/rest"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc/kubeauth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/metrics"
)

const (
	controlAudience = "runtime-cluster-manager"
	podAudience     = "runtime-cluster-manager-pod"
)

type fakeToken struct {
	user     string
	audience string
	podName  string
}

var tokens = map[string]fakeToken{
	"functions": {user: "system:serviceaccount:metorial:metorial-functions", audience: controlAudience},
	"build":     {user: "system:serviceaccount:metorial:metorial-build", audience: controlAudience},
	"stranger":  {user: "system:serviceaccount:metorial:someone-else", audience: controlAudience},
	"wrong-ns":  {user: "system:serviceaccount:other:metorial-functions", audience: controlAudience},
	"pod":       {user: "system:serviceaccount:metorial-runtime-functions:function-runtime", audience: podAudience, podName: "fn-abc-00001-deployment-x"},
	"user":      {user: "kubernetes-admin", audience: controlAudience},
}

func fakeAPIServer(t *testing.T) *httptest.Server {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/apis/authentication.k8s.io/v1/tokenreviews" {
			http.NotFound(w, r)
			return
		}
		var review map[string]any
		_ = json.NewDecoder(r.Body).Decode(&review)
		spec := review["spec"].(map[string]any)
		token := spec["token"].(string)
		var audiences []string
		for _, a := range spec["audiences"].([]any) {
			audiences = append(audiences, a.(string))
		}

		status := map[string]any{"authenticated": false}
		if tok, ok := tokens[token]; ok && slices.Contains(audiences, tok.audience) {
			extra := map[string][]string{}
			if tok.podName != "" {
				extra["authentication.kubernetes.io/pod-name"] = []string{tok.podName}
				extra["authentication.kubernetes.io/pod-uid"] = []string{"uid-1"}
			}
			status = map[string]any{
				"authenticated": true,
				"audiences":     []string{tok.audience},
				"user":          map[string]any{"username": tok.user, "extra": extra},
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{"apiVersion": "authentication.k8s.io/v1", "kind": "TokenReview", "status": status})
	}))
	t.Cleanup(srv.Close)
	return srv
}

func newControl(t *testing.T, insecure bool) (*ControlAuth, *Authenticator) {
	t.Helper()
	srv := fakeAPIServer(t)
	cfg := &rest.Config{Host: srv.URL}

	control, err := NewVerifier(cfg, controlAudience, kubeauth.Allowlist{
		{Namespace: "metorial", Name: "metorial-functions"},
		{Namespace: "metorial", Name: "metorial-build"},
	}, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	pod, err := NewVerifier(cfg, podAudience, nil, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}

	m := metrics.New()
	ca := NewControlAuth(NewAuthenticator(ListenerControl, m, control), "metorial", "metorial-functions", "metorial-build", insecure)
	return ca, NewAuthenticator(ListenerPod, m, pod)
}

func callRPC(t *testing.T, ca *ControlAuth, token, method string) int {
	t.Helper()
	srv := ldrpc.NewServer(ldrpc.ServerOptions{Path: "/rpc", Authenticate: ca.Authenticate()})
	srv.Use(ca.Middleware())
	for _, m := range []string{"function:list", "function:invoke", "bundle:import", "build:start", "build:get"} {
		srv.Handle(m, func(context.Context, json.RawMessage) (any, error) { return map[string]bool{"ok": true}, nil })
	}
	mux := http.NewServeMux()
	srv.Mount(mux)
	ts := httptest.NewServer(mux)
	defer ts.Close()

	client, err := ldrpc.NewClient(ts.URL+"/rpc", ldrpc.ClientOptions{
		DisableRetry: true,
		Header:       http.Header{"Authorization": []string{"Bearer " + token}},
	})
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]bool
	if err := client.Call(context.Background(), method, map[string]any{}, &out); err != nil {
		if e, ok := ldrpc.AsError(err); ok {
			return e.Status
		}
		t.Fatalf("%s %s: %v", token, method, err)
	}
	return http.StatusOK
}

func TestControlAuthDecisions(t *testing.T) {
	ca, _ := newControl(t, false)
	cases := []struct {
		token, method string
		want          int
	}{
		{"functions", "function:list", 200},
		{"functions", "function:invoke", 200},
		{"functions", "bundle:import", 200},
		{"functions", "build:start", 403},
		{"build", "build:start", 200},
		{"build", "build:get", 200},
		{"build", "function:invoke", 403},
		{"build", "bundle:import", 403},
		{"stranger", "function:list", 403},
		{"wrong-ns", "function:list", 403},
		{"user", "function:list", 401},
		{"pod", "function:list", 401},
		{"garbage", "function:list", 401},
		{"", "function:list", 401},
	}
	for _, c := range cases {
		if got := callRPC(t, ca, c.token, c.method); got != c.want {
			t.Errorf("token %q calling %s: got %d, want %d", c.token, c.method, got, c.want)
		}
	}
}

func TestInsecureModeSkipsTokenReview(t *testing.T) {
	ca, _ := newControl(t, true)
	if got := callRPC(t, ca, "", "build:start"); got != 200 {
		t.Fatalf("insecure mode should allow any call, got %d", got)
	}
}

func TestPodAudienceIsSeparate(t *testing.T) {
	_, pod := newControl(t, false)

	identity, err := pod.Verify(context.Background(), "pod")
	if err != nil {
		t.Fatal(err)
	}
	if identity.Namespace != "metorial-runtime-functions" || identity.ServiceAccount != "function-runtime" || identity.PodName == "" {
		t.Fatalf("unexpected identity %+v", identity)
	}
	if _, err := pod.Verify(context.Background(), "functions"); err == nil {
		t.Fatal("a control-audience token must not authenticate on the pod listener")
	}
}
