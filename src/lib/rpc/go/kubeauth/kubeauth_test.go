package kubeauth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
)

const reviewerToken = "reviewer-token"

type fakeAPIServer struct {
	*httptest.Server
	reviews  atomic.Int32
	reviewer atomic.Value
	tokens   map[string]tokenReviewStatus
	fail     atomic.Bool
}

func newFakeAPIServer(t *testing.T, tokens map[string]tokenReviewStatus) *fakeAPIServer {
	t.Helper()

	f := &fakeAPIServer{tokens: tokens}
	f.reviewer.Store(reviewerToken)
	f.Server = httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/apis/authentication.k8s.io/v1/tokenreviews" {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("Authorization") != "Bearer "+f.reviewer.Load().(string) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if f.fail.Load() {
			http.Error(w, "etcd is sad", http.StatusInternalServerError)
			return
		}

		var review tokenReview
		if err := json.NewDecoder(r.Body).Decode(&review); err != nil || review.Kind != "TokenReview" {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		f.reviews.Add(1)

		status, ok := f.tokens[review.Spec.Token]
		if ok && status.Audiences == nil {
			status.Audiences = review.Spec.Audiences
		}
		review.Status = status
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(review)
	}))
	t.Cleanup(f.Close)
	return f
}

func (f *fakeAPIServer) config(t *testing.T) Config {
	t.Helper()

	dir := t.TempDir()
	caFile := filepath.Join(dir, "ca.crt")
	tokenFile := filepath.Join(dir, "token")
	ca := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: f.Certificate().Raw})
	if err := os.WriteFile(caFile, ca, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(tokenFile, []byte(reviewerToken+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	return Config{
		APIServer: f.URL,
		CAFile:    caFile,
		TokenFile: tokenFile,
		Audiences: []string{"cluster-manager"},
	}
}

func serviceAccount(namespace, name, pod, uid string) tokenReviewStatus {
	var status tokenReviewStatus
	status.Authenticated = true
	status.User.Username = "system:serviceaccount:" + namespace + ":" + name
	if pod != "" {
		status.User.Extra = map[string][]string{podNameExtra: {pod}, podUIDExtra: {uid}}
	}
	return status
}

func jwt(exp time.Time) string {
	payload, _ := json.Marshal(map[string]any{"exp": exp.Unix()})
	return "eyJhbGciOiJSUzI1NiJ9." + base64.RawURLEncoding.EncodeToString(payload) + ".sig"
}

func newVerifier(t *testing.T, cfg Config) *Verifier {
	t.Helper()

	v, err := New(cfg)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func assertStatus(t *testing.T, err error, status int) {
	t.Helper()

	rpcErr, ok := ldrpc.AsError(err)
	if !ok || rpcErr.Status != status {
		t.Fatalf("expected %d error, got %v", status, err)
	}
}

func TestVerifyExtractsIdentity(t *testing.T) {
	api := newFakeAPIServer(t, map[string]tokenReviewStatus{
		"pod-token": serviceAccount("metorial", "functions", "functions-7d9f", "c0ffee"),
		"sa-token":  serviceAccount("metorial", "build", "", ""),
	})
	v := newVerifier(t, api.config(t))

	identity, err := v.Verify(context.Background(), "pod-token")
	if err != nil {
		t.Fatal(err)
	}
	want := Identity{Namespace: "metorial", ServiceAccount: "functions", PodName: "functions-7d9f", PodUID: "c0ffee"}
	if *identity != want {
		t.Fatalf("got %+v, want %+v", *identity, want)
	}

	identity, err = v.Verify(context.Background(), "sa-token")
	if err != nil {
		t.Fatal(err)
	}
	if identity.ServiceAccount != "build" || identity.PodName != "" {
		t.Fatalf("unexpected identity %+v", identity)
	}
}

func TestVerifyRejects(t *testing.T) {
	wrongAudience := serviceAccount("metorial", "functions", "", "")
	wrongAudience.Audiences = []string{"https://kubernetes.default.svc"}

	user := serviceAccount("metorial", "functions", "", "")
	user.User.Username = "alice@example.com"

	api := newFakeAPIServer(t, map[string]tokenReviewStatus{
		"wrong-audience": wrongAudience,
		"user":           user,
	})
	v := newVerifier(t, api.config(t))

	for _, token := range []string{"", "unknown", "wrong-audience", "user"} {
		_, err := v.Verify(context.Background(), token)
		assertStatus(t, err, http.StatusUnauthorized)
	}
}

func TestVerifyCachesUntilTTL(t *testing.T) {
	api := newFakeAPIServer(t, map[string]tokenReviewStatus{"token": serviceAccount("metorial", "functions", "", "")})
	v := newVerifier(t, api.config(t))

	now := time.Unix(1_700_000_000, 0)
	v.now = func() time.Time { return now }

	for range 3 {
		if _, err := v.Verify(context.Background(), "token"); err != nil {
			t.Fatal(err)
		}
	}
	if got := api.reviews.Load(); got != 1 {
		t.Fatalf("expected 1 review, got %d", got)
	}

	now = now.Add(DefaultCacheTTL)
	if _, err := v.Verify(context.Background(), "token"); err != nil {
		t.Fatal(err)
	}
	if got := api.reviews.Load(); got != 2 {
		t.Fatalf("expected a fresh review after the TTL, got %d", got)
	}
}

func TestVerifyCacheBoundedByTokenExpiry(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	shortLived := jwt(now.Add(10 * time.Second))
	expired := jwt(now.Add(-time.Second))

	api := newFakeAPIServer(t, map[string]tokenReviewStatus{
		shortLived: serviceAccount("metorial", "functions", "", ""),
		expired:    serviceAccount("metorial", "functions", "", ""),
	})
	v := newVerifier(t, api.config(t))
	v.now = func() time.Time { return now }

	if _, err := v.Verify(context.Background(), shortLived); err != nil {
		t.Fatal(err)
	}
	now = now.Add(5 * time.Second)
	if _, err := v.Verify(context.Background(), shortLived); err != nil {
		t.Fatal(err)
	}
	if got := api.reviews.Load(); got != 1 {
		t.Fatalf("expected 1 review, got %d", got)
	}

	now = now.Add(5 * time.Second)
	if _, err := v.Verify(context.Background(), shortLived); err != nil {
		t.Fatal(err)
	}
	if got := api.reviews.Load(); got != 2 {
		t.Fatalf("expected a fresh review at token expiry, got %d", got)
	}

	for range 2 {
		if _, err := v.Verify(context.Background(), expired); err != nil {
			t.Fatal(err)
		}
	}
	if got := api.reviews.Load(); got != 4 {
		t.Fatalf("expected expired tokens to never be cached, got %d reviews", got)
	}
}

func TestVerifyDoesNotCacheFailures(t *testing.T) {
	api := newFakeAPIServer(t, map[string]tokenReviewStatus{})
	v := newVerifier(t, api.config(t))

	for range 2 {
		_, err := v.Verify(context.Background(), "unknown")
		assertStatus(t, err, http.StatusUnauthorized)
	}
	if got := api.reviews.Load(); got != 2 {
		t.Fatalf("expected 2 reviews, got %d", got)
	}
}

func TestVerifyAPIServerFailureIsUnavailable(t *testing.T) {
	api := newFakeAPIServer(t, map[string]tokenReviewStatus{"token": serviceAccount("metorial", "functions", "", "")})
	api.fail.Store(true)
	v := newVerifier(t, api.config(t))

	_, err := v.Verify(context.Background(), "token")
	assertStatus(t, err, http.StatusServiceUnavailable)

	cfg := api.config(t)
	cfg.APIServer = "https://127.0.0.1:1"
	_, err = newVerifier(t, cfg).Verify(context.Background(), "token")
	assertStatus(t, err, http.StatusServiceUnavailable)
}

func TestVerifyRereadsRotatedReviewerToken(t *testing.T) {
	api := newFakeAPIServer(t, map[string]tokenReviewStatus{
		"a": serviceAccount("metorial", "functions", "", ""),
		"b": serviceAccount("metorial", "functions", "", ""),
	})
	cfg := api.config(t)
	v := newVerifier(t, cfg)

	if _, err := v.Verify(context.Background(), "a"); err != nil {
		t.Fatal(err)
	}

	api.reviewer.Store("rotated")
	if err := os.WriteFile(cfg.TokenFile, []byte("rotated"), 0o600); err != nil {
		t.Fatal(err)
	}
	future := time.Now().Add(time.Minute)
	if err := os.Chtimes(cfg.TokenFile, future, future); err != nil {
		t.Fatal(err)
	}

	if _, err := v.Verify(context.Background(), "b"); err != nil {
		t.Fatal(err)
	}
}

func TestVerifyAllowlist(t *testing.T) {
	api := newFakeAPIServer(t, map[string]tokenReviewStatus{
		"functions": serviceAccount("metorial", "functions", "", ""),
		"other":     serviceAccount("tenant", "functions", "", ""),
	})
	cfg := api.config(t)
	allowed, err := ParseAllowlist("metorial/functions", "system:serviceaccount:metorial:build")
	if err != nil {
		t.Fatal(err)
	}
	cfg.Allowed = allowed
	v := newVerifier(t, cfg)

	if _, err := v.Verify(context.Background(), "functions"); err != nil {
		t.Fatal(err)
	}
	_, err = v.Verify(context.Background(), "other")
	assertStatus(t, err, http.StatusForbidden)
}

func TestNewRequiresAudienceAndAPIServer(t *testing.T) {
	if _, err := New(Config{}); err == nil {
		t.Fatal("expected an error without audiences")
	}

	t.Setenv("KUBERNETES_SERVICE_HOST", "")
	t.Setenv("KUBERNETES_SERVICE_PORT", "")
	if _, err := New(Config{Audiences: []string{"x"}}); err == nil {
		t.Fatal("expected an error outside a cluster without APIServer")
	}
}

func TestNewInClusterDefaults(t *testing.T) {
	t.Setenv("KUBERNETES_SERVICE_HOST", "fd00::1")
	t.Setenv("KUBERNETES_SERVICE_PORT", "443")

	v, err := New(Config{Audiences: []string{"x"}, HTTPClient: http.DefaultClient})
	if err != nil {
		t.Fatal(err)
	}
	if v.cfg.APIServer != "https://[fd00::1]:443" || v.cfg.TokenFile != InClusterTokenFile || v.cfg.CAFile != InClusterCAFile {
		t.Fatalf("unexpected defaults %+v", v.cfg)
	}
}

func TestLdrpcAuthenticateAndMethodAllowlist(t *testing.T) {
	api := newFakeAPIServer(t, map[string]tokenReviewStatus{
		"functions": serviceAccount("metorial", "functions", "functions-0", "uid-0"),
		"build":     serviceAccount("metorial", "build", "", ""),
	})
	v := newVerifier(t, api.config(t))

	functions := Allowlist{{Namespace: "metorial", Name: "functions"}}
	build := Allowlist{{Namespace: "metorial", Name: "build"}}

	srv := ldrpc.NewServer(ldrpc.ServerOptions{Path: "/rpc", Authenticate: v.Authenticate()})
	srv.Use(MethodAllowlist(map[string]Allowlist{
		"function:":       functions,
		"function:invoke": append(Allowlist{}, append(functions, build...)...),
		"build:":          build,
	}))
	whoami := ldrpc.Unary(func(ctx context.Context, in *ldrpc.Void) (*Identity, error) {
		identity, ok := IdentityFromContext(ctx)
		if !ok {
			return nil, ldrpc.InternalServerError()
		}
		return identity, nil
	})
	for _, method := range []string{"function:list", "function:invoke", "build:start", "bundle:import"} {
		srv.Handle(method, whoami)
	}
	ts := httptest.NewServer(srv)
	t.Cleanup(ts.Close)

	client := func(token string) *ldrpc.Client {
		c, err := ldrpc.NewClient(ts.URL+"/rpc", ldrpc.ClientOptions{
			HeaderFunc: func(ctx context.Context) (http.Header, error) {
				return http.Header{"Authorization": {"Bearer " + token}}, nil
			},
		})
		if err != nil {
			t.Fatal(err)
		}
		return c
	}

	call := func(token, method string) (*Identity, error) {
		return ldrpc.Call[Identity](context.Background(), client(token), method, ldrpc.Void{}, ldrpc.WithoutRetry())
	}

	identity, err := call("functions", "function:list")
	if err != nil {
		t.Fatal(err)
	}
	if identity.PodName != "functions-0" || identity.PodUID != "uid-0" {
		t.Fatalf("unexpected identity %+v", identity)
	}

	cases := []struct {
		token, method string
		status        int
	}{
		{"functions", "function:invoke", 0},
		{"build", "function:invoke", 0},
		{"build", "build:start", 0},
		{"build", "function:list", http.StatusForbidden},
		{"functions", "build:start", http.StatusForbidden},
		{"functions", "bundle:import", http.StatusForbidden},
		{"nope", "function:list", http.StatusUnauthorized},
	}
	for _, c := range cases {
		_, err := call(c.token, c.method)
		if c.status == 0 {
			if err != nil {
				t.Fatalf("%s %s: %v", c.token, c.method, err)
			}
			continue
		}
		assertStatus(t, err, c.status)
	}
}

func TestMiddleware(t *testing.T) {
	api := newFakeAPIServer(t, map[string]tokenReviewStatus{"token": serviceAccount("tenant-a", "default", "fn-1", "uid-1")})
	v := newVerifier(t, api.config(t))

	ts := httptest.NewServer(v.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity, _ := IdentityFromContext(r.Context())
		fmt.Fprint(w, identity)
	})))
	t.Cleanup(ts.Close)

	get := func(header string) *http.Response {
		req, _ := http.NewRequest(http.MethodGet, ts.URL, nil)
		if header != "" {
			req.Header.Set("Authorization", header)
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { res.Body.Close() })
		return res
	}

	res := get("bearer token")
	var body [64]byte
	n, _ := res.Body.Read(body[:])
	if res.StatusCode != http.StatusOK || string(body[:n]) != "tenant-a/default (pod fn-1)" {
		t.Fatalf("got %d %q", res.StatusCode, body[:n])
	}

	for _, header := range []string{"", "Basic token", "Bearer nope"} {
		res := get(header)
		var errBody ldrpc.Error
		if err := json.NewDecoder(res.Body).Decode(&errBody); err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != http.StatusUnauthorized || errBody.Code != "unauthorized" {
			t.Fatalf("%q: got %d %+v", header, res.StatusCode, errBody)
		}
	}
}

func TestTokenFileHeader(t *testing.T) {
	path := filepath.Join(t.TempDir(), "token")
	if err := os.WriteFile(path, []byte("one\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	header := TokenFileHeader(path)
	h, err := header(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got := h.Get("Authorization"); got != "Bearer one" {
		t.Fatalf("got %q", got)
	}

	if err := os.WriteFile(path, []byte("two"), 0o600); err != nil {
		t.Fatal(err)
	}
	future := time.Now().Add(time.Minute)
	if err := os.Chtimes(path, future, future); err != nil {
		t.Fatal(err)
	}
	h, err = header(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got := h.Get("Authorization"); got != "Bearer two" {
		t.Fatalf("got %q after rotation", got)
	}

	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(path, future.Add(time.Minute), future.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, err := header(context.Background()); err == nil {
		t.Fatal("expected an error for an empty token file")
	}
}

func TestParseServiceAccount(t *testing.T) {
	for in, want := range map[string]ServiceAccount{
		"metorial/functions":                     {"metorial", "functions"},
		"system:serviceaccount:metorial:builder": {"metorial", "builder"},
	} {
		got, err := ParseServiceAccount(in)
		if err != nil || got != want {
			t.Fatalf("%q: got %+v, %v", in, got, err)
		}
	}
	for _, in := range []string{"", "functions", "/functions", "metorial/", "a/b/c", "system:serviceaccount:metorial"} {
		if _, err := ParseServiceAccount(in); err == nil {
			t.Fatalf("%q: expected an error", in)
		}
	}
}
