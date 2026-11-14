package gateway_test

import (
	"bufio"
	"context"
	"errors"
	"io"
	"net"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/auth/authtest"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/gateway"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/gateway/gatewaytest"
)

func echoServer(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = l.Close() })

	go func() {
		for {
			conn, err := l.Accept()
			if err != nil {
				return
			}
			go func() {
				defer conn.Close()
				line, _ := bufio.NewReader(conn).ReadString('\n')
				_, _ = conn.Write([]byte("echo:" + line))
			}()
		}
	}()
	return l.Addr().(*net.TCPAddr).Port
}

func TestTunnelAndResolve(t *testing.T) {
	signer := authtest.NewSigner()
	keys, _ := egress.ParseKeySet(authtest.KeysJSON(signer))
	fake := gatewaytest.New(keys, map[string][]string{"allowed.test": {"127.0.0.1"}, "denied.test": {"127.0.0.1"}})
	defer fake.Close()

	port := echoServer(t)
	grant := signer.EgressGrant(authtest.Invocation{ID: "inv_1", VersionID: "fnv", Policy: &policy.Policy{Hosts: []policy.HostRule{{Pattern: "allowed.test"}}}})

	client, err := gateway.New(fake.Addr, "", "")
	if err != nil {
		t.Fatal(err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tunnel, err := client.Dial(ctx, grant, "allowed.test", port)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tunnel.Write([]byte("hello\n")); err != nil {
		t.Fatal(err)
	}
	_ = tunnel.CloseWrite()
	got, err := io.ReadAll(tunnel)
	if err != nil || string(got) != "echo:hello\n" {
		t.Fatalf("got %q, %v", got, err)
	}
	_ = tunnel.Close()

	_, err = client.Dial(ctx, grant, "denied.test", port)
	var dialErr *gateway.DialError
	if !errors.As(err, &dialErr) || dialErr.Status != 403 || dialErr.Reason != "policy" {
		t.Fatalf("expected policy denial, got %v", err)
	}

	_, err = client.Dial(ctx, "not-a-grant", "allowed.test", port)
	if !errors.As(err, &dialErr) || dialErr.Status != 407 {
		t.Fatalf("expected 407, got %v", err)
	}

	addrs, err := client.Resolve(ctx, grant, "allowed.test")
	if err != nil || len(addrs) != 1 || addrs[0] != "127.0.0.1" {
		t.Fatalf("resolve: %v %v", addrs, err)
	}
	addrs, err = client.Resolve(ctx, grant, "denied.test")
	if err != nil || len(addrs) != 0 {
		t.Fatalf("resolve denied: %v %v", addrs, err)
	}

	tunnel, err = client.Dial(ctx, grant, "127.0.0.1", port)
	if err != nil {
		t.Fatalf("IP previously resolved for an allowed host should be allowed: %v", err)
	}
	_ = tunnel.Close()
}
