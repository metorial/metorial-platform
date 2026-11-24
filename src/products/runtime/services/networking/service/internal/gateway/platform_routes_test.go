package gateway

import (
	"net/http"
	"testing"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
)

var routeOptions = envOptions{
	hardDeny:       []string{"10.42.0.0/16"},
	platformRoutes: []string{"slates-live=hub.cluster.test:52047", "object-upload=10.42.9.10:8081"},
}

func TestPlatformRouteReachesItsUpstreamPastTheHardDenyList(t *testing.T) {
	env := newTestEnv(t, routeOptions)
	env.route("10.42.9.9:52047", startEcho(t))
	env.route("10.42.9.10:8081", startEcho(t))
	client := env.tunnelClient()
	grant := env.grant(withPlatformRoutes("slates-live", "object-upload"))

	tn := env.openTunnel(client, egress.PlatformRouteHost("slates-live")+":80", grant)
	if tn.status != http.StatusOK || tn.roundTrip(t, "live") != "live" {
		t.Fatalf("slates-live status %d", tn.status)
	}
	tn = env.openTunnel(client, "OBJECT-UPLOAD.platform.metorial.internal.:80", grant)
	if tn.status != http.StatusOK || tn.roundTrip(t, "part") != "part" {
		t.Fatalf("object-upload status %d", tn.status)
	}

	env.requireObservation(egress.PlatformRouteHost("slates-live"), "10.42.9.9", 52047, DecisionAllowed)

	if tn := env.openTunnel(client, "hub.cluster.test:52047", grant); tn.status != http.StatusForbidden {
		t.Fatalf("direct upstream status %d", tn.status)
	}
	if tn := env.openTunnel(client, "10.42.9.9:52047", grant); tn.status != http.StatusForbidden {
		t.Fatalf("upstream literal status %d", tn.status)
	}
}

func TestPlatformRouteDenials(t *testing.T) {
	env := newTestEnv(t, routeOptions)
	env.route("10.42.9.9:52047", startEcho(t))
	client := env.tunnelClient()
	live := egress.PlatformRouteHost("slates-live")

	cases := []struct {
		name   string
		grant  string
		target string
	}{
		{name: "route missing from the grant", grant: env.grant(withAllowAll()), target: live + ":80"},
		{name: "other route in the grant", grant: env.grant(withPlatformRoutes("object-upload")), target: live + ":80"},
		{name: "wrong port", grant: env.grant(withPlatformRoutes("slates-live")), target: live + ":52047"},
		{name: "unconfigured route", grant: env.grant(withPlatformRoutes("admin")), target: egress.PlatformRouteHost("admin") + ":80"},
		{name: "nested route host", grant: env.grant(withPlatformRoutes("slates-live")), target: "x.slates-live.platform.metorial.internal:80"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tn := env.openTunnel(client, tc.target, tc.grant); tn.status != http.StatusForbidden {
				t.Fatalf("status %d", tn.status)
			}
		})
	}
}

func TestPlatformRoutesAreNotServedOnTheProxyFrontEnd(t *testing.T) {
	env := newTestEnv(t, routeOptions)
	env.route("10.42.9.9:52047", startEcho(t))

	target := egress.PlatformRouteHost("slates-live") + ":80"
	conn, reader := env.proxyConn()
	_, _ = conn.Write([]byte("CONNECT " + target + " HTTP/1.1\r\nHost: " + target + "\r\nProxy-Authorization: " + basicAuth(env.grant(withPlatformRoutes("slates-live"))) + "\r\n\r\n"))

	if status, _ := readStatus(t, reader); status != http.StatusForbidden {
		t.Fatalf("status %d", status)
	}
}

func TestPlatformRouteHostsNeverResolve(t *testing.T) {
	env := newTestEnv(t, routeOptions)
	client := env.tunnelClient()

	status, addrs := env.resolve(client, egress.PlatformRouteHost("slates-live"), env.grant(withPlatformRoutes("slates-live")))
	if status != http.StatusOK || len(addrs) != 0 {
		t.Fatalf("resolve %d %v", status, addrs)
	}
}

func TestParsePlatformRoutes(t *testing.T) {
	for _, entries := range [][]string{
		{"slates-live"},
		{"Slates=hub:1"},
		{"slates-live=hub"},
		{"slates-live=hub:0"},
		{"slates-live=hub:1", "slates-live=hub:2"},
	} {
		if _, err := ParsePlatformRoutes(entries, nil); err == nil {
			t.Fatalf("%v: expected an error", entries)
		}
	}

	if _, err := ParsePlatformRoutes([]string{"slates-live=integration-controller.metorial.svc:52047"}, nil); err != nil {
		t.Fatal(err)
	}
}
