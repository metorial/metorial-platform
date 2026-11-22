// Package egress provides the HTTP transport for connections to source control
// providers and the hosts they hand out (archive, CDN and Git LFS URLs).
package egress

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"sync/atomic"
	"syscall"
	"time"
)

var ErrAddressNotAllowed = errors.New("address is not reachable from Metorial")

var allowPrivateNetworks atomic.Bool

// Transport is shared by every provider-facing client. Each connection it opens,
// including those for redirects, is checked against the network policy.
var Transport = NewTransport()

// Client is the provider-facing client for callers that need no timeout of their own.
var Client = &http.Client{Transport: Transport}

// AllowPrivateNetworks sets whether provider connections may reach private, loopback
// and link-local addresses (ORIGIN_SCM_ALLOW_PRIVATE_NETWORKS).
func AllowPrivateNetworks(allow bool) {
	allowPrivateNetworks.Store(allow)
}

func PrivateNetworksAllowed() bool {
	return allowPrivateNetworks.Load()
}

func NewTransport() *http.Transport {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DialContext = NewDialer().DialContext
	return transport
}

func NewClient(timeout time.Duration) *http.Client {
	return &http.Client{Timeout: timeout, Transport: Transport}
}

func NewDialer() *net.Dialer {
	return &net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
		Control:   dialControl,
	}
}

func dialControl(network, address string, _ syscall.RawConn) error {
	if allowPrivateNetworks.Load() {
		return nil
	}
	return checkDialAddress(network, address)
}

func checkDialAddress(network, address string) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return fmt.Errorf("%w: %s", ErrAddressNotAllowed, address)
	}

	addr, err := netip.ParseAddr(host)
	if err != nil || !IsPublicAddr(addr) {
		return fmt.Errorf("%w: %s %s", ErrAddressNotAllowed, network, host)
	}

	return nil
}

var nonPublicPrefixes = mustParsePrefixes(
	"0.0.0.0/8",
	"10.0.0.0/8",
	"100.64.0.0/10",
	"127.0.0.0/8",
	"169.254.0.0/16",
	"172.16.0.0/12",
	"192.0.0.0/24",
	"192.0.2.0/24",
	"192.31.196.0/24",
	"192.52.193.0/24",
	"192.88.99.0/24",
	"192.168.0.0/16",
	"192.175.48.0/24",
	"198.18.0.0/15",
	"198.51.100.0/24",
	"203.0.113.0/24",
	"224.0.0.0/4",
	"240.0.0.0/4",

	"::/128",
	"::1/128",
	"::ffff:0:0/96",
	"::ffff:0:0:0/96",
	"64:ff9b::/96",
	"64:ff9b:1::/48",
	"100::/64",
	"2001::/23",
	"2001:db8::/32",
	"2002::/16",
	"2620:4f:8000::/48",
	"3fff::/20",
	"5f00::/16",
	"fc00::/7",
	"fe80::/10",
	"fec0::/10",
	"ff00::/8",
)

func mustParsePrefixes(values ...string) []netip.Prefix {
	prefixes := make([]netip.Prefix, 0, len(values))
	for _, value := range values {
		prefixes = append(prefixes, netip.MustParsePrefix(value))
	}
	return prefixes
}

// IsPublicAddr reports whether addr is a globally routable unicast address.
func IsPublicAddr(addr netip.Addr) bool {
	if !addr.IsValid() {
		return false
	}

	addr = addr.Unmap().WithZone("")
	for _, prefix := range nonPublicPrefixes {
		if prefix.Contains(addr) {
			return false
		}
	}

	return true
}
