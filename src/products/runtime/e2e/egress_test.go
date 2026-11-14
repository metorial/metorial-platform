package e2e

import (
	"context"
	"net"
	"strconv"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
	logs "github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/rpc/networklogsrpc"
)

type netResult struct {
	OK        bool     `json:"ok"`
	Status    int      `json:"status"`
	Error     string   `json:"error"`
	Addresses []string `json:"addresses"`
}

type target struct {
	name string
	host string
	port int
}

func (e *env) internalTargets() []target {
	return []target{
		{"API server ClusterIP", e.apiServerIP, 443},
		{"API server by cluster DNS name", "kubernetes.default.svc.cluster.local", 443},
		{"API server as IPv4-mapped IPv6", "::ffff:" + e.apiServerIP, 443},
		{"cluster-manager control port (ClusterIP)", e.clusterManagerIP, 52240},
		{"cluster-manager pod-facing port (ClusterIP)", e.clusterManagerIP, 52241},
		{"cluster-manager control port (pod IP)", e.clusterManagerPod, 52240},
		{"Kourier internal gateway", e.kourierIP, 80},
		{"egress gateway metrics", e.gatewayIP, 9090},
		{"metadata endpoint", "169.254.169.254", 80},
		{"loopback (the gateway's own admin port)", "127.0.0.1", 9090},
	}
}

func TestEgress(t *testing.T) {
	e := setup(t)
	f := e.deploy(t, "egress", deployOptions{files: map[string]string{"index.js": probeFunction}, timeout: 25})
	examplePolicy := &policy.Policy{Entries: []policy.Entry{}, Hosts: []policy.HostRule{{Pattern: "example.com", Ports: []int{443}}}}

	call := func(t *testing.T, payload map[string]any, opts ...invokeOption) netResult {
		t.Helper()
		return result[netResult](t, e.invoke(t, f, payload, opts...))
	}

	t.Run("a host allowed by the policy is reachable over TLS", func(t *testing.T) {
		res := call(t, map[string]any{"op": "fetch", "url": "https://example.com/"}, withPolicy(examplePolicy))
		if !res.OK || res.Status != 200 {
			t.Fatalf("example.com through the gateway: %+v", res)
		}
		res = call(t, map[string]any{"op": "fetch", "url": "https://registry.npmjs.org/is-number"}, withAllowAll())
		if !res.OK || res.Status != 200 {
			t.Fatalf("registry.npmjs.org with allowAll: %+v", res)
		}
		res = call(t, map[string]any{"op": "connect", "host": "example.com", "port": 443}, withPolicy(examplePolicy))
		if !res.OK {
			t.Fatalf("raw TCP to example.com:443: %+v", res)
		}
	})

	t.Run("a host outside the policy is denied", func(t *testing.T) {
		res := call(t, map[string]any{"op": "fetch", "url": "https://registry.npmjs.org/is-number"}, withPolicy(examplePolicy))
		if res.OK {
			t.Fatalf("registry.npmjs.org reached under an example.com-only policy: %+v", res)
		}
		t.Logf("denied fetch error: %s", res.Error)

		res = call(t, map[string]any{"op": "connect", "host": "example.com", "port": 80}, withPolicy(examplePolicy))
		if res.OK {
			t.Fatalf("example.com:80 reached under a port-443 rule: %+v", res)
		}
	})

	t.Run("DNS resolves through the gateway and raw DNS fails", func(t *testing.T) {
		res := call(t, map[string]any{"op": "lookup", "host": "example.com"}, withPolicy(examplePolicy))
		if !res.OK || len(res.Addresses) == 0 {
			t.Fatalf("dns.lookup(example.com): %+v", res)
		}
		res = call(t, map[string]any{"op": "lookup", "host": "kubernetes.default.svc.cluster.local"}, withAllowAll())
		if res.OK && len(res.Addresses) > 0 {
			t.Fatalf("dns.lookup returned cluster addresses: %+v", res)
		}
		res = call(t, map[string]any{"op": "resolve", "host": "example.com"}, withAllowAll())
		if res.OK {
			t.Fatalf("dns.resolve4 bypassed the gateway: %+v", res)
		}
	})

	t.Run("cluster, metadata and loopback addresses are denied even with allowAll", func(t *testing.T) {
		for _, target := range e.internalTargets() {
			res := call(t, map[string]any{"op": "connect", "host": target.host, "port": target.port}, withAllowAll())
			if res.OK {
				t.Errorf("%s (%s) reachable through the gateway with allowAll", target.name, net.JoinHostPort(target.host, strconv.Itoa(target.port)))
			}
		}
	})

	t.Run("explicit internal entries never open the cluster's own ranges", func(t *testing.T) {
		internal := &policy.Policy{Entries: []policy.Entry{{CIDR: "192.168.0.0/16"}, {CIDR: "10.0.0.0/8"}, {CIDR: "169.254.0.0/16"}, {CIDR: "127.0.0.0/8"}}}
		for _, target := range e.internalTargets() {
			res := call(t, map[string]any{"op": "connect", "host": target.host, "port": target.port}, withPolicy(internal))
			if res.OK {
				t.Errorf("%s reachable with an explicit internal entry", target.name)
			}
		}
	})

	t.Run("direct sockets that bypass the interception", func(t *testing.T) {
		if res := call(t, map[string]any{"op": "raw", "host": e.gatewayIP, "port": 8443}); !res.OK {
			t.Fatalf("positive control: a raw socket can't reach the gateway, which NetworkPolicy allows: %+v", res)
		}

		res := call(t, map[string]any{"op": "raw", "host": e.clusterManagerPod, "port": 52240})
		if res.OK {
			t.Errorf("a raw socket reached the cluster-manager control port on its pod IP")
		}
		res = call(t, map[string]any{"op": "raw", "host": e.clusterManagerIP, "port": 52240})
		if res.OK {
			t.Errorf("a raw socket reached the cluster-manager control port on its ClusterIP")
		}

		for _, target := range []target{{"API server", e.apiServerIP, 443}, {"public internet", "1.1.1.1", 443}} {
			res := call(t, map[string]any{"op": "raw", "host": target.host, "port": target.port})
			switch {
			case !res.OK:
				t.Logf("raw socket to the %s blocked by NetworkPolicy (%s)", target.name, res.Error)
			case e.strictNP:
				t.Errorf("a raw socket reached the %s; NetworkPolicy must block it", target.name)
			default:
				t.Logf("NOT ENFORCED HERE: a raw socket reached the %s; this cluster's NetworkPolicy doesn't cover egress outside the pod network", target.name)
			}
		}
	})

	t.Run("observations reach the network log store", func(t *testing.T) {
		var allowed, denied bool
		eventually(t, 30*time.Second, "observations for "+f.functionID, func() (bool, error) {
			out, err := e.logs.ObservationList(context.Background(), &logs.ObservationListInput{
				TenantID:    tenantID,
				FunctionIds: []string{f.functionID},
			})
			if err != nil {
				return false, err
			}
			for _, o := range out.Records {
				allowed = allowed || (o.Decision == logs.DecisionAllowed && o.Hostname == "example.com" && o.Source == logs.SourceKnative)
				denied = denied || (o.Decision == logs.DecisionDenied && o.Hostname == "registry.npmjs.org")
			}
			return allowed && denied, nil
		})
	})
}
