package grpc_util

import (
	"context"
	"testing"
	"time"

	"github.com/getsentry/sentry-go"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type captureTransport struct {
	events []*sentry.Event
}

func (t *captureTransport) Configure(sentry.ClientOptions) {}
func (t *captureTransport) SendEvent(event *sentry.Event)  { t.events = append(t.events, event) }
func (t *captureTransport) Flush(time.Duration) bool       { return true }
func (t *captureTransport) Close()                         {}

func (t *captureTransport) FlushWithContext(context.Context) bool { return true }

// captureSentry points Sentry at an in-memory transport for the duration of a
// test, so we can assert on what would have been reported.
func captureSentry(t *testing.T) *captureTransport {
	t.Helper()

	transport := &captureTransport{}
	if err := sentry.Init(sentry.ClientOptions{Dsn: "", Transport: transport}); err != nil {
		t.Fatalf("init sentry: %v", err)
	}

	return transport
}

func runInterceptor(err error) error {
	_, got := LoggingInterceptor(
		context.Background(),
		nil,
		&grpc.UnaryServerInfo{FullMethod: "/rpc.CodeBucket/ExportBucketToGithub"},
		func(context.Context, any) (any, error) { return nil, err },
	)
	return got
}

// A precondition failure is the caller's to fix. Reporting those pages on other
// people's bugs and buries the ones that are ours.
func TestLoggingInterceptorDoesNotReportCallerFaults(t *testing.T) {
	for _, code := range []codes.Code{
		codes.FailedPrecondition,
		codes.InvalidArgument,
		codes.NotFound,
		codes.PermissionDenied,
		codes.Unauthenticated,
		codes.Unavailable,
		codes.DeadlineExceeded,
		codes.ResourceExhausted,
	} {
		transport := captureSentry(t)

		runInterceptor(status.Error(code, "nope"))

		if len(transport.events) != 0 {
			t.Errorf("%s was reported to Sentry", code)
		}
	}
}

func TestLoggingInterceptorReportsServerFaults(t *testing.T) {
	for _, code := range []codes.Code{codes.Internal, codes.Unknown, codes.DataLoss} {
		transport := captureSentry(t)

		runInterceptor(status.Error(code, "boom"))

		if len(transport.events) != 1 {
			t.Errorf("%s produced %d Sentry events, want 1", code, len(transport.events))
		}
	}
}

func TestLoggingInterceptorPassesResponsesThrough(t *testing.T) {
	transport := captureSentry(t)

	resp, err := LoggingInterceptor(
		context.Background(),
		nil,
		&grpc.UnaryServerInfo{FullMethod: "/rpc.CodeBucket/GetBucketFile"},
		func(context.Context, any) (any, error) { return "payload", nil },
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp != "payload" {
		t.Fatalf("response = %v, want payload", resp)
	}
	if len(transport.events) != 0 {
		t.Fatal("a successful call was reported to Sentry")
	}
}

func TestLoggingInterceptorReturnsTheOriginalError(t *testing.T) {
	captureSentry(t)

	want := status.Error(codes.FailedPrecondition, "file too large")
	if got := runInterceptor(want); got != want {
		t.Fatalf("error = %v, want the handler's own error", got)
	}
}
