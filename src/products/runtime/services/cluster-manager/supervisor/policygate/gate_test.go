package policygate

import (
	"context"
	"errors"
	"net"
	"sync/atomic"
	"syscall"
	"testing"
	"time"
)

// policyAfter simulates a CNI that starts denying connections after n attempts.
func policyAfter(n int32) (func(context.Context, string, string) (net.Conn, error), *atomic.Int32) {
	var calls atomic.Int32
	return func(ctx context.Context, network, address string) (net.Conn, error) {
		if calls.Add(1) <= n {
			client, server := net.Pipe()
			_ = server.Close()
			return client, nil
		}
		return nil, syscall.ECONNREFUSED
	}, &calls
}

func TestClosedOnFirstProbe(t *testing.T) {
	dial, calls := policyAfter(0)
	g := &Gate{Targets: []string{"10.0.0.1:443"}, Dial: dial}
	res, err := g.Wait(context.Background())
	if err != nil || !res.Closed || res.Attempts != 1 || calls.Load() != 1 {
		t.Fatalf("got %+v, %v after %d dials", res, err, calls.Load())
	}
}

func TestWaitsUntilPolicyApplies(t *testing.T) {
	dial, _ := policyAfter(3)
	g := &Gate{Targets: []string{"10.0.0.1:443"}, Interval: time.Millisecond, Dial: dial}
	res, err := g.Wait(context.Background())
	if err != nil || !res.Closed || res.Attempts != 4 {
		t.Fatalf("got %+v, %v", res, err)
	}
}

func TestEveryTargetMustBeClosed(t *testing.T) {
	g := &Gate{
		Targets:  []string{"10.0.0.1:443", "10.0.0.2:52240"},
		Timeout:  20 * time.Millisecond,
		Interval: time.Millisecond,
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			if address == "10.0.0.2:52240" {
				client, server := net.Pipe()
				_ = server.Close()
				return client, nil
			}
			return nil, syscall.ECONNREFUSED
		},
	}
	res, err := g.Wait(context.Background())
	if err != nil || res.Closed || res.Open != "10.0.0.2:52240" || res.Attempts < 2 {
		t.Fatalf("got %+v, %v", res, err)
	}
}

func TestDroppedConnectionsCountAsClosed(t *testing.T) {
	g := &Gate{
		Targets:        []string{"10.0.0.1:443"},
		AttemptTimeout: 20 * time.Millisecond,
		Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
			<-ctx.Done()
			return nil, ctx.Err()
		},
	}
	started := time.Now()
	res, err := g.Wait(context.Background())
	if err != nil || !res.Closed || time.Since(started) > time.Second {
		t.Fatalf("got %+v, %v after %s", res, err, time.Since(started))
	}
}

func TestCancelledContextIsNotClosed(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	g := &Gate{Targets: []string{"10.0.0.1:443"}, Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
		return nil, ctx.Err()
	}}
	if res, err := g.Wait(ctx); !errors.Is(err, context.Canceled) || res.Closed {
		t.Fatalf("got %+v, %v", res, err)
	}
}

func TestNoTargetsFails(t *testing.T) {
	if res, err := (&Gate{}).Wait(context.Background()); err == nil || res.Closed {
		t.Fatalf("got %+v, %v", res, err)
	}
}

func TestRealListener(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	g := &Gate{Targets: []string{ln.Addr().String()}, Timeout: 30 * time.Millisecond, Interval: 5 * time.Millisecond}
	if res, err := g.Wait(context.Background()); err != nil || res.Closed {
		t.Fatalf("listening: got %+v, %v", res, err)
	}

	_ = ln.Close()
	if res, err := g.Wait(context.Background()); err != nil || !res.Closed || res.Attempts != 1 {
		t.Fatalf("closed: got %+v, %v", res, err)
	}
}

func TestParse(t *testing.T) {
	if m, err := ParseMode(""); err != nil || m != ModeEnforce {
		t.Errorf("empty mode: %q, %v", m, err)
	}
	if _, err := ParseMode("strict"); err == nil {
		t.Error("unknown mode accepted")
	}

	targets, err := ParseTargets(" 10.43.0.1:443, [fd00::1]:6443 ,")
	if err != nil || len(targets) != 2 || targets[0] != "10.43.0.1:443" || targets[1] != "[fd00::1]:6443" {
		t.Errorf("targets %v, %v", targets, err)
	}
	for _, bad := range []string{"kubernetes.default.svc:443", "10.43.0.1", "10.43.0.1:0"} {
		if _, err := ParseTargets(bad); err == nil {
			t.Errorf("%q accepted", bad)
		}
	}
}
