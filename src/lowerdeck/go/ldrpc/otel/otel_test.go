package ldrpcotel

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
)

type echoInput struct {
	Value string `json:"value"`
}

type caller string

func (c caller) String() string { return string(c) }

type fixture struct {
	spans   *tracetest.SpanRecorder
	logs    *bytes.Buffer
	options Options
	url     string
	headers chan http.Header
}

func newFixture(t *testing.T) *fixture {
	t.Helper()

	f := &fixture{spans: tracetest.NewSpanRecorder(), logs: &bytes.Buffer{}, headers: make(chan http.Header, 16)}
	f.options = Options{
		TracerProvider: sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(f.spans)),
		Propagator:     propagation.TraceContext{},
		Logger:         slog.New(slog.NewJSONHandler(f.logs, nil)),
	}

	var flaky atomic.Int32
	srv := ldrpc.NewServer(ServerOptions(ldrpc.ServerOptions{
		Path: "/rpc",
		Authenticate: func(r *http.Request, body []byte) (any, error) {
			f.headers <- r.Header.Clone()
			return caller("metorial/functions"), nil
		},
	}, f.options))
	Instrument(srv, f.options)

	srv.Handle("echo:say", ldrpc.Unary(func(ctx context.Context, in *echoInput) (*echoInput, error) {
		return in, nil
	}))
	srv.Handle("echo:flaky", ldrpc.Unary(func(ctx context.Context, in *echoInput) (*echoInput, error) {
		if flaky.Add(1) < 3 {
			return nil, ldrpc.NewError(503, "unavailable", "try again")
		}
		return in, nil
	}))
	srv.Handle("echo:missing", ldrpc.Unary(func(ctx context.Context, in *echoInput) (*echoInput, error) {
		return nil, ldrpc.NotFoundError("echo", in.Value)
	}))
	srv.Handle("echo:explode", ldrpc.Unary(func(ctx context.Context, in *echoInput) (*echoInput, error) {
		return nil, errors.New("database exploded")
	}))

	mux := http.NewServeMux()
	srv.Mount(mux)
	ts := httptest.NewServer(Handler(mux, f.options))
	t.Cleanup(ts.Close)
	f.url = ts.URL + "/rpc"
	return f
}

func (f *fixture) client(t *testing.T, opts ldrpc.ClientOptions) *ldrpc.Client {
	t.Helper()

	c, err := ldrpc.NewClient(f.url, ClientOptions(opts, f.options))
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func (f *fixture) span(t *testing.T, name string) sdktrace.ReadOnlySpan {
	t.Helper()

	var found []sdktrace.ReadOnlySpan
	for _, s := range f.spans.Ended() {
		if s.Name() == name {
			found = append(found, s)
		}
	}
	if len(found) != 1 {
		var names []string
		for _, s := range f.spans.Ended() {
			names = append(names, s.Name())
		}
		t.Fatalf("expected one %q span, got %d among %v", name, len(found), names)
	}
	return found[0]
}

func (f *fixture) logRecords(t *testing.T) []map[string]any {
	t.Helper()

	var records []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(f.logs.String()), "\n") {
		var record map[string]any
		if err := json.Unmarshal([]byte(line), &record); err != nil {
			t.Fatalf("invalid log line %q: %v", line, err)
		}
		records = append(records, record)
	}
	return records
}

func attr(s sdktrace.ReadOnlySpan, key attribute.Key) attribute.Value {
	for _, kv := range s.Attributes() {
		if kv.Key == key {
			return kv.Value
		}
	}
	return attribute.Value{}
}

func TestTracePropagatesFromClientToServer(t *testing.T) {
	f := newFixture(t)
	c := f.client(t, ldrpc.ClientOptions{})

	ctx, parent := f.options.TracerProvider.Tracer("test").Start(context.Background(), "caller")
	out, err := ldrpc.Call[echoInput](ctx, c, "echo:say", echoInput{Value: "hi"})
	parent.End()
	if err != nil || out.Value != "hi" {
		t.Fatalf("got %+v, %v", out, err)
	}

	traceparent := (<-f.headers).Get("Traceparent")
	if !strings.Contains(traceparent, parent.SpanContext().TraceID().String()) {
		t.Fatalf("traceparent %q does not carry the caller's trace", traceparent)
	}

	client := f.span(t, "ldrpc.client echo:say")
	server := f.span(t, "ldrpc.server echo:say")
	request := f.span(t, "POST ldrpc")

	traceID := parent.SpanContext().TraceID()
	for _, s := range []sdktrace.ReadOnlySpan{client, server, request} {
		if s.SpanContext().TraceID() != traceID {
			t.Fatalf("%s is in trace %s, want %s", s.Name(), s.SpanContext().TraceID(), traceID)
		}
	}
	if client.Parent().SpanID() != parent.SpanContext().SpanID() {
		t.Fatal("client span is not a child of the caller's span")
	}
	if server.Parent().SpanID() != request.SpanContext().SpanID() {
		t.Fatal("call span is not a child of the request span")
	}
	if request.SpanKind() != trace.SpanKindServer {
		t.Fatalf("request span kind %v", request.SpanKind())
	}
	if attr(server, "rpc.method").AsString() != "echo:say" || attr(server, "rpc.service").AsString() != "echo" || attr(server, "rpc.system").AsString() != "ldrpc" {
		t.Fatalf("unexpected call span attributes %v", server.Attributes())
	}

	records := f.logRecords(t)
	if len(records) != 1 {
		t.Fatalf("expected one log record, got %v", records)
	}
	record := records[0]
	if record["msg"] != "ldrpc call" || record["level"] != "INFO" || record["method"] != "echo:say" ||
		record["status"] != float64(200) || record["caller"] != "metorial/functions" || record["trace_id"] != traceID.String() {
		t.Fatalf("unexpected log record %v", record)
	}
}

func TestClientSpanCoversRetries(t *testing.T) {
	f := newFixture(t)
	c := f.client(t, ldrpc.ClientOptions{})

	if _, err := ldrpc.Call[echoInput](context.Background(), c, "echo:flaky", echoInput{Value: "x"}); err != nil {
		t.Fatal(err)
	}

	client := f.span(t, "ldrpc.client echo:flaky")
	attempts := 0
	for _, s := range f.spans.Ended() {
		if s.SpanKind() == trace.SpanKindClient && s.Parent().SpanID() == client.SpanContext().SpanID() {
			attempts++
		}
	}
	if attempts != 3 {
		t.Fatalf("expected 3 HTTP attempts under the call span, got %d", attempts)
	}
	if client.Status().Code == codes.Error {
		t.Fatal("a call that eventually succeeded is marked as failed")
	}
}

func TestErrorsAreRecorded(t *testing.T) {
	f := newFixture(t)
	c := f.client(t, ldrpc.ClientOptions{MaxAttempts: 1})
	ctx := context.Background()

	if _, err := ldrpc.Call[echoInput](ctx, c, "echo:missing", echoInput{Value: "x"}); err == nil {
		t.Fatal("expected an error")
	}
	if _, err := ldrpc.Call[echoInput](ctx, c, "echo:explode", echoInput{}); err == nil {
		t.Fatal("expected an error")
	}

	missing := f.span(t, "ldrpc.server echo:missing")
	if missing.Status().Code == codes.Error || attr(missing, "ldrpc.status").AsInt64() != 404 {
		t.Fatalf("4xx should not mark the server span as failed: %v %v", missing.Status(), missing.Attributes())
	}
	exploded := f.span(t, "ldrpc.server echo:explode")
	if exploded.Status().Code != codes.Error || attr(exploded, "ldrpc.status").AsInt64() != 500 {
		t.Fatalf("unexpected 5xx span %v %v", exploded.Status(), exploded.Attributes())
	}
	if client := f.span(t, "ldrpc.client echo:missing"); client.Status().Code != codes.Error {
		t.Fatal("client span of a failed call is not marked as failed")
	}

	var failed, errorCalls int
	for _, record := range f.logRecords(t) {
		switch {
		case record["msg"] == "ldrpc call failed" && record["error"] == "database exploded":
			failed++
		case record["msg"] == "ldrpc call" && record["level"] == "ERROR" && record["status"] == float64(500):
			errorCalls++
		}
	}
	if failed != 1 || errorCalls != 1 {
		t.Fatalf("expected one failure and one 5xx call record, got %d and %d: %s", failed, errorCalls, f.logs)
	}
}

func TestBatchSpanAndExistingHooks(t *testing.T) {
	f := newFixture(t)

	var intercepted []string
	var headerFuncCalls atomic.Int32
	c := f.client(t, ldrpc.ClientOptions{
		HeaderFunc: func(ctx context.Context) (http.Header, error) {
			headerFuncCalls.Add(1)
			return http.Header{"Authorization": {"Bearer token"}}, nil
		},
		Intercept: func(ctx context.Context, methods []string, next func(ctx context.Context) error) error {
			intercepted = append(intercepted, methods...)
			if !trace.SpanContextFromContext(ctx).IsValid() {
				t.Error("the inner interceptor does not see the call span")
			}
			return next(ctx)
		},
	})

	calls := []*ldrpc.BatchCall{
		{Method: "echo:say", Input: echoInput{Value: "a"}, Output: &echoInput{}},
		{Method: "echo:missing", Input: echoInput{Value: "b"}, Output: &echoInput{}},
	}
	if err := c.Batch(context.Background(), calls); err != nil {
		t.Fatal(err)
	}

	batch := f.span(t, "ldrpc.client batch")
	if got := attr(batch, "ldrpc.methods").AsStringSlice(); len(got) != 2 || got[1] != "echo:missing" {
		t.Fatalf("unexpected batch methods %v", got)
	}
	if len(intercepted) != 2 || headerFuncCalls.Load() != 1 {
		t.Fatalf("existing hooks were not kept: %v, %d", intercepted, headerFuncCalls.Load())
	}
	if h := <-f.headers; h.Get("Authorization") != "Bearer token" || h.Get("Traceparent") == "" {
		t.Fatalf("unexpected request headers %v", h)
	}

	say := f.span(t, "ldrpc.server echo:say")
	missing := f.span(t, "ldrpc.server echo:missing")
	if say.Parent().SpanID() != missing.Parent().SpanID() {
		t.Fatal("calls of one batch should share the request span as parent")
	}
}
