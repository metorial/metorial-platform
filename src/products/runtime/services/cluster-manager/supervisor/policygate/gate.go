// Package policygate holds untrusted code back until the pod's NetworkPolicy is in force. CNIs
// program policy asynchronously after a pod starts (OrbStack takes ~200 ms), and until then the
// pod can reach anything. The gate probes destinations the policy must deny and passes once none
// of them accepts a connection (PLAN.md 7.6). Build pods run the same loop in bash, rendered by
// the cluster-manager.
package policygate

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"strings"
	"time"
)

type Mode string

const (
	ModeEnforce Mode = "enforce"
	ModeWarn    Mode = "warn"
	ModeOff     Mode = "off"
)

const (
	DefaultTimeout = 30 * time.Second

	// Most CNIs drop denied connections, so every pod start pays this once. Cluster-internal
	// handshakes take about a millisecond, so an open target still answers well within it.
	DefaultAttemptTimeout = 100 * time.Millisecond
	DefaultInterval       = 50 * time.Millisecond
)

// ParseMode defaults to enforce so a missing setting fails closed.
func ParseMode(raw string) (Mode, error) {
	switch Mode(raw) {
	case "":
		return ModeEnforce, nil
	case ModeEnforce, ModeWarn, ModeOff:
		return Mode(raw), nil
	}
	return "", fmt.Errorf("must be enforce, warn or off, got %q", raw)
}

// ParseTargets reads a comma-separated list of ip:port. Hostnames are refused: function and
// build pods have no DNS, and a failed lookup would look like a denied connection.
func ParseTargets(raw string) ([]string, error) {
	var targets []string
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		addr, err := netip.ParseAddrPort(part)
		if err != nil || addr.Port() == 0 {
			return nil, fmt.Errorf("target %q must be ip:port", part)
		}
		targets = append(targets, addr.String())
	}
	return targets, nil
}

type Gate struct {
	Targets        []string
	Timeout        time.Duration
	AttemptTimeout time.Duration
	Interval       time.Duration
	Dial           func(ctx context.Context, network, address string) (net.Conn, error)
}

type Result struct {
	Closed   bool
	Attempts int
	Elapsed  time.Duration
	// Open is a target that still accepted a connection when the gate gave up.
	Open string
}

// Wait probes until no target accepts a connection (Closed) or Timeout runs out. It only returns
// an error without targets or when ctx ends.
func (g *Gate) Wait(ctx context.Context) (Result, error) {
	if len(g.Targets) == 0 {
		return Result{}, errors.New("policy gate has no targets")
	}
	timeout := cmp.Or(g.Timeout, DefaultTimeout)
	interval := cmp.Or(g.Interval, DefaultInterval)

	start := time.Now()
	for attempt := 1; ; attempt++ {
		open := g.probe(ctx)
		if err := ctx.Err(); err != nil {
			return Result{}, err
		}
		res := Result{Attempts: attempt, Elapsed: time.Since(start), Open: open}
		if open == "" {
			res.Closed = true
			return res, nil
		}
		if res.Elapsed+interval >= timeout {
			return res, nil
		}
		select {
		case <-ctx.Done():
			return Result{}, ctx.Err()
		case <-time.After(interval):
		}
	}
}

// probe connects to every target at once and returns one that accepted. Nothing is sent.
func (g *Gate) probe(ctx context.Context) string {
	ctx, cancel := context.WithTimeout(ctx, cmp.Or(g.AttemptTimeout, DefaultAttemptTimeout))
	defer cancel()
	dial := g.Dial
	if dial == nil {
		dial = (&net.Dialer{}).DialContext
	}

	accepted := make(chan string, len(g.Targets))
	for _, target := range g.Targets {
		go func() {
			conn, err := dial(ctx, "tcp", target)
			if err != nil {
				accepted <- ""
				return
			}
			_ = conn.Close()
			accepted <- target
		}()
	}
	open := ""
	for range g.Targets {
		if target := <-accepted; open == "" {
			open = target
		}
	}
	return open
}
