package gateway

import (
	"context"
	"errors"
	"fmt"
	"net/netip"
	"strings"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
)

// PlatformRoutes maps route names to the platform listeners they reach. Only function code
// reaching the gateway through the tunnel front end, with the route named in its grant, may use
// one; the upstream is fixed here and bypasses the policy evaluator and its hard deny list.
type PlatformRoutes struct {
	upstreams map[string]Target
	resolver  Resolver
}

// ParsePlatformRoutes reads "name=host:port" entries. Upstream hosts are resolved with resolver,
// which must be the cluster's own DNS, not the resolver used for integration traffic.
func ParsePlatformRoutes(entries []string, resolver Resolver) (*PlatformRoutes, error) {
	routes := &PlatformRoutes{upstreams: map[string]Target{}, resolver: resolver}
	for _, entry := range entries {
		name, upstream, ok := strings.Cut(entry, "=")
		if !ok {
			return nil, fmt.Errorf("platform route %q must be name=host:port", entry)
		}
		if !egress.ValidPlatformRouteName(name) {
			return nil, fmt.Errorf("invalid platform route name %q", name)
		}
		if _, exists := routes.upstreams[name]; exists {
			return nil, fmt.Errorf("platform route %q is listed twice", name)
		}

		target, err := ParseTarget(upstream)
		if err != nil {
			return nil, fmt.Errorf("platform route %q: %w", name, err)
		}
		routes.upstreams[name] = target
	}
	return routes, nil
}

func (r *PlatformRoutes) upstream(name string) (Target, bool) {
	if r == nil {
		return Target{}, false
	}
	target, ok := r.upstreams[name]
	return target, ok
}

func (r *PlatformRoutes) addresses(ctx context.Context, target Target) ([]netip.Addr, error) {
	if addr, err := netip.ParseAddr(target.Host); err == nil {
		return []netip.Addr{addr.Unmap()}, nil
	}
	if r.resolver == nil {
		return nil, errors.New("no resolver for platform routes")
	}
	return r.resolver.LookupNetIP(ctx, "ip", target.Host)
}

// platformRouteName reports whether host is in the reserved route namespace. Every host there
// is handled as a route, so a name that isn't configured is denied instead of reaching DNS.
func platformRouteName(host string) (string, bool) {
	name, ok := strings.CutSuffix(strings.ToLower(strings.TrimSuffix(host, ".")), egress.PlatformRouteHostSuffix)
	return name, ok
}

func (c *Core) connectPlatformRoute(ctx context.Context, frontEnd FrontEnd, grant *egress.Grant, route string, target Target) (*Upstream, error) {
	upstream, configured := c.PlatformRoutes.upstream(route)
	switch {
	case frontEnd != FrontEndTunnel:
		return nil, c.deny(frontEnd, grant, target, DenyPlatformRoute, errors.New("platform routes are only served to function pods"))
	case target.Port != egress.PlatformRoutePort:
		return nil, c.deny(frontEnd, grant, target, DenyPlatformRoute, fmt.Errorf("platform routes are served on port %d", egress.PlatformRoutePort))
	case !grant.HasPlatformRoute(route):
		return nil, c.deny(frontEnd, grant, target, DenyPlatformRoute, fmt.Errorf("the grant does not allow platform route %q", route))
	case !configured:
		return nil, c.deny(frontEnd, grant, target, DenyPlatformRoute, fmt.Errorf("platform route %q is not configured", route))
	}

	addrs, err := c.PlatformRoutes.addresses(ctx, upstream)
	if err == nil && len(addrs) == 0 {
		err = errors.New("no addresses")
	}
	if err != nil {
		c.metrics().Connections.WithLabelValues(string(frontEnd), "failed").Inc()
		return nil, &DialError{Err: fmt.Errorf("resolve platform route %q: %w", route, err)}
	}

	var dialErr error
	for _, addr := range addrs {
		addrPort := netip.AddrPortFrom(addr.Unmap(), uint16(upstream.Port))
		conn, err := c.dial(ctx, addrPort)
		if err != nil {
			dialErr = err
			continue
		}

		c.Recorder.Record(grant, target.Host, addr.String(), upstream.Port, DecisionAllowed)
		c.metrics().Connections.WithLabelValues(string(frontEnd), "allowed").Inc()
		return &Upstream{Conn: conn, Hostname: target.Host, Addr: addrPort}, nil
	}

	c.metrics().Connections.WithLabelValues(string(frontEnd), "failed").Inc()
	return nil, &DialError{Err: dialErr}
}
