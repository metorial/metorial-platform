package policy

import (
	"fmt"
	"net/netip"
	"strings"
)

// InternalRanges mirrors the shared reserved list in the networking module
// (compileEgress.ts). testdata/internal-ranges.json keeps the two equal.
var InternalRanges = []string{
	"0.0.0.0/8",
	"10.0.0.0/8",
	"100.64.0.0/10",
	"127.0.0.0/8",
	"169.254.0.0/16",
	"172.16.0.0/12",
	"192.0.0.0/24",
	"192.0.2.0/24",
	"192.88.99.0/24",
	"192.168.0.0/16",
	"198.18.0.0/15",
	"198.51.100.0/24",
	"203.0.113.0/24",
	"224.0.0.0/4",
	"240.0.0.0/4",
	"::/96",
	"ff00::/8",
	"fe80::/10",
	"fc00::/7",
	"fec0::/10",
	"2001:db8::/32",
	"100::/64",
	"64:ff9b:1::/48",
	"::ffff:0:0/96",
	"64:ff9b::/96",
	"2002::/16",
	"2001::/32",
}

var HardDenyRanges = []string{
	"127.0.0.0/8",
	"0.0.0.0/8",
	"169.254.0.0/16",
	"224.0.0.0/4",
	"255.255.255.255/32",
	"100.100.100.200/32",
	"::1/128",
	"::/128",
	"fe80::/10",
	"ff00::/8",
	"fd00:ec2::254/128",
	"2001::/32",
	"64:ff9b:1::/48",
}

var (
	internalPrefixes = mustParsePrefixes(InternalRanges)
	hardDenyPrefixes = mustParsePrefixes(HardDenyRanges)

	nat64Prefix      = netip.MustParsePrefix("64:ff9b::/96")
	sixToFourPrefix  = netip.MustParsePrefix("2002::/16")
	compatiblePrefix = netip.MustParsePrefix("::/96")
)

func ParsePrefixes(cidrs []string) ([]netip.Prefix, error) {
	prefixes := make([]netip.Prefix, 0, len(cidrs))
	for _, raw := range cidrs {
		prefix, err := ParsePrefix(raw)
		if err != nil {
			return nil, err
		}
		prefixes = append(prefixes, prefix)
	}
	return prefixes, nil
}

// ParsePrefix accepts a CIDR or a bare address, masks host bits and turns IPv4-mapped
// IPv6 prefixes into their IPv4 form.
func ParsePrefix(raw string) (netip.Prefix, error) {
	if strings.Contains(raw, "%") {
		return netip.Prefix{}, fmt.Errorf("invalid cidr %q", raw)
	}
	prefix, err := netip.ParsePrefix(raw)
	if err != nil {
		addr, addrErr := netip.ParseAddr(raw)
		if addrErr != nil {
			return netip.Prefix{}, fmt.Errorf("invalid cidr %q", raw)
		}
		prefix = netip.PrefixFrom(addr, addr.BitLen())
	}
	if prefix.Addr().Is4In6() && prefix.Bits() >= 96 {
		prefix = netip.PrefixFrom(prefix.Addr().Unmap(), prefix.Bits()-96)
	}
	return prefix.Masked(), nil
}

// mustParsePrefixes keeps ::ffff:0:0/96 as an IPv6 prefix; addresses are unmapped before
// they are matched, so it never matches and only exists for parity with the TS list.
func mustParsePrefixes(cidrs []string) []netip.Prefix {
	prefixes := make([]netip.Prefix, 0, len(cidrs))
	for _, raw := range cidrs {
		prefixes = append(prefixes, netip.MustParsePrefix(raw))
	}
	return prefixes
}

func containsAddr(prefixes []netip.Prefix, addr netip.Addr) bool {
	for _, prefix := range prefixes {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}

func prefixWithin(inner netip.Prefix, outer netip.Prefix) bool {
	return inner.Addr().Is4() == outer.Addr().Is4() && outer.Bits() <= inner.Bits() && outer.Contains(inner.Addr())
}

// EmbeddedIPv4 returns the IPv4 address carried by an IPv4-mapped, IPv4-compatible,
// NAT64 (well-known prefix) or 6to4 address.
func EmbeddedIPv4(addr netip.Addr) (netip.Addr, bool) {
	addr = addr.WithZone("")
	if addr.Is4In6() {
		return addr.Unmap(), true
	}
	if !addr.Is6() {
		return netip.Addr{}, false
	}

	raw := addr.As16()
	switch {
	case nat64Prefix.Contains(addr), compatiblePrefix.Contains(addr):
		return netip.AddrFrom4([4]byte{raw[12], raw[13], raw[14], raw[15]}), true
	case sixToFourPrefix.Contains(addr):
		return netip.AddrFrom4([4]byte{raw[2], raw[3], raw[4], raw[5]}), true
	}
	return netip.Addr{}, false
}

func IsInternal(addr netip.Addr) bool {
	addr = addr.WithZone("").Unmap()
	if embedded, ok := EmbeddedIPv4(addr); ok {
		return containsAddr(internalPrefixes, embedded)
	}
	return containsAddr(internalPrefixes, addr)
}

func isInternalRange(prefix netip.Prefix) bool {
	for _, internal := range internalPrefixes {
		if prefixWithin(prefix, internal) {
			return true
		}
	}
	return false
}
