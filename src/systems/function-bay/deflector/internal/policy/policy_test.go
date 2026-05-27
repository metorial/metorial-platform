package policy

import (
	"net"
	"testing"
)

func TestCompileSupportsPlainIPRules(t *testing.T) {
	allowedIPs := []string{"203.0.113.10", "2001:db8::1"}
	compiled, err := Compile(Claims{AllowedIPs: &allowedIPs})
	if err != nil {
		t.Fatal(err)
	}

	if !compiled.AllowsIP(net.ParseIP("203.0.113.10")) {
		t.Fatal("expected IPv4 address to be allowed")
	}
	if !compiled.AllowsIP(net.ParseIP("2001:db8::1")) {
		t.Fatal("expected IPv6 address to be allowed")
	}
	if compiled.AllowsIP(net.ParseIP("203.0.113.11")) {
		t.Fatal("expected unmatched IP address to be denied")
	}
}

func TestDefaultIPPolicyBlocksPrivateAndAllowsPublic(t *testing.T) {
	compiled, err := Compile(Claims{})
	if err != nil {
		t.Fatal(err)
	}

	if compiled.AllowsIP(net.ParseIP("10.0.0.1")) {
		t.Fatal("expected private IP address to be blocked by default")
	}
	if !compiled.AllowsIP(net.ParseIP("8.8.8.8")) {
		t.Fatal("expected public IP address to be allowed by default")
	}
}

func TestHostAllowlistSupportsWildcardSuffix(t *testing.T) {
	allowedHosts := []string{"api.example.com", "*.trusted.example"}
	compiled, err := Compile(Claims{AllowedHosts: &allowedHosts})
	if err != nil {
		t.Fatal(err)
	}

	if !compiled.AllowsHost("api.example.com") {
		t.Fatal("expected exact host to be allowed")
	}
	if !compiled.AllowsHost("sub.trusted.example") {
		t.Fatal("expected wildcard suffix host to be allowed")
	}
	if compiled.AllowsHost("trusted.example") {
		t.Fatal("expected wildcard suffix not to match apex host")
	}
}

func TestHostRules(t *testing.T) {
	hosts := []string{"api.example.com", "*.allowed.test"}
	compiled, err := Compile(Claims{AllowedHosts: &hosts})
	if err != nil {
		t.Fatal(err)
	}

	if !compiled.AllowsHost("api.example.com") {
		t.Fatal("expected exact host to be allowed")
	}
	if !compiled.AllowsHost("a.b.allowed.test") {
		t.Fatal("expected wildcard subdomain to be allowed")
	}
	if compiled.AllowsHost("allowed.test") {
		t.Fatal("wildcard must not allow the root domain")
	}
	if compiled.AllowsHost("blocked.test") {
		t.Fatal("unexpected blocked host allowed")
	}
}

func TestMissingRulesAllowPublicDestinations(t *testing.T) {
	compiled, err := Compile(Claims{})
	if err != nil {
		t.Fatal(err)
	}

	if !compiled.AllowsHost("anything.example") {
		t.Fatal("missing host rules should allow all hosts")
	}
	if !compiled.AllowsIP(net.ParseIP("93.184.216.34")) {
		t.Fatal("missing IP rules should allow public IPs")
	}
	if compiled.AllowsIP(net.ParseIP("169.254.169.254")) {
		t.Fatal("metadata IP must remain blocked by default")
	}
}

func TestEmptyRulesDenyAllForDimension(t *testing.T) {
	hosts := []string{}
	ips := []string{}
	compiled, err := Compile(Claims{AllowedHosts: &hosts, AllowedIPs: &ips})
	if err != nil {
		t.Fatal(err)
	}

	if compiled.AllowsHost("example.com") {
		t.Fatal("empty host rules should deny all hosts")
	}
	if compiled.AllowsIP(net.ParseIP("93.184.216.34")) {
		t.Fatal("empty IP rules should deny all IPs")
	}
}

func TestCIDRRules(t *testing.T) {
	ips := []string{"93.184.216.0/24"}
	compiled, err := Compile(Claims{AllowedIPs: &ips})
	if err != nil {
		t.Fatal(err)
	}

	if !compiled.AllowsIP(net.ParseIP("93.184.216.34")) {
		t.Fatal("expected IP inside CIDR to be allowed")
	}
	if compiled.AllowsIP(net.ParseIP("1.1.1.1")) {
		t.Fatal("unexpected IP outside CIDR allowed")
	}
}
