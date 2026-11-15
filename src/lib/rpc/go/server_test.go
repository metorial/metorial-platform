package ldrpc

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type getBucketInput struct {
	BucketID string `json:"bucketId"`
}

func (in *getBucketInput) Validate() error {
	if in.BucketID == "" {
		return ValidationErrors{{Code: "required", Message: "bucketId is required", Path: []string{"bucketId"}}}
	}
	return nil
}

type bucket struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"createdAt"`
	Caller    string    `json:"caller,omitempty"`
}

var createdAt = time.UnixMilli(1_700_000_000_123).UTC()

func newTestServer(t *testing.T, opts ServerOptions) (*Server, *httptest.Server) {
	t.Helper()

	srv := NewServer(opts)
	srv.Handle("bucket:get", Unary(func(ctx context.Context, in *getBucketInput) (*bucket, error) {
		if in.BucketID == "missing" {
			return nil, NotFoundError("bucket", in.BucketID)
		}
		caller := ""
		if c, ok := CallInfoFromContext(ctx).Auth.(Ed25519Caller); ok {
			caller = c.KeyID
		}
		return &bucket{ID: in.BucketID, CreatedAt: createdAt, Caller: caller}, nil
	}))
	srv.Handle("bucket.panic", Unary(func(ctx context.Context, in *struct{}) (*struct{}, error) {
		panic("boom")
	}))
	srv.Handle("bucket:fail", Unary(func(ctx context.Context, in *struct{}) (*struct{}, error) {
		return nil, errors.New("database exploded")
	}))

	mux := http.NewServeMux()
	srv.Mount(mux)
	hs := httptest.NewServer(mux)
	t.Cleanup(hs.Close)
	return srv, hs
}

func newTestClient(t *testing.T, endpoint string, opts ClientOptions) *Client {
	t.Helper()
	c, err := NewClient(endpoint, opts)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestCallRoundTrip(t *testing.T) {
	for _, direct := range []bool{false, true} {
		_, hs := newTestServer(t, ServerOptions{Path: "/rpc"})
		c := newTestClient(t, hs.URL+"/rpc", ClientOptions{DirectRoute: direct})

		out, err := Call[bucket](context.Background(), c, "bucket:get", getBucketInput{BucketID: "bkt_1"})
		if err != nil {
			t.Fatalf("direct=%v: %v", direct, err)
		}
		if out.ID != "bkt_1" || !out.CreatedAt.Equal(createdAt) {
			t.Fatalf("direct=%v: unexpected result %+v", direct, out)
		}
	}
}

func TestCallErrors(t *testing.T) {
	var reported atomic.Int32
	_, hs := newTestServer(t, ServerOptions{
		Path:    "/rpc",
		OnError: func(ctx context.Context, call *CallInfo, err error) { reported.Add(1) },
	})
	c := newTestClient(t, hs.URL+"/rpc", ClientOptions{MaxAttempts: 1})
	ctx := context.Background()

	_, err := Call[bucket](ctx, c, "bucket:get", getBucketInput{BucketID: "missing"})
	if e, ok := AsError(err); !ok || e.Status != 404 || e.Code != "not_found" || e.Extra["entity"] != "bucket" {
		t.Fatalf("unexpected error %#v", err)
	}

	_, err = Call[bucket](ctx, c, "bucket:get", getBucketInput{})
	if e, ok := AsError(err); !ok || e.Status != 400 || e.Code != "invalid_data" || e.Extra["entity"] != "call_data" {
		t.Fatalf("unexpected error %#v", err)
	}

	_, err = Call[bucket](ctx, c, "bucket:get", map[string]any{"bucketId": 5})
	if e, ok := AsError(err); !ok || e.Status != 400 {
		t.Fatalf("unexpected error %#v", err)
	}

	_, err = Call[bucket](ctx, c, "bucket:nope", nil)
	if e, ok := AsError(err); !ok || e.Status != 404 || e.Extra["entity"] != "handler" {
		t.Fatalf("unexpected error %#v", err)
	}

	for _, method := range []string{"bucket:panic", "bucket:fail"} {
		_, err = Call[struct{}](ctx, c, method, struct{}{})
		e, ok := AsError(err)
		if !ok || e.Status != 500 || e.Code != "internal_server_error" || strings.Contains(e.Message, "exploded") {
			t.Fatalf("%s: unexpected error %#v", method, err)
		}
	}
	if reported.Load() != 2 {
		t.Fatalf("expected 2 reported errors, got %d", reported.Load())
	}
}

func TestBatch(t *testing.T) {
	_, hs := newTestServer(t, ServerOptions{Path: "/rpc"})
	c := newTestClient(t, hs.URL+"/rpc", ClientOptions{})

	var a, b bucket
	calls := []*BatchCall{
		{Method: "bucket:get", Input: getBucketInput{BucketID: "a"}, Output: &a},
		{Method: "bucket.get", Input: getBucketInput{BucketID: "missing"}, Output: &b},
	}
	if err := c.Batch(context.Background(), calls); err != nil {
		t.Fatal(err)
	}
	if calls[0].Err != nil || a.ID != "a" {
		t.Fatalf("first call: %v %+v", calls[0].Err, a)
	}
	if e, ok := AsError(calls[1].Err); !ok || e.Status != 404 {
		t.Fatalf("second call: %#v", calls[1].Err)
	}
}

func TestBatchHTTPStatusIsMaxCallStatus(t *testing.T) {
	_, hs := newTestServer(t, ServerOptions{})
	body, _ := Marshal(map[string]any{"calls": []map[string]any{
		{"id": "1", "name": "bucket:get", "payload": map[string]any{"bucketId": "a"}},
		{"id": "2", "name": "bucket:get", "payload": map[string]any{"bucketId": "missing"}},
	}})

	res, err := http.Post(hs.URL, ContentType, strings.NewReader(string(body)))
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()

	if res.StatusCode != 404 || res.Header.Get(RequestIDHeader) == "" {
		t.Fatalf("status %d, request id %q", res.StatusCode, res.Header.Get(RequestIDHeader))
	}
}

func TestRejectsWrongContentType(t *testing.T) {
	_, hs := newTestServer(t, ServerOptions{})
	res, err := http.Post(hs.URL+"/bucket.get", "text/plain", strings.NewReader(`{}`))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != 406 {
		t.Fatalf("status %d", res.StatusCode)
	}
}

func TestHMACAuth(t *testing.T) {
	_, hs := newTestServer(t, ServerOptions{
		Path:         "/rpc",
		Authenticate: HMACAuth(func(r *http.Request) (string, error) { return "secret", nil }),
	})
	ctx := context.Background()

	ok := newTestClient(t, hs.URL+"/rpc?region=eu&x=%3C1%3E", ClientOptions{HMACToken: "secret"})
	if _, err := Call[bucket](ctx, ok, "bucket:get", getBucketInput{BucketID: "a"}, WithQuery("extra", "a b")); err != nil {
		t.Fatal(err)
	}

	bad := newTestClient(t, hs.URL+"/rpc", ClientOptions{HMACToken: "wrong"})
	if _, err := Call[bucket](ctx, bad, "bucket:get", getBucketInput{BucketID: "a"}); !isStatus(err, 401) {
		t.Fatalf("expected 401, got %#v", err)
	}

	none := newTestClient(t, hs.URL+"/rpc", ClientOptions{})
	if _, err := Call[bucket](ctx, none, "bucket:get", getBucketInput{BucketID: "a"}); !isStatus(err, 401) {
		t.Fatalf("expected 401, got %#v", err)
	}
}

func TestEd25519Auth(t *testing.T) {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	_, hs := newTestServer(t, ServerOptions{
		Path: "/rpc",
		Authenticate: Ed25519Auth("code-bucket", func(ctx context.Context, keyID string) (ed25519.PublicKey, error) {
			if keyID != "caller-1" {
				return nil, errors.New("unknown key")
			}
			return pub, nil
		}),
	})
	ctx := context.Background()

	c := newTestClient(t, hs.URL+"/rpc", ClientOptions{
		Header:  http.Header{"Authorization": {"Bearer abc"}},
		Ed25519: &Ed25519Credentials{KeyID: "caller-1", Audience: "code-bucket", PrivateKey: priv},
	})
	out, err := Call[bucket](ctx, c, "bucket:get", getBucketInput{BucketID: "a"})
	if err != nil {
		t.Fatal(err)
	}
	if out.Caller != "caller-1" {
		t.Fatalf("auth context not propagated: %+v", out)
	}

	wrongAudience := newTestClient(t, hs.URL+"/rpc", ClientOptions{
		Ed25519: &Ed25519Credentials{KeyID: "caller-1", Audience: "other", PrivateKey: priv},
	})
	if _, err := Call[bucket](ctx, wrongAudience, "bucket:get", getBucketInput{BucketID: "a"}); !isStatus(err, 401) {
		t.Fatalf("expected 401, got %#v", err)
	}
}

func TestClientRetries(t *testing.T) {
	var attempts atomic.Int32
	srv := NewServer(ServerOptions{})
	srv.Handle("flaky", Unary(func(ctx context.Context, in *struct{}) (*bucket, error) {
		if attempts.Add(1) < 3 {
			return nil, NewError(503, "unavailable", "try again")
		}
		return &bucket{ID: "ok"}, nil
	}))

	var proxyFailures atomic.Int32
	hs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if proxyFailures.Add(1) <= 2 {
			http.Error(w, "<html>bad gateway</html>", http.StatusBadGateway)
			return
		}
		srv.ServeHTTP(w, r)
	}))
	defer hs.Close()

	c := newTestClient(t, hs.URL, ClientOptions{})
	out, err := Call[bucket](context.Background(), c, "flaky", struct{}{})
	if err != nil {
		t.Fatal(err)
	}
	if out.ID != "ok" || attempts.Load() != 3 {
		t.Fatalf("result %+v after %d handler attempts", out, attempts.Load())
	}
}

func TestClientDoesNotRetryClientErrors(t *testing.T) {
	var attempts atomic.Int32
	srv := NewServer(ServerOptions{})
	srv.Handle("conflict", Unary(func(ctx context.Context, in *struct{}) (*struct{}, error) {
		attempts.Add(1)
		return nil, ConflictError()
	}))
	hs := httptest.NewServer(srv)
	defer hs.Close()

	c := newTestClient(t, hs.URL, ClientOptions{})
	if _, err := Call[struct{}](context.Background(), c, "conflict", struct{}{}); !isStatus(err, 409) {
		t.Fatalf("expected 409, got %#v", err)
	}
	if attempts.Load() != 1 {
		t.Fatalf("expected one attempt, got %d", attempts.Load())
	}
}

func TestClientTimeout(t *testing.T) {
	hs := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "down", http.StatusServiceUnavailable)
	}))
	defer hs.Close()

	c := newTestClient(t, hs.URL, ClientOptions{Timeout: 200 * time.Millisecond})
	_, err := Call[struct{}](context.Background(), c, "anything", nil)
	if !isStatus(err, 504) || !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("expected 504 timeout, got %#v", err)
	}
}

func TestMiddlewareSeesCallInfo(t *testing.T) {
	srv := NewServer(ServerOptions{})
	var seen atomic.Value
	srv.Use(func(next HandlerFunc) HandlerFunc {
		return func(ctx context.Context, payload json.RawMessage) (any, error) {
			seen.Store(CallInfoFromContext(ctx).Method)
			return next(ctx, payload)
		}
	})
	srv.Handle("a:b", Unary(func(ctx context.Context, in *struct{}) (*struct{}, error) { return nil, nil }))

	hs := httptest.NewServer(srv)
	defer hs.Close()

	if _, err := Call[struct{}](context.Background(), newTestClient(t, hs.URL, ClientOptions{}), "a.b", nil); err != nil {
		t.Fatal(err)
	}
	if seen.Load() != "a:b" {
		t.Fatalf("middleware saw %v", seen.Load())
	}
}

func TestClientIntercept(t *testing.T) {
	_, hs := newTestServer(t, ServerOptions{Path: "/rpc"})

	type ctxKey struct{}
	var seen []string
	var results []error
	c := newTestClient(t, hs.URL+"/rpc", ClientOptions{
		HeaderFunc: func(ctx context.Context) (http.Header, error) {
			return http.Header{"X-From-Interceptor": {ctx.Value(ctxKey{}).(string)}}, nil
		},
		Intercept: func(ctx context.Context, methods []string, next func(ctx context.Context) error) error {
			seen = append(seen, methods...)
			err := next(context.WithValue(ctx, ctxKey{}, "yes"))
			results = append(results, err)
			return err
		},
	})
	ctx := context.Background()

	if _, err := Call[bucket](ctx, c, "bucket.get", getBucketInput{BucketID: "a"}); err != nil {
		t.Fatal(err)
	}
	if _, err := Call[bucket](ctx, c, "bucket:get", getBucketInput{BucketID: "missing"}); !isStatus(err, 404) {
		t.Fatalf("expected 404, got %v", err)
	}
	batch := []*BatchCall{{Method: "bucket:get", Input: getBucketInput{BucketID: "b"}}, {Method: "bucket:fail"}}
	if err := c.Batch(ctx, batch); err != nil {
		t.Fatal(err)
	}

	if !reflect.DeepEqual(seen, []string{"bucket:get", "bucket:get", "bucket:get", "bucket:fail"}) {
		t.Fatalf("interceptor saw %v", seen)
	}
	if results[0] != nil || !isStatus(results[1], 404) || results[2] != nil {
		t.Fatalf("interceptor results %v", results)
	}

	refused := errors.New("circuit open")
	c = newTestClient(t, hs.URL+"/rpc", ClientOptions{
		Intercept: func(ctx context.Context, methods []string, next func(ctx context.Context) error) error {
			return refused
		},
	})
	if _, err := Call[bucket](ctx, c, "bucket:get", getBucketInput{BucketID: "a"}); !errors.Is(err, refused) {
		t.Fatalf("expected the interceptor error, got %v", err)
	}
}

func isStatus(err error, status int) bool {
	e, ok := AsError(err)
	return ok && e.Status == status
}
