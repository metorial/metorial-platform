// Package ldrpcotel instruments ldrpc servers and clients with OpenTelemetry: otelhttp around
// the server handler and client transport (W3C trace context in and out), one span per RPC
// call on both sides, and structured call logs from the server's OnCall/OnError hooks.
package ldrpcotel

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

const instrumentationName = "github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc/otel"

type Options struct {
	// Each defaults to the global provider registered with go.opentelemetry.io/otel. The
	// global propagator is a no-op until one is set, e.g. propagation.TraceContext{}.
	TracerProvider trace.TracerProvider
	MeterProvider  metric.MeterProvider
	Propagator     propagation.TextMapPropagator

	// Logger receives one record per server call (Info, or Error for 5xx) and one per handler
	// failure. Nil disables logging.
	Logger *slog.Logger
}

func (o Options) tracer() trace.Tracer {
	provider := o.TracerProvider
	if provider == nil {
		provider = otel.GetTracerProvider()
	}
	return provider.Tracer(instrumentationName)
}

func (o Options) httpOptions() []otelhttp.Option {
	var opts []otelhttp.Option
	if o.TracerProvider != nil {
		opts = append(opts, otelhttp.WithTracerProvider(o.TracerProvider))
	}
	if o.MeterProvider != nil {
		opts = append(opts, otelhttp.WithMeterProvider(o.MeterProvider))
	}
	if o.Propagator != nil {
		opts = append(opts, otelhttp.WithPropagators(o.Propagator))
	}
	return opts
}

// Handler wraps the HTTP handler serving ldrpc (the *ldrpc.Server itself or the mux it is
// mounted on) so incoming trace context is extracted and each request gets a server span.
func Handler(h http.Handler, o Options) http.Handler {
	return otelhttp.NewHandler(h, "ldrpc", append(o.httpOptions(),
		otelhttp.WithSpanNameFormatter(func(operation string, r *http.Request) string {
			return r.Method + " " + operation
		}),
	)...)
}

// Instrument adds a span per call to srv, a child of the request span from Handler.
func Instrument(srv *ldrpc.Server, o Options) {
	tracer := o.tracer()
	srv.Use(func(next ldrpc.HandlerFunc) ldrpc.HandlerFunc {
		return func(ctx context.Context, payload json.RawMessage) (any, error) {
			info := ldrpc.CallInfoFromContext(ctx)
			ctx, span := tracer.Start(ctx, "ldrpc.server "+info.Method,
				trace.WithAttributes(callAttributes(info.Method)...),
				trace.WithAttributes(attribute.String("ldrpc.request_id", info.RequestID), attribute.String("ldrpc.call_id", info.CallID)),
			)
			defer span.End()

			out, err := next(ctx, payload)
			if err != nil {
				status := errorStatus(err)
				span.SetAttributes(attribute.Int("ldrpc.status", status))
				if status >= 500 {
					span.RecordError(err)
					span.SetStatus(codes.Error, err.Error())
				}
			}
			return out, err
		}
	})
}

// ServerOptions adds structured logging to opts' OnCall and OnError hooks, keeping any hooks
// already set.
func ServerOptions(opts ldrpc.ServerOptions, o Options) ldrpc.ServerOptions {
	if o.Logger == nil {
		return opts
	}

	onCall, onError := opts.OnCall, opts.OnError
	opts.OnCall = func(ctx context.Context, call *ldrpc.CallInfo, status int, duration time.Duration) {
		level := slog.LevelInfo
		if status >= 500 {
			level = slog.LevelError
		}
		attrs := append(logAttributes(ctx, call), slog.Int("status", status), slog.Duration("duration", duration))
		o.Logger.LogAttrs(ctx, level, "ldrpc call", attrs...)
		if onCall != nil {
			onCall(ctx, call, status, duration)
		}
	}
	opts.OnError = func(ctx context.Context, call *ldrpc.CallInfo, err error) {
		attrs := append(logAttributes(ctx, call), slog.String("error", err.Error()))
		o.Logger.LogAttrs(ctx, slog.LevelError, "ldrpc call failed", attrs...)
		if onError != nil {
			onError(ctx, call, err)
		}
	}
	return opts
}

// ClientOptions wraps opts' transport with otelhttp, which injects trace context into every
// attempt, and adds a span per call that covers all of its retries.
func ClientOptions(opts ldrpc.ClientOptions, o Options) ldrpc.ClientOptions {
	base := http.DefaultClient
	if opts.HTTPClient != nil {
		base = opts.HTTPClient
	}
	client := *base
	transport := client.Transport
	if transport == nil {
		transport = http.DefaultTransport
	}
	client.Transport = otelhttp.NewTransport(transport, o.httpOptions()...)
	opts.HTTPClient = &client

	tracer := o.tracer()
	intercept := opts.Intercept
	opts.Intercept = func(ctx context.Context, methods []string, next func(ctx context.Context) error) error {
		name := "ldrpc.client batch"
		attrs := []attribute.KeyValue{attribute.String("rpc.system", "ldrpc"), attribute.StringSlice("ldrpc.methods", methods)}
		if len(methods) == 1 {
			name = "ldrpc.client " + methods[0]
			attrs = callAttributes(methods[0])
		}

		ctx, span := tracer.Start(ctx, name, trace.WithAttributes(attrs...))
		defer span.End()

		run := next
		if intercept != nil {
			run = func(ctx context.Context) error { return intercept(ctx, methods, next) }
		}

		err := run(ctx)
		if err != nil {
			span.SetAttributes(attribute.Int("ldrpc.status", errorStatus(err)))
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		}
		return err
	}
	return opts
}

func callAttributes(method string) []attribute.KeyValue {
	attrs := []attribute.KeyValue{attribute.String("rpc.system", "ldrpc"), attribute.String("rpc.method", method)}
	if i := strings.LastIndex(method, ":"); i > 0 {
		attrs = append(attrs, attribute.String("rpc.service", method[:i]))
	}
	return attrs
}

func logAttributes(ctx context.Context, call *ldrpc.CallInfo) []slog.Attr {
	attrs := []slog.Attr{
		slog.String("method", call.Method),
		slog.String("request_id", call.RequestID),
		slog.String("call_id", call.CallID),
		slog.String("ip", call.IP),
	}
	if caller, ok := call.Auth.(fmt.Stringer); ok {
		attrs = append(attrs, slog.String("caller", caller.String()))
	}
	if sc := trace.SpanContextFromContext(ctx); sc.IsValid() {
		attrs = append(attrs, slog.String("trace_id", sc.TraceID().String()), slog.String("span_id", sc.SpanID().String()))
	}
	return attrs
}

func errorStatus(err error) int {
	if rpcErr, ok := ldrpc.AsError(err); ok {
		return rpcErr.Status
	}
	var issues ldrpc.ValidationErrors
	if errors.As(err, &issues) {
		return http.StatusBadRequest
	}
	return http.StatusInternalServerError
}
