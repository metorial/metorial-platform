package policy

import (
	"errors"
	"net"
	"net/netip"

	"github.com/golang-jwt/jwt/v5"
)

type PortRange struct {
	From int `json:"from"`
	To   int `json:"to"`
}

type CompiledNetworkAllowEntry struct {
	CIDR      string     `json:"cidr"`
	PortRange *PortRange `json:"portRange,omitempty"`
}

type CompiledNetworkAllowList struct {
	Direction string                      `json:"direction"`
	Entries   []CompiledNetworkAllowEntry `json:"entries"`
}

type Claims struct {
	TenantID            string                    `json:"tenantId"`
	FunctionID          string                    `json:"functionId"`
	EffectiveFunctionID string                    `json:"effectiveFunctionId,omitempty"`
	FunctionVersionID   string                    `json:"functionVersionId"`
	EnclaveID           string                    `json:"enclaveId,omitempty"`
	EnclaveIdentifier   string                    `json:"enclaveIdentifier,omitempty"`
	EgressPolicy        *CompiledNetworkAllowList `json:"egressPolicy,omitempty"`
	LegacyFallback      bool                      `json:"legacyFallback,omitempty"`
	jwt.RegisteredClaims
}

type Compiled struct {
	entries  *[]compiledEntry
	allowAll bool
}

type compiledEntry struct {
	prefix    netip.Prefix
	portRange *PortRange
}

func Compile(claims Claims) (*Compiled, error) {
	c := &Compiled{}
	if claims.LegacyFallback {
		c.allowAll = true
		return c, nil
	}

	if claims.EgressPolicy != nil {
		if claims.EgressPolicy.Direction != "egress" {
			return nil, errors.New("egress policy must have egress direction")
		}

		entries := make([]compiledEntry, 0, len(claims.EgressPolicy.Entries))
		for _, raw := range claims.EgressPolicy.Entries {
			prefix, err := parseCIDRRule(raw.CIDR)
			if err != nil {
				return nil, err
			}

			if raw.PortRange != nil {
				if raw.PortRange.From < 1 || raw.PortRange.To < raw.PortRange.From || raw.PortRange.To > 65535 {
					return nil, errors.New("invalid port range")
				}
			}

			entries = append(entries, compiledEntry{
				prefix:    prefix.Masked(),
				portRange: raw.PortRange,
			})
		}

		c.entries = &entries
	}

	return c, nil
}

func parseCIDRRule(raw string) (netip.Prefix, error) {
	return netip.ParsePrefix(raw)
}

func (c *Compiled) AllowsDestination(ip net.IP, port int) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()

	if c.allowAll {
		return port >= 1 && port <= 65535
	}

	if c.entries == nil {
		return !isAlwaysBlocked(addr)
	}

	for _, entry := range *c.entries {
		if !entry.prefix.Contains(addr) {
			continue
		}
		if entry.portRange != nil && (port < entry.portRange.From || port > entry.portRange.To) {
			continue
		}
		if entry.portRange == nil && (port < 1 || port > 65535) {
			continue
		}

		return true
	}
	return false
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
