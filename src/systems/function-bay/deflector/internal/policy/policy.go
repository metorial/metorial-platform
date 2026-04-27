package policy

import (
	"errors"
	"net"
	"net/netip"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	AllowedIPs   *[]string `json:"allowedIps,omitempty"`
	AllowedHosts *[]string `json:"allowedHosts,omitempty"`
	jwt.RegisteredClaims
}

type Compiled struct {
	ipPrefixes   *[]netip.Prefix
	hostPatterns *[]string
}

func Compile(claims Claims) (*Compiled, error) {
	c := &Compiled{}

	if claims.AllowedIPs != nil {
		prefixes := make([]netip.Prefix, 0, len(*claims.AllowedIPs))
		for _, raw := range *claims.AllowedIPs {
			prefix, err := netip.ParsePrefix(strings.TrimSpace(raw))
			if err != nil {
				return nil, err
			}
			prefixes = append(prefixes, prefix.Masked())
		}
		c.ipPrefixes = &prefixes
	}

	if claims.AllowedHosts != nil {
		patterns := make([]string, 0, len(*claims.AllowedHosts))
		for _, raw := range *claims.AllowedHosts {
			host := normalizeHost(raw)
			if host == "" {
				return nil, errors.New("empty host allow rule")
			}
			patterns = append(patterns, host)
		}
		c.hostPatterns = &patterns
	}

	return c, nil
}

func (c *Compiled) AllowsHost(host string) bool {
	if c.hostPatterns == nil {
		return true
	}
	host = normalizeHost(host)
	if host == "" {
		return false
	}

	for _, pattern := range *c.hostPatterns {
		if strings.HasPrefix(pattern, "*.") {
			suffix := strings.TrimPrefix(pattern, "*.")
			if host != suffix && strings.HasSuffix(host, "."+suffix) {
				return true
			}
			continue
		}

		if host == pattern {
			return true
		}
	}

	return false
}

func (c *Compiled) AllowsIP(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()

	if c.ipPrefixes == nil {
		return !isAlwaysBlocked(addr)
	}

	for _, prefix := range *c.ipPrefixes {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}

func normalizeHost(host string) string {
	host = strings.TrimSpace(strings.ToLower(host))
	host = strings.TrimSuffix(host, ".")
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	return host
}

func isAlwaysBlocked(addr netip.Addr) bool {
	return addr.IsLoopback() ||
		addr.IsLinkLocalUnicast() ||
		addr.IsLinkLocalMulticast() ||
		addr.IsPrivate() ||
		addr.IsMulticast() ||
		addr.IsUnspecified() ||
		addr == netip.MustParseAddr("169.254.169.254")
}
