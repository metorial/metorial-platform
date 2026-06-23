package policy

import (
	"net"
	"testing"
)

func TestCompileSupportsCIDRRulesWithPorts(t *testing.T) {
	compiled, err := Compile(Claims{
		EgressPolicy: &CompiledNetworkAllowList{
			Direction: "egress",
			Entries: []CompiledNetworkAllowEntry{
				{CIDR: "203.0.113.10/32", PortRange: &PortRange{From: 443, To: 443}},
				{CIDR: "2001:db8::1/128"},
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	if !compiled.AllowsDestination(net.ParseIP("203.0.113.10"), 443) {
		t.Fatal("expected IPv4 address to be allowed")
	}
	if !compiled.AllowsDestination(net.ParseIP("2001:db8::1"), 8443) {
		t.Fatal("expected IPv6 address to be allowed")
	}
	if compiled.AllowsDestination(net.ParseIP("203.0.113.10"), 80) {
		t.Fatal("expected unmatched port to be denied")
	}
	if compiled.AllowsDestination(net.ParseIP("203.0.113.11"), 443) {
		t.Fatal("expected unmatched IP address to be denied")
	}
}

func TestDefaultIPPolicyBlocksPrivateAndAllowsPublic(t *testing.T) {
	compiled, err := Compile(Claims{})
	if err != nil {
		t.Fatal(err)
	}

	if compiled.AllowsDestination(net.ParseIP("10.0.0.1"), 443) {
		t.Fatal("expected private IP address to be blocked by default")
	}
	if !compiled.AllowsDestination(net.ParseIP("8.8.8.8"), 443) {
		t.Fatal("expected public IP address to be allowed by default")
	}
}

func TestMissingRulesAllowPublicDestinations(t *testing.T) {
	compiled, err := Compile(Claims{})
	if err != nil {
		t.Fatal(err)
	}

	if !compiled.AllowsDestination(net.ParseIP("93.184.216.34"), 443) {
		t.Fatal("missing IP rules should allow public IPs")
	}
	if compiled.AllowsDestination(net.ParseIP("169.254.169.254"), 443) {
		t.Fatal("metadata IP must remain blocked by default")
	}
}

func TestLegacyFallbackAllowsAllDestinations(t *testing.T) {
	compiled, err := Compile(Claims{LegacyFallback: true})
	if err != nil {
		t.Fatal(err)
	}

	if !compiled.AllowsDestination(net.ParseIP("10.0.0.1"), 443) {
		t.Fatal("legacy fallback should allow private IPs")
	}
	if !compiled.AllowsDestination(net.ParseIP("169.254.169.254"), 80) {
		t.Fatal("legacy fallback should allow metadata IPs")
	}
	if !compiled.AllowsDestination(net.ParseIP("93.184.216.34"), 443) {
		t.Fatal("legacy fallback should allow public IPs")
	}
}

func TestEmptyRulesDenyAllForDimension(t *testing.T) {
	compiled, err := Compile(Claims{
		EgressPolicy: &CompiledNetworkAllowList{
			Direction: "egress",
			Entries:   []CompiledNetworkAllowEntry{},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	if compiled.AllowsDestination(net.ParseIP("93.184.216.34"), 443) {
		t.Fatal("empty IP rules should deny all IPs")
	}
}

func TestCIDRRules(t *testing.T) {
	compiled, err := Compile(Claims{
		EgressPolicy: &CompiledNetworkAllowList{
			Direction: "egress",
			Entries: []CompiledNetworkAllowEntry{
				{CIDR: "93.184.216.0/24", PortRange: &PortRange{From: 443, To: 443}},
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	if !compiled.AllowsDestination(net.ParseIP("93.184.216.34"), 443) {
		t.Fatal("expected IP inside CIDR to be allowed")
	}
	if compiled.AllowsDestination(net.ParseIP("1.1.1.1"), 443) {
		t.Fatal("unexpected IP outside CIDR allowed")
	}
}
