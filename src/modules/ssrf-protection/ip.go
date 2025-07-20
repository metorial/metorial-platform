package ssrfProtection

import (
	"fmt"
	"net"
)

var blockedNetworks = []*net.IPNet{
	// Loopback
	{IP: net.IPv4(127, 0, 0, 0), Mask: net.CIDRMask(8, 32)},
	{IP: net.ParseIP("::1"), Mask: net.CIDRMask(128, 128)},

	// Private networks (RFC 1918)
	{IP: net.IPv4(10, 0, 0, 0), Mask: net.CIDRMask(8, 32)},
	{IP: net.IPv4(172, 16, 0, 0), Mask: net.CIDRMask(12, 32)},
	{IP: net.IPv4(192, 168, 0, 0), Mask: net.CIDRMask(16, 32)},

	// Link-local
	{IP: net.IPv4(169, 254, 0, 0), Mask: net.CIDRMask(16, 32)},
	{IP: net.ParseIP("fe80::"), Mask: net.CIDRMask(10, 128)},

	// Multicast
	{IP: net.IPv4(224, 0, 0, 0), Mask: net.CIDRMask(4, 32)},
	{IP: net.ParseIP("ff00::"), Mask: net.CIDRMask(8, 128)},

	// Broadcast
	{IP: net.IPv4(255, 255, 255, 255), Mask: net.CIDRMask(32, 32)},

	// Other special ranges
	{IP: net.IPv4(0, 0, 0, 0), Mask: net.CIDRMask(8, 32)},      // "This" network
	{IP: net.IPv4(100, 64, 0, 0), Mask: net.CIDRMask(10, 32)},  // Carrier-grade NAT
	{IP: net.IPv4(192, 0, 0, 0), Mask: net.CIDRMask(24, 32)},   // IETF Protocol Assignments
	{IP: net.IPv4(192, 0, 2, 0), Mask: net.CIDRMask(24, 32)},   // Documentation
	{IP: net.IPv4(198, 18, 0, 0), Mask: net.CIDRMask(15, 32)},  // Benchmarking
	{IP: net.IPv4(203, 0, 113, 0), Mask: net.CIDRMask(24, 32)}, // Documentation
	{IP: net.ParseIP("fc00::"), Mask: net.CIDRMask(7, 128)},    // IPv6 ULA
	{IP: net.ParseIP("::"), Mask: net.CIDRMask(128, 128)},      // Unspecified
	// {IP: net.ParseIP("::ffff:0:0"), Mask: net.CIDRMask(96, 128)},  // IPv4-mapped IPv6
	{IP: net.ParseIP("2001::"), Mask: net.CIDRMask(32, 128)},      // Teredo tunneling
	{IP: net.ParseIP("2002::"), Mask: net.CIDRMask(16, 128)},      // 6to4
	{IP: net.ParseIP("198.51.100.0"), Mask: net.CIDRMask(24, 32)}, // Documentation
	{IP: net.IPv4(240, 0, 0, 0), Mask: net.CIDRMask(4, 32)},       // Reserved

}

func validateIP(ip net.IP) error {
	for _, network := range blockedNetworks {
		if network.Contains(ip) {
			return fmt.Errorf("IP %s is in blocked network range %s", ip.String(), network.String())
		}
	}

	return nil
}
