package functions

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/functionruntimerpc"
)

type (
	InvokeInput  = functionruntimerpc.InvokeInput
	InvokeOutput = functionruntimerpc.InvokeOutput
)

// Target is where an invocation is sent: either the Knative Service's own cluster-local URL, or
// a gateway URL with the Service's host in the Host header.
type Target struct {
	URL  string
	Host string
}

type Invoker interface {
	Invoke(ctx context.Context, target Target, in *InvokeInput, timeout time.Duration) (*InvokeOutput, error)
}

// RPCInvoker calls the supervisor's function-runtime `invoke` method. The generated client never
// retries it.
type RPCInvoker struct {
	HTTP *http.Client
}

func NewRPCInvoker(transport http.RoundTripper) *RPCInvoker {
	if transport == nil {
		transport = http.DefaultTransport
	}
	return &RPCInvoker{HTTP: &http.Client{Transport: hostOverride{transport}}}
}

func (i *RPCInvoker) Invoke(ctx context.Context, target Target, in *InvokeInput, timeout time.Duration) (*InvokeOutput, error) {
	client, err := functionruntimerpc.NewClient(target.URL, ldrpc.ClientOptions{
		HTTPClient:   i.HTTP,
		DirectRoute:  true,
		DisableRetry: true,
		Timeout:      timeout,
	})
	if err != nil {
		return nil, err
	}

	opts := []ldrpc.CallOption{ldrpc.WithTimeout(timeout)}
	if target.Host != "" {
		opts = append(opts, ldrpc.WithHeader(hostHeader, target.Host))
	}
	return client.Invoke(ctx, in, opts...)
}

const hostHeader = "X-Metorial-Route-Host"

type hostOverride struct {
	next http.RoundTripper
}

func (h hostOverride) RoundTrip(r *http.Request) (*http.Response, error) {
	host := r.Header.Get(hostHeader)
	if host == "" {
		return h.next.RoundTrip(r)
	}
	r = r.Clone(r.Context())
	r.Host = host
	r.Header.Del(hostHeader)
	return h.next.RoundTrip(r)
}

// mapInvokeError keeps the supervisor's own client errors (bad input, rejected token) and turns
// everything else — timeouts, refused connections, gateway errors — into ErrUnavailable.
func mapInvokeError(err error) error {
	rpcErr, ok := ldrpc.AsError(err)
	if !ok {
		return fmt.Errorf("%w: %w", ErrUnavailable, err)
	}

	switch {
	case rpcErr.Code == functionruntimerpc.CodeInvocationUnauthorized || rpcErr.Code == "unauthorized":
		reason := rpcErr.Reason
		if reason == "" {
			reason = rpcErr.Message
		}
		return &UnauthorizedError{Reason: reason}
	case rpcErr.Status >= 400 && rpcErr.Status < 500 && rpcErr.Code != "not_found":
		return rpcErr
	default:
		return fmt.Errorf("%w: %w", ErrUnavailable, err)
	}
}
