package gateway

import (
	"crypto/tls"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
)

func TestTunnelAllowedPublicDestination(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	env.route("93.184.216.34:443", startEcho(t))
	client := env.tunnelClient()

	tn := env.openTunnel(client, "example.test:443", env.grant())
	if tn.status != http.StatusOK {
		t.Fatalf("status %d", tn.status)
	}
	if got := tn.roundTrip(t, "ping"); got != "ping" {
		t.Fatalf("echo %q", got)
	}

	observation := env.requireObservation("example.test", "93.184.216.34", 443, DecisionAllowed)
	if observation.TenantID != "ten_1" || observation.FunctionID != "fn_1" || observation.EnclaveID != "enc_1" ||
		observation.EffectiveFunctionID != "fn_eff_1" || observation.Source != egress.SourceLambda {
		t.Fatalf("attribution %+v", observation)
	}
}

func TestTunnelIPv6AndIPLiteral(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	env.route("[2606:2800:220:1::10]:443", startEcho(t))
	env.route("93.184.216.34:8443", startEcho(t))
	client := env.tunnelClient()
	grant := env.grant()

	if tn := env.openTunnel(client, "v6.example.test:443", grant); tn.status != http.StatusOK || tn.roundTrip(t, "six") != "six" {
		t.Fatalf("v6 status %d", tn.status)
	}
	if tn := env.openTunnel(client, "93.184.216.34:8443", grant); tn.status != http.StatusOK || tn.roundTrip(t, "lit") != "lit" {
		t.Fatalf("literal status %d", tn.status)
	}
	env.requireObservation("93.184.216.34", "93.184.216.34", 8443, DecisionAllowed)
}

func TestIPv4MappedAnswersAreRecordedAsIPv4(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	env.route("93.184.216.34:443", startEcho(t))
	client := env.tunnelClient()
	grant := env.grant()

	if tn := env.openTunnel(client, "mapped.test:443", grant); tn.status != http.StatusOK || tn.roundTrip(t, "v4") != "v4" {
		t.Fatalf("mapped status %d", tn.status)
	}
	if tn := env.openTunnel(client, "[::ffff:93.184.216.34]:443", grant); tn.status != http.StatusOK {
		t.Fatalf("mapped literal status %d", tn.status)
	}
	if tn := env.openTunnel(client, "mapped.meta.test:80", grant); tn.status != http.StatusForbidden {
		t.Fatalf("mapped metadata status %d", tn.status)
	}
	if status, addrs := env.resolve(client, "mapped.test", grant); status != http.StatusOK || !slices.Equal(addrs, []string{"93.184.216.34"}) {
		t.Fatalf("resolve %d %v", status, addrs)
	}

	env.requireObservation("mapped.test", "93.184.216.34", 443, DecisionAllowed)
	env.requireObservation("::ffff:93.184.216.34", "93.184.216.34", 443, DecisionAllowed)
	env.requireObservation("mapped.meta.test", "169.254.169.254", 80, DecisionDenied)
	for _, observation := range env.observations() {
		if strings.Contains(observation.IP, "::ffff:") {
			t.Fatalf("mapped observation %+v", observation)
		}
	}
}

func TestTunnelRejectsInvalidGrants(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	client := env.tunnelClient()

	expired := env.newGrant()
	expired.IssuedAt = time.Now().Add(-time.Hour).Unix()
	expired.ExpiresAt = time.Now().Add(-10 * time.Minute).Unix()

	otherSeed := make([]byte, 32)
	otherKey, _ := egress.NewSigningKey(otherSeed, "test")
	forged, _ := egress.MintGrant(otherKey, *env.newGrant())

	for name, grant := range map[string]string{
		"missing": "",
		"garbage": "not-a-jwt",
		"expired": env.mint(expired),
		"forged":  forged,
	} {
		t.Run(name, func(t *testing.T) {
			if tn := env.openTunnel(client, "example.test:443", grant); tn.status != http.StatusProxyAuthRequired {
				t.Fatalf("status %d", tn.status)
			}
			if status, _ := env.resolve(client, "example.test", grant); status != http.StatusProxyAuthRequired {
				t.Fatalf("resolve status %d", status)
			}
		})
	}
}

func TestTunnelRejectsBadTargets(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	client := env.tunnelClient()
	grant := env.grant()

	for _, target := range []string{"example.test:0", "example.test:70000", "example.test:https", ":443"} {
		if tn := env.openTunnel(client, target, grant); tn.status != http.StatusBadRequest {
			t.Fatalf("%s: status %d", target, tn.status)
		}
	}
}

func TestTunnelDenials(t *testing.T) {
	explicitPublic := &policy.Policy{Entries: []policy.Entry{{CIDR: "1.1.1.0/24"}}}
	everything := &policy.Policy{Entries: []policy.Entry{{CIDR: "0.0.0.0/0"}, {CIDR: "::/0"}}}
	metadataEntry := &policy.Policy{Entries: []policy.Entry{{CIDR: "169.254.0.0/16"}}}
	loopbackEntry := &policy.Policy{Entries: []policy.Entry{{CIDR: "127.0.0.0/8"}}}
	privateEntry := &policy.Policy{Entries: []policy.Entry{{CIDR: "10.0.0.0/8"}}}

	cases := []struct {
		name          string
		allowInternal bool
		grant         []grantOption
		target        string
		reason        DenyReason
		observedIP    string
	}{
		{name: "internal without setting", target: "internal.test:443", reason: DenyInternalDisabled, observedIP: "10.20.0.5"},
		{name: "internal with unrestricted policy", target: "internal.test:443", grant: []grantOption{withPolicy(everything)}, reason: DenyInternalDisabled, observedIP: "10.20.0.5"},
		{name: "internal with allowAll on-prem", allowInternal: true, target: "internal.test:443", grant: []grantOption{withAllowAll()}, reason: DenyPolicy, observedIP: "10.20.0.5"},
		{name: "public outside explicit policy", target: "example.test:443", grant: []grantOption{withPolicy(explicitPublic)}, reason: DenyPolicy, observedIP: "93.184.216.34"},
		{name: "metadata no policy", target: "metadata.test:80", reason: DenyHardDeny, observedIP: "169.254.169.254"},
		{name: "metadata allowAll", target: "169.254.169.254:80", grant: []grantOption{withAllowAll()}, reason: DenyHardDeny, observedIP: "169.254.169.254"},
		{name: "metadata explicit entry on-prem", allowInternal: true, target: "169.254.169.254:80", grant: []grantOption{withPolicy(metadataEntry)}, reason: DenyHardDeny, observedIP: "169.254.169.254"},
		{name: "loopback explicit entry on-prem", allowInternal: true, target: "127.0.0.1:9090", grant: []grantOption{withPolicy(loopbackEntry)}, reason: DenyHardDeny, observedIP: "127.0.0.1"},
		{name: "loopback v6 allowAll", target: "[::1]:9090", grant: []grantOption{withAllowAll()}, reason: DenyHardDeny, observedIP: "::1"},
		{name: "configured cluster cidr with private entry", allowInternal: true, target: "cluster.test:443", grant: []grantOption{withPolicy(privateEntry)}, reason: DenyHardDeny, observedIP: "10.42.1.7"},
		{name: "configured cluster cidr allowAll", target: "cluster.test:443", grant: []grantOption{withAllowAll()}, reason: DenyHardDeny, observedIP: "10.42.1.7"},
		{name: "nat64 of private address", target: "nat64.test:443", grant: []grantOption{withPolicy(everything)}, reason: DenyInternalDisabled, observedIP: "64:ff9b::a14:5"},
		{name: "nat64 literal of metadata", target: "[64:ff9b::a9fe:a9fe]:80", grant: []grantOption{withAllowAll()}, reason: DenyHardDeny, observedIP: "64:ff9b::a9fe:a9fe"},
		{name: "mapped literal of private address", target: "[::ffff:10.20.0.5]:443", reason: DenyInternalDisabled, observedIP: "10.20.0.5"},
		{name: "mapped literal of loopback", target: "[::ffff:127.0.0.1]:443", grant: []grantOption{withAllowAll()}, reason: DenyHardDeny, observedIP: "127.0.0.1"},
		{name: "6to4 of private address", target: "[2002:a14:5::1]:443", grant: []grantOption{withPolicy(everything)}, reason: DenyInternalDisabled, observedIP: "2002:a14:5::1"},
		{name: "teredo", target: "[2001:0:4136:e378::1]:443", grant: []grantOption{withAllowAll()}, reason: DenyHardDeny, observedIP: "2001:0:4136:e378::1"},
		{name: "unknown host", target: "missing.test:443", reason: DenyNoAddress},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			env := newTestEnv(t, envOptions{allowInternal: tc.allowInternal, hardDeny: []string{"10.42.0.0/16"}})
			env.route("10.20.0.5:443", startEcho(t))
			env.route("10.42.1.7:443", startEcho(t))
			env.route("169.254.169.254:80", startEcho(t))
			client := env.tunnelClient()

			tn := env.openTunnel(client, tc.target, env.grant(tc.grant...))
			if tn.status != http.StatusForbidden {
				t.Fatalf("status %d", tn.status)
			}
			if got := tn.header.Get(ReasonHeader); got != string(tc.reason) {
				t.Fatalf("reason %q, want %q", got, tc.reason)
			}
			if tc.observedIP != "" {
				host, port := splitTarget(t, tc.target)
				env.requireObservation(host, tc.observedIP, port, DecisionDenied)
			}
			for _, observation := range env.observations() {
				if observation.Decision == DecisionAllowed {
					t.Fatalf("unexpected allowed observation %+v", observation)
				}
			}
		})
	}
}

func TestTunnelSkipsDeniedAddressesAndDialsFirstAllowed(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	env.route("10.20.0.5:443", startEcho(t))
	env.route("93.184.216.34:443", startEcho(t))
	client := env.tunnelClient()

	tn := env.openTunnel(client, "multi.test:443", env.grant())
	if tn.status != http.StatusOK || tn.roundTrip(t, "x") != "x" {
		t.Fatalf("status %d", tn.status)
	}
	env.requireObservation("multi.test", "10.20.0.5", 443, DecisionDenied)
	env.requireObservation("multi.test", "93.184.216.34", 443, DecisionAllowed)
}

func TestTunnelInternalDestinationOnPrem(t *testing.T) {
	env := newTestEnv(t, envOptions{allowInternal: true})
	env.route("10.20.0.5:443", startEcho(t))
	client := env.tunnelClient()

	gitlab := &policy.Policy{Entries: []policy.Entry{{CIDR: "10.20.0.0/16", PortRange: &policy.PortRange{From: 443, To: 443}}}}
	grant := env.grant(withPolicy(gitlab))

	if tn := env.openTunnel(client, "internal.test:443", grant); tn.status != http.StatusOK || tn.roundTrip(t, "git") != "git" {
		t.Fatalf("status %d", tn.status)
	}
	if tn := env.openTunnel(client, "internal.test:22", grant); tn.status != http.StatusForbidden || tn.header.Get(ReasonHeader) != string(DenyPolicy) {
		t.Fatalf("port 22: status %d reason %q", tn.status, tn.header.Get(ReasonHeader))
	}
	if tn := env.openTunnel(client, "example.test:443", grant); tn.status != http.StatusForbidden {
		t.Fatalf("public outside policy: status %d", tn.status)
	}
}

func TestTunnelDialFailure(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	client := env.tunnelClient()

	if tn := env.openTunnel(client, "down.example.test:443", env.grant()); tn.status != http.StatusBadGateway {
		t.Fatalf("status %d", tn.status)
	}
	if observation := env.findObservation("down.example.test", "93.184.216.99", 443, DecisionAllowed); observation != nil {
		t.Fatalf("recorded failed dial %+v", observation)
	}
}

func TestResolveFiltersAndRemembersAddresses(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	env.route("93.184.216.40:443", startEcho(t))
	env.route("93.184.216.40:80", startEcho(t))
	client := env.tunnelClient()

	hosts := &policy.Policy{Entries: []policy.Entry{}, Hosts: []policy.HostRule{
		{Pattern: "api.example.test", Ports: []int{443}},
		{Pattern: "*.rebind.test"},
	}}
	grant := env.grant(withPolicy(hosts))

	status, addrs := env.resolve(client, "api.example.test", grant)
	if status != http.StatusOK || !slices.Equal(addrs, []string{"93.184.216.40"}) {
		t.Fatalf("resolve: %d %v", status, addrs)
	}

	if tn := env.openTunnel(client, "93.184.216.40:443", grant); tn.status != http.StatusOK || tn.roundTrip(t, "mem") != "mem" {
		t.Fatalf("remembered CONNECT: status %d", tn.status)
	}
	env.requireObservation("api.example.test", "93.184.216.40", 443, DecisionAllowed)

	if tn := env.openTunnel(client, "93.184.216.40:80", grant); tn.status != http.StatusForbidden {
		t.Fatalf("host rule port mismatch: status %d", tn.status)
	}
	if tn := env.openTunnel(client, "93.184.216.40:443", env.grant(withPolicy(hosts))); tn.status != http.StatusForbidden {
		t.Fatalf("memory leaked to another grant: status %d", tn.status)
	}
	if tn := env.openTunnel(client, "example.test:443", grant); tn.status != http.StatusForbidden {
		t.Fatalf("unlisted host: status %d", tn.status)
	}
}

func TestResolveDNSRebindingCannotOpenInternalRanges(t *testing.T) {
	for _, allowInternal := range []bool{false, true} {
		env := newTestEnv(t, envOptions{allowInternal: allowInternal})
		env.route("10.20.0.5:443", startEcho(t))
		client := env.tunnelClient()

		hosts := &policy.Policy{Entries: []policy.Entry{}, Hosts: []policy.HostRule{{Pattern: "*.rebind.test"}}}
		grant := env.grant(withPolicy(hosts))

		status, addrs := env.resolve(client, "evil.rebind.test", grant)
		if status != http.StatusOK || len(addrs) != 0 {
			t.Fatalf("allowInternal=%v resolve: %d %v", allowInternal, status, addrs)
		}
		env.requireObservation("evil.rebind.test", "10.20.0.5", 0, DecisionDenied)
		env.requireObservation("evil.rebind.test", "127.0.0.1", 0, DecisionDenied)

		if tn := env.openTunnel(client, "evil.rebind.test:443", grant); tn.status != http.StatusForbidden {
			t.Fatalf("allowInternal=%v hostname CONNECT: status %d", allowInternal, tn.status)
		}
		if tn := env.openTunnel(client, "10.20.0.5:443", grant); tn.status != http.StatusForbidden {
			t.Fatalf("allowInternal=%v literal CONNECT: status %d", allowInternal, tn.status)
		}
	}
}

func TestResolveUnknownHostReturnsEmpty(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	client := env.tunnelClient()

	status, addrs := env.resolve(client, "missing.test", env.grant())
	if status != http.StatusOK || addrs == nil || len(addrs) != 0 {
		t.Fatalf("resolve: %d %#v", status, addrs)
	}
}

func TestTunnelIdleTimeoutClosesStream(t *testing.T) {
	env := newTestEnv(t, envOptions{idleTimeout: 150 * time.Millisecond})
	env.route("93.184.216.34:443", startEcho(t))
	client := env.tunnelClient()

	tn := env.openTunnel(client, "example.test:443", env.grant())
	if tn.status != http.StatusOK {
		t.Fatalf("status %d", tn.status)
	}

	done := make(chan error, 1)
	go func() {
		_, err := io.ReadAll(tn.reader)
		done <- err
	}()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("idle tunnel stayed open")
	}
}

func TestTunnelHalfCloseStillDeliversResponse(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	env.route("93.184.216.34:443", startEcho(t))
	client := env.tunnelClient()

	tn := env.openTunnel(client, "example.test:443", env.grant())
	if _, err := tn.writer.Write([]byte("bye")); err != nil {
		t.Fatal(err)
	}
	_ = tn.writer.Close()

	body, err := io.ReadAll(tn.reader)
	if err != nil || string(body) != "bye" {
		t.Fatalf("body %q err %v", body, err)
	}
}

func TestTunnelRequiresHTTP2(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	gatewayURL, _ := url.Parse(env.tunnelURL)
	conn, reader := dialRaw(t, gatewayURL.Host)

	_, _ = conn.Write([]byte("CONNECT example.test:443 HTTP/1.1\r\nHost: example.test:443\r\n" + GrantHeader + ": " + env.grant() + "\r\n\r\n"))
	response, err := http.ReadResponse(reader, nil)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != http.StatusHTTPVersionNotSupported {
		t.Fatalf("status %d", response.StatusCode)
	}
}

func TestTunnelOverTLS(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	env.route("93.184.216.34:443", startEcho(t))

	server := httptest.NewUnstartedServer(&TunnelServer{Core: env.core, IdleTimeout: time.Minute})
	server.EnableHTTP2 = true
	server.StartTLS()
	t.Cleanup(server.Close)
	env.tunnelURL = server.URL

	client := server.Client()
	client.Transport.(*http.Transport).TLSClientConfig.MinVersion = tls.VersionTLS12

	tn := env.openTunnel(client, "example.test:443", env.grant())
	if tn.status != http.StatusOK || tn.roundTrip(t, "tls") != "tls" {
		t.Fatalf("status %d", tn.status)
	}

	healthz, err := client.Get(server.URL + "/healthz")
	if err != nil || healthz.StatusCode != http.StatusOK || healthz.ProtoMajor != 2 {
		t.Fatalf("healthz %v %v", healthz, err)
	}
	_ = healthz.Body.Close()
}

func TestTunnelGrantExpiryEndsTunnel(t *testing.T) {
	env := newTestEnv(t, envOptions{})
	env.route("93.184.216.34:443", startEcho(t))
	client := env.tunnelClient()

	grant := env.newGrant()
	grant.ExpiresAt = time.Now().Add(-egress.ClockSkew + time.Second).Unix()

	tn := env.openTunnel(client, "example.test:443", env.mint(grant))
	if tn.status != http.StatusOK {
		t.Fatalf("status %d", tn.status)
	}

	done := make(chan struct{})
	go func() {
		_, _ = io.ReadAll(tn.reader)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("tunnel outlived its grant")
	}
}
