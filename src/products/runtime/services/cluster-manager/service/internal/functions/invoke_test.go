package functions

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/rpc/functionruntimerpc"
)

func TestMapInvokeError(t *testing.T) {
	cases := []struct {
		name  string
		err   error
		check func(error) bool
	}{
		{"transport", errors.New("connection refused"), func(err error) bool { return errors.Is(err, ErrUnavailable) }},
		{"gateway", ldrpc.NewError(http.StatusBadGateway, "bad_gateway", "upstream"), func(err error) bool { return errors.Is(err, ErrUnavailable) }},
		{"timeout", ldrpc.NewError(http.StatusGatewayTimeout, "timeout", "slow"), func(err error) bool { return errors.Is(err, ErrUnavailable) }},
		{"route missing", ldrpc.NewError(http.StatusNotFound, "not_found", "no route"), func(err error) bool { return errors.Is(err, ErrUnavailable) }},
		{"unauthorized", functionruntimerpc.ErrInvocationUnauthorized("audience_mismatch"), func(err error) bool {
			var u *UnauthorizedError
			return errors.As(err, &u) && u.Reason == "audience_mismatch"
		}},
		{"invalid input", ldrpc.NewError(http.StatusBadRequest, "invalid_data", "bad"), func(err error) bool {
			e, ok := ldrpc.AsError(err)
			return ok && e.Code == "invalid_data" && !errors.Is(err, ErrUnavailable)
		}},
	}
	for _, c := range cases {
		if got := mapInvokeError(c.err); !c.check(got) {
			t.Errorf("%s: unexpected mapping %v", c.name, got)
		}
	}
}

func TestRPCInvokerRoutesByHostAndNeverRetries(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Host != "fn-abc.metorial-runtime-functions.svc.cluster.local" {
			t.Errorf("unexpected host %q", r.Host)
		}
		if r.Header.Get(hostHeader) != "" {
			t.Error("routing header leaked to the upstream")
		}
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()

	inv := NewRPCInvoker(nil)
	_, err := inv.Invoke(context.Background(), Target{URL: srv.URL + "/rpc", Host: "fn-abc.metorial-runtime-functions.svc.cluster.local"}, &InvokeInput{
		VersionID:   "v1",
		PayloadJSON: `{}`,
		DeadlineMs:  1000,
	}, 5*time.Second)
	if err := mapInvokeError(err); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("expected ErrUnavailable, got %v", err)
	}
	if calls != 1 {
		t.Fatalf("invoke was attempted %d times", calls)
	}
}
