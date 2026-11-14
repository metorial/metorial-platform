package policy

import (
	"errors"
	"fmt"
	"net/netip"
	"strings"
)

type PortRange struct {
	From int `json:"from"`
	To   int `json:"to"`
}

type Entry struct {
	CIDR      string     `json:"cidr"`
	PortRange *PortRange `json:"portRange,omitempty"`
}

type HostRule struct {
	Pattern string `json:"pattern"`
	Ports   []int  `json:"ports,omitempty"`
}

type Policy struct {
	Entries []Entry    `json:"entries"`
	Hosts   []HostRule `json:"hosts,omitempty"`
}

type Reason string

const (
	ReasonPublic           Reason = "public"
	ReasonInternal         Reason = "internal"
	ReasonPolicy           Reason = "policy"
	ReasonHardDeny         Reason = "hard_deny"
	ReasonInternalDisabled Reason = "internal_disabled"
)

type Verdict struct {
	Allowed bool   `json:"allowed"`
	Reason  Reason `json:"reason"`
}

// Rules is a grant's policy in evaluable form.
type Rules struct {
	publicOnly bool
	allowAll   bool
	entries    []compiledEntry
	hosts      []compiledHost
}

type compiledEntry struct {
	prefix   netip.Prefix
	from, to int
	internal bool
}

type compiledHost struct {
	pattern string
	ports   []int
}

// Compile validates a grant's policy. A nil policy means public internet only.
func Compile(p *Policy, allowAll bool) (*Rules, error) {
	rules := &Rules{allowAll: allowAll, publicOnly: p == nil}
	if p == nil {
		return rules, nil
	}

	for _, entry := range p.Entries {
		prefix, err := ParsePrefix(entry.CIDR)
		if err != nil {
			return nil, err
		}

		from, to := 1, 65535
		if entry.PortRange != nil {
			from, to = entry.PortRange.From, entry.PortRange.To
			if from < 1 || to > 65535 || from > to {
				return nil, fmt.Errorf("invalid port range %d-%d for %s", from, to, entry.CIDR)
			}
		}

		rules.entries = append(rules.entries, compiledEntry{
			prefix:   prefix,
			from:     from,
			to:       to,
			internal: isInternalRange(prefix),
		})
	}

	for _, host := range p.Hosts {
		pattern, err := normalizeHostPattern(host.Pattern)
		if err != nil {
			return nil, err
		}
		for _, port := range host.Ports {
			if port < 1 || port > 65535 {
				return nil, fmt.Errorf("invalid port %d for host %s", port, host.Pattern)
			}
		}
		rules.hosts = append(rules.hosts, compiledHost{pattern: pattern, ports: host.Ports})
	}

	return rules, nil
}

// CandidatePorts returns one port per distinct port condition in rules, so evaluating an
// address on each of them tells whether it is reachable on any port.
func (r *Rules) CandidatePorts() []int {
	ports := []int{1}
	seen := map[int]bool{1: true}
	add := func(port int) {
		if !seen[port] {
			seen[port] = true
			ports = append(ports, port)
		}
	}
	for _, entry := range r.entries {
		add(entry.from)
	}
	for _, host := range r.hosts {
		for _, port := range host.ports {
			add(port)
		}
	}
	return ports
}

type Evaluator struct {
	AllowInternalDestinations bool
	// HardDeny extends the built-in hard deny list, e.g. with cluster CIDRs and the
	// gateway's own addresses.
	HardDeny []netip.Prefix
}

type Destination struct {
	Host string
	Addr netip.Addr
	Port int
}

// Evaluate decides whether a destination is reachable under rules. Addresses carrying an
// embedded IPv4 address are evaluated in both forms and the stricter verdict wins.
func (e *Evaluator) Evaluate(rules *Rules, dest Destination) Verdict {
	if rules == nil || !dest.Addr.IsValid() || dest.Port < 1 || dest.Port > 65535 {
		return Verdict{Reason: ReasonPolicy}
	}

	addr := dest.Addr.WithZone("").Unmap()
	host := normalizeHost(dest.Host)

	verdict := e.evaluateAddr(rules, host, addr, dest.Port, IsInternal(addr))
	if embedded, ok := EmbeddedIPv4(addr); ok {
		verdict = stricter(verdict, e.evaluateAddr(rules, host, embedded, dest.Port, IsInternal(embedded)))
	}
	return verdict
}

func (e *Evaluator) IsHardDenied(addr netip.Addr) bool {
	addr = addr.WithZone("").Unmap()
	if e.hardDenied(addr) {
		return true
	}
	embedded, ok := EmbeddedIPv4(addr)
	return ok && e.hardDenied(embedded)
}

func (e *Evaluator) hardDenied(addr netip.Addr) bool {
	return containsAddr(hardDenyPrefixes, addr) || containsAddr(e.HardDeny, addr)
}

func (e *Evaluator) evaluateAddr(rules *Rules, host string, addr netip.Addr, port int, internal bool) Verdict {
	if e.hardDenied(addr) {
		return Verdict{Reason: ReasonHardDeny}
	}

	if internal {
		if !e.AllowInternalDestinations {
			return Verdict{Reason: ReasonInternalDisabled}
		}
		for _, entry := range rules.entries {
			if entry.internal && entry.matches(addr, port) {
				return Verdict{Allowed: true, Reason: ReasonInternal}
			}
		}
		return Verdict{Reason: ReasonPolicy}
	}

	if rules.publicOnly || rules.allowAll {
		return Verdict{Allowed: true, Reason: ReasonPublic}
	}
	for _, entry := range rules.entries {
		if entry.matches(addr, port) {
			return Verdict{Allowed: true, Reason: ReasonPublic}
		}
	}
	if host != "" {
		for _, rule := range rules.hosts {
			if rule.matches(host, port) {
				return Verdict{Allowed: true, Reason: ReasonPublic}
			}
		}
	}
	return Verdict{Reason: ReasonPolicy}
}

func (c compiledEntry) matches(addr netip.Addr, port int) bool {
	return c.prefix.Contains(addr) && port >= c.from && port <= c.to
}

func (c compiledHost) matches(host string, port int) bool {
	if !MatchHost(c.pattern, host) {
		return false
	}
	if len(c.ports) == 0 {
		return true
	}
	for _, allowed := range c.ports {
		if allowed == port {
			return true
		}
	}
	return false
}

var severity = map[Reason]int{
	ReasonPublic:           0,
	ReasonInternal:         0,
	ReasonPolicy:           1,
	ReasonInternalDisabled: 2,
	ReasonHardDeny:         3,
}

func stricter(a, b Verdict) Verdict {
	if a.Allowed && b.Allowed {
		if a.Reason == ReasonInternal || b.Reason == ReasonInternal {
			return Verdict{Allowed: true, Reason: ReasonInternal}
		}
		return a
	}
	if a.Allowed {
		return b
	}
	if b.Allowed {
		return a
	}
	if severity[b.Reason] > severity[a.Reason] {
		return b
	}
	return a
}

// MatchHost matches a normalized hostname against a pattern: an exact name, or
// "*.example.com" for any name below example.com (not example.com itself).
func MatchHost(pattern string, host string) bool {
	pattern = normalizeHost(pattern)
	host = normalizeHost(host)
	if pattern == "" || host == "" {
		return false
	}
	if suffix, ok := strings.CutPrefix(pattern, "*"); ok {
		return strings.HasSuffix(host, suffix) && len(host) > len(suffix)
	}
	return pattern == host
}

func normalizeHost(host string) string {
	return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(host)), ".")
}

var errInvalidHostPattern = errors.New("invalid host pattern")

func normalizeHostPattern(raw string) (string, error) {
	pattern := normalizeHost(raw)
	name := strings.TrimPrefix(pattern, "*.")
	if name == "" || strings.Contains(name, "*") || len(pattern) > 253 {
		return "", fmt.Errorf("%w %q", errInvalidHostPattern, raw)
	}
	for _, label := range strings.Split(name, ".") {
		if label == "" || len(label) > 63 {
			return "", fmt.Errorf("%w %q", errInvalidHostPattern, raw)
		}
		for _, r := range label {
			if !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-' || r == '_') {
				return "", fmt.Errorf("%w %q", errInvalidHostPattern, raw)
			}
		}
	}
	return pattern, nil
}
