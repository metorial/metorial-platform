package policy

import (
	"net/netip"
	"testing"
)

func TestEmbeddedIPv4(t *testing.T) {
	for _, c := range []struct {
		in, want string
	}{
		{"::ffff:10.0.0.1", "10.0.0.1"},
		{"::10.0.0.1", "10.0.0.1"},
		{"64:ff9b::a00:1", "10.0.0.1"},
		{"64:ff9b::808:808", "8.8.8.8"},
		{"2002:a00:1::1", "10.0.0.1"},
		{"2002:c0a8:101:5::9", "192.168.1.1"},
		{"2606:2800::1", ""},
		{"64:ff9b:1::a00:1", ""},
		{"10.0.0.1", ""},
	} {
		got, ok := EmbeddedIPv4(netip.MustParseAddr(c.in))
		if c.want == "" {
			if ok {
				t.Fatalf("%s: unexpected embedded %s", c.in, got)
			}
			continue
		}
		if !ok || got.String() != c.want {
			t.Fatalf("%s: got %s, want %s", c.in, got, c.want)
		}
	}
}

func TestParsePrefix(t *testing.T) {
	for in, want := range map[string]string{
		"10.0.0.1/8":           "10.0.0.0/8",
		"10.0.0.1":             "10.0.0.1/32",
		"::ffff:10.20.0.0/112": "10.20.0.0/16",
		"2001:db8::1/32":       "2001:db8::/32",
		"::/0":                 "::/0",
	} {
		got, err := ParsePrefix(in)
		if err != nil || got.String() != want {
			t.Fatalf("%s: got %s (%v), want %s", in, got, err, want)
		}
	}
	for _, bad := range []string{"", "10.0.0.0/33", "fe80::1%eth0/64", "example.com"} {
		if _, err := ParsePrefix(bad); err == nil {
			t.Fatalf("accepted %q", bad)
		}
	}
}

func TestMatchHost(t *testing.T) {
	for _, c := range []struct {
		pattern, host string
		want          bool
	}{
		{"api.example.com", "api.example.com", true},
		{"api.example.com", "API.EXAMPLE.COM.", true},
		{"api.example.com", "x.api.example.com", false},
		{"*.example.com", "a.example.com", true},
		{"*.example.com", "a.b.example.com", true},
		{"*.example.com", "example.com", false},
		{"*.example.com", "badexample.com", false},
		{"*.example.com", "", false},
	} {
		if got := MatchHost(c.pattern, c.host); got != c.want {
			t.Fatalf("MatchHost(%q, %q) = %v", c.pattern, c.host, got)
		}
	}
}

func TestCompileRejectsInvalidPolicies(t *testing.T) {
	for name, p := range map[string]*Policy{
		"cidr":         {Entries: []Entry{{CIDR: "nope"}}},
		"port-reverse": {Entries: []Entry{{CIDR: "0.0.0.0/0", PortRange: &PortRange{From: 10, To: 5}}}},
		"port-high":    {Entries: []Entry{{CIDR: "0.0.0.0/0", PortRange: &PortRange{From: 1, To: 65536}}}},
		"host-empty":   {Hosts: []HostRule{{Pattern: ""}}},
		"host-star":    {Hosts: []HostRule{{Pattern: "*"}}},
		"host-middle":  {Hosts: []HostRule{{Pattern: "a.*.com"}}},
		"host-chars":   {Hosts: []HostRule{{Pattern: "exa mple.com"}}},
		"host-port":    {Hosts: []HostRule{{Pattern: "example.com", Ports: []int{0}}}},
	} {
		if _, err := Compile(p, false); err == nil {
			t.Fatalf("%s: accepted", name)
		}
	}
}

func TestEvaluatorExtraHardDeny(t *testing.T) {
	rules, err := Compile(nil, true)
	if err != nil {
		t.Fatal(err)
	}
	evaluator := Evaluator{HardDeny: []netip.Prefix{netip.MustParsePrefix("93.184.216.34/32")}}

	verdict := evaluator.Evaluate(rules, Destination{Addr: netip.MustParseAddr("93.184.216.34"), Port: 443})
	if verdict.Allowed || verdict.Reason != ReasonHardDeny {
		t.Fatalf("own address not hard denied: %+v", verdict)
	}
	if !evaluator.IsHardDenied(netip.MustParseAddr("::ffff:93.184.216.34")) {
		t.Fatal("mapped form of a configured address not hard denied")
	}
	if evaluator.IsHardDenied(netip.MustParseAddr("93.184.216.35")) {
		t.Fatal("neighbour hard denied")
	}
}

func TestIsInternal(t *testing.T) {
	for addr, want := range map[string]bool{
		"10.1.1.1":         true,
		"8.8.8.8":          false,
		"::ffff:10.1.1.1":  true,
		"::ffff:8.8.8.8":   false,
		"64:ff9b::808:808": false,
		"64:ff9b::a01:101": true,
		"fd00::1":          true,
		"2606:2800::1":     false,
	} {
		if got := IsInternal(netip.MustParseAddr(addr)); got != want {
			t.Fatalf("IsInternal(%s) = %v", addr, got)
		}
	}
}

func TestCandidatePortsCoverEveryPortCondition(t *testing.T) {
	rules, err := Compile(&Policy{
		Entries: []Entry{{CIDR: "1.1.1.0/24", PortRange: &PortRange{From: 8000, To: 8100}}, {CIDR: "2.2.2.0/24"}},
		Hosts:   []HostRule{{Pattern: "api.example.com", Ports: []int{443, 8443}}},
	}, false)
	if err != nil {
		t.Fatal(err)
	}

	got := rules.CandidatePorts()
	want := []int{1, 8000, 443, 8443}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}

	evaluator := &Evaluator{}
	anyPort := func(addr string) bool {
		for _, port := range got {
			if evaluator.Evaluate(rules, Destination{Host: "api.example.com", Addr: netip.MustParseAddr(addr), Port: port}).Allowed {
				return true
			}
		}
		return false
	}
	if !anyPort("1.1.1.9") || !anyPort("93.184.216.34") {
		t.Fatal("expected reachable addresses")
	}
	if anyPort("10.0.0.1") {
		t.Fatal("internal address reachable through host rule")
	}
}
