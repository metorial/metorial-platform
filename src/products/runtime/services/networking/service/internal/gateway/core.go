package gateway

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
)

type FrontEnd string

const (
	FrontEndTunnel FrontEnd = "tunnel"
	FrontEndProxy  FrontEnd = "proxy"
)

type DenyReason string

const (
	DenyPolicy           DenyReason = "policy"
	DenyHardDeny         DenyReason = "hard_deny"
	DenyInternalDisabled DenyReason = "internal_disabled"
	DenyNoAddress        DenyReason = "no_address"
)

type Resolver interface {
	LookupNetIP(ctx context.Context, network, host string) ([]netip.Addr, error)
}

type DialFunc func(ctx context.Context, network, address string) (net.Conn, error)

type DeniedError struct {
	Reason DenyReason
	Err    error
}

func (e *DeniedError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("destination denied (%s): %v", e.Reason, e.Err)
	}
	return fmt.Sprintf("destination denied (%s)", e.Reason)
}

type DialError struct {
	Err error
}

func (e *DialError) Error() string {
	return "upstream dial failed: " + e.Err.Error()
}

func (e *DialError) Unwrap() error {
	return e.Err
}

type Core struct {
	Keys        egress.Keys
	Evaluator   *policy.Evaluator
	Resolver    Resolver
	Dial        DialFunc
	DialTimeout time.Duration
	Memory      *ResolveMemory
	Recorder    *Recorder
	Metrics     *Metrics
	Logger      *slog.Logger
	Now         func() time.Time
}

type Target struct {
	Host string
	Port int
}

func (t Target) String() string {
	return net.JoinHostPort(t.Host, strconv.Itoa(t.Port))
}

// ParseTarget parses "host:port" with a numeric port in 1..65535.
func ParseTarget(hostport string) (Target, error) {
	host, port, err := net.SplitHostPort(hostport)
	if err != nil {
		return Target{}, err
	}
	number, err := strconv.Atoi(port)
	if err != nil || number < 1 || number > 65535 {
		return Target{}, fmt.Errorf("invalid port %q", port)
	}
	if host == "" || strings.ContainsAny(host, " /%") {
		return Target{}, fmt.Errorf("invalid host %q", host)
	}
	return Target{Host: host, Port: number}, nil
}

type Upstream struct {
	net.Conn
	Hostname string
	Addr     netip.AddrPort
}

func (c *Core) now() time.Time {
	if c.Now != nil {
		return c.Now()
	}
	return time.Now()
}

func (c *Core) logger() *slog.Logger {
	if c.Logger != nil {
		return c.Logger
	}
	return slog.Default()
}

func (c *Core) VerifyGrant(frontEnd FrontEnd, token string) (*egress.Grant, error) {
	grant, err := egress.VerifyGrant(token, c.Keys, c.now())
	if err != nil {
		reason := string(egress.CodeOf(err))
		if reason == "" {
			reason = "invalid"
		}
		c.metrics().GrantFailures.WithLabelValues(string(frontEnd), reason).Inc()
		return nil, err
	}
	return grant, nil
}

// Connect resolves target, evaluates every address and dials the first allowed one.
func (c *Core) Connect(ctx context.Context, frontEnd FrontEnd, grant *egress.Grant, target Target) (*Upstream, error) {
	hostname, addrs, err := c.candidates(ctx, grant, target)
	if err != nil {
		c.metrics().Denials.WithLabelValues(string(frontEnd), string(DenyNoAddress)).Inc()
		c.metrics().Connections.WithLabelValues(string(frontEnd), "denied").Inc()
		return nil, &DeniedError{Reason: DenyNoAddress, Err: err}
	}

	rules := grant.Rules()
	var denial *DeniedError
	var dialErr error

	for _, addr := range addrs {
		verdict := c.Evaluator.Evaluate(rules, policy.Destination{Host: hostname, Addr: addr, Port: target.Port})
		if !verdict.Allowed {
			if denial == nil {
				denial = &DeniedError{Reason: DenyReason(verdict.Reason)}
			}
			c.Recorder.Record(grant, observedHost(target, hostname), addr.String(), target.Port, DecisionDenied)
			continue
		}

		addrPort := netip.AddrPortFrom(addr, uint16(target.Port))
		conn, err := c.dial(ctx, addrPort)
		if err != nil {
			dialErr = err
			continue
		}

		c.Recorder.Record(grant, observedHost(target, hostname), addr.String(), target.Port, DecisionAllowed)
		c.metrics().Connections.WithLabelValues(string(frontEnd), "allowed").Inc()
		return &Upstream{Conn: conn, Hostname: hostname, Addr: addrPort}, nil
	}

	if dialErr != nil {
		c.metrics().Connections.WithLabelValues(string(frontEnd), "failed").Inc()
		return nil, &DialError{Err: dialErr}
	}
	if denial == nil {
		denial = &DeniedError{Reason: DenyNoAddress, Err: errors.New("no addresses")}
	}
	c.metrics().Denials.WithLabelValues(string(frontEnd), string(denial.Reason)).Inc()
	c.metrics().Connections.WithLabelValues(string(frontEnd), "denied").Inc()
	c.logger().Info("egress denied",
		"frontEnd", frontEnd,
		"jti", grant.ID,
		"tenantId", grant.TenantID,
		"functionId", grant.FunctionID,
		"buildRunId", grant.BuildRunID,
		"target", target.String(),
		"reason", denial.Reason,
	)
	return nil, denial
}

// Resolve answers a tunnel client's DNS lookup with the addresses the grant may reach on
// some port, and remembers them so later CONNECTs to those IPs are evaluated as hostname.
func (c *Core) Resolve(ctx context.Context, grant *egress.Grant, host string) ([]netip.Addr, error) {
	if addr, err := netip.ParseAddr(host); err == nil {
		addr = addr.Unmap()
		if c.allowedOnSomePort(grant, "", addr) {
			return []netip.Addr{addr}, nil
		}
		return []netip.Addr{}, nil
	}

	addrs, err := c.Resolver.LookupNetIP(ctx, "ip", host)
	if err != nil {
		c.metrics().DNSLookups.WithLabelValues("error").Inc()
		return []netip.Addr{}, nil
	}
	c.metrics().DNSLookups.WithLabelValues("ok").Inc()

	allowed := make([]netip.Addr, 0, len(addrs))
	for _, addr := range addrs {
		addr = addr.Unmap()
		if c.allowedOnSomePort(grant, host, addr) {
			allowed = append(allowed, addr)
			continue
		}
		c.Recorder.Record(grant, host, addr.String(), 0, DecisionDenied)
	}

	c.Memory.Remember(grant.ID, grant.Expiry().Add(egress.ClockSkew), host, allowed)
	return allowed, nil
}

func (c *Core) allowedOnSomePort(grant *egress.Grant, host string, addr netip.Addr) bool {
	rules := grant.Rules()
	for _, port := range rules.CandidatePorts() {
		if c.Evaluator.Evaluate(rules, policy.Destination{Host: host, Addr: addr, Port: port}).Allowed {
			return true
		}
	}
	return false
}

func (c *Core) candidates(ctx context.Context, grant *egress.Grant, target Target) (string, []netip.Addr, error) {
	if addr, err := netip.ParseAddr(target.Host); err == nil {
		addr = addr.Unmap()
		return c.Memory.Lookup(grant.ID, addr), []netip.Addr{addr}, nil
	}

	addrs, err := c.Resolver.LookupNetIP(ctx, "ip", target.Host)
	if err != nil {
		c.metrics().DNSLookups.WithLabelValues("error").Inc()
		return target.Host, nil, err
	}
	c.metrics().DNSLookups.WithLabelValues("ok").Inc()
	if len(addrs) == 0 {
		return target.Host, nil, errors.New("no addresses")
	}
	for i := range addrs {
		addrs[i] = addrs[i].Unmap()
	}
	return target.Host, addrs, nil
}

func (c *Core) dial(ctx context.Context, addr netip.AddrPort) (net.Conn, error) {
	timeout := c.DialTimeout
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	dial := c.Dial
	if dial == nil {
		dialer := &net.Dialer{KeepAlive: 30 * time.Second}
		dial = dialer.DialContext
	}
	return dial(ctx, "tcp", addr.String())
}

func observedHost(target Target, hostname string) string {
	if hostname != "" {
		return hostname
	}
	return target.Host
}

var discardMetrics = NewMetrics()

func (c *Core) metrics() *Metrics {
	if c.Metrics != nil {
		return c.Metrics
	}
	return discardMetrics
}
