package main

import (
	"errors"
	"fmt"
	"net"
	"net/netip"
	"strconv"
	"strings"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
)

const listenerOff = "off"

type config struct {
	tunnelAddr  string
	proxyAddr   string
	metricsAddr string

	tls      bool
	certFile string
	keyFile  string

	publicKeys     *egress.KeySet
	publicKeysFile string

	allowInternalDestinations bool
	hardDeny                  []netip.Prefix
	denyOwnAddresses          bool
	dnsServers                []string

	dialTimeout time.Duration
	idleTimeout time.Duration

	instanceID           string
	logsURL              string
	logsDiscoveryNS      string
	logsDiscoveryService string
	logsDiscoveryPort    int
	logsSecret           string
	logsTokenFile        string
	logsCAFile           string
	flushInterval        time.Duration
	maxBufferAge         time.Duration
}

func loadConfig(getenv func(string) string) (*config, error) {
	env := envReader{getenv: getenv}
	cfg := &config{
		tunnelAddr:                env.string("EGRESS_GATEWAY_TUNNEL_ADDR", ":8443"),
		proxyAddr:                 env.string("EGRESS_GATEWAY_PROXY_ADDR", ":8080"),
		metricsAddr:               env.string("EGRESS_GATEWAY_METRICS_ADDR", ":9090"),
		tls:                       env.bool("EGRESS_GATEWAY_TLS", true),
		certFile:                  getenv("EGRESS_GATEWAY_TLS_CERT_FILE"),
		keyFile:                   getenv("EGRESS_GATEWAY_TLS_KEY_FILE"),
		publicKeysFile:            getenv("EGRESS_GRANT_PUBLIC_KEYS_FILE"),
		allowInternalDestinations: env.bool("ALLOW_INTERNAL_DESTINATIONS", false),
		denyOwnAddresses:          env.bool("EGRESS_DENY_OWN_ADDRESSES", true),
		dnsServers:                splitList(getenv("EGRESS_DNS_SERVERS")),
		dialTimeout:               env.seconds("EGRESS_DIAL_TIMEOUT_SECONDS", 10*time.Second),
		idleTimeout:               env.seconds("EGRESS_IDLE_TIMEOUT_SECONDS", 10*time.Minute),
		instanceID:                getenv("EGRESS_GATEWAY_INSTANCE_ID"),
		logsURL:                   getenv("NETWORK_LOGS_URL"),
		logsDiscoveryNS:           getenv("NETWORK_LOGS_DISCOVERY_NAMESPACE"),
		logsDiscoveryService:      getenv("NETWORK_LOGS_DISCOVERY_SERVICE"),
		logsDiscoveryPort:         env.int("NETWORK_LOGS_DISCOVERY_PORT", 52250),
		logsSecret:                getenv("NETWORK_LOGS_RPC_SECRET"),
		logsTokenFile:             getenv("NETWORK_LOGS_TOKEN_FILE"),
		logsCAFile:                getenv("NETWORK_LOGS_CA_FILE"),
		flushInterval:             env.seconds("EGRESS_OBSERVATION_FLUSH_INTERVAL_SECONDS", time.Minute),
		maxBufferAge:              env.seconds("EGRESS_OBSERVATION_MAX_BUFFER_AGE_SECONDS", 15*time.Minute),
	}
	if env.err != nil {
		return nil, env.err
	}

	if raw := getenv("EGRESS_GRANT_PUBLIC_KEYS"); raw != "" {
		keys, err := egress.ParseKeySet([]byte(raw))
		if err != nil {
			return nil, fmt.Errorf("EGRESS_GRANT_PUBLIC_KEYS: %w", err)
		}
		cfg.publicKeys = keys
	}
	if (cfg.publicKeys == nil) == (cfg.publicKeysFile == "") {
		return nil, errors.New("set exactly one of EGRESS_GRANT_PUBLIC_KEYS and EGRESS_GRANT_PUBLIC_KEYS_FILE")
	}

	hardDeny, err := policy.ParsePrefixes(splitList(getenv("HARD_DENY_CIDRS")))
	if err != nil {
		return nil, fmt.Errorf("HARD_DENY_CIDRS: %w", err)
	}
	cfg.hardDeny = hardDeny

	for _, server := range cfg.dnsServers {
		if _, err := normalizeDNSServer(server); err != nil {
			return nil, fmt.Errorf("EGRESS_DNS_SERVERS: %w", err)
		}
	}

	if cfg.tunnelAddr != listenerOff && cfg.tls && (cfg.certFile == "" || cfg.keyFile == "") {
		return nil, errors.New("EGRESS_GATEWAY_TLS_CERT_FILE and EGRESS_GATEWAY_TLS_KEY_FILE are required unless EGRESS_GATEWAY_TLS=false")
	}
	if cfg.tunnelAddr == listenerOff && cfg.proxyAddr == listenerOff {
		return nil, errors.New("both front ends are disabled")
	}

	discovery := cfg.logsDiscoveryNS != "" || cfg.logsDiscoveryService != ""
	if discovery && (cfg.logsDiscoveryNS == "" || cfg.logsDiscoveryService == "") {
		return nil, errors.New("NETWORK_LOGS_DISCOVERY_NAMESPACE and NETWORK_LOGS_DISCOVERY_SERVICE must be set together")
	}
	if discovery && cfg.logsURL != "" {
		return nil, errors.New("set either NETWORK_LOGS_URL or NETWORK_LOGS_DISCOVERY_*, not both")
	}
	if cfg.logsSecret != "" && cfg.logsTokenFile != "" {
		return nil, errors.New("set at most one of NETWORK_LOGS_RPC_SECRET and NETWORK_LOGS_TOKEN_FILE")
	}
	if cfg.logsDiscoveryPort < 1 || cfg.logsDiscoveryPort > 65535 {
		return nil, errors.New("NETWORK_LOGS_DISCOVERY_PORT must be a port number")
	}

	return cfg, nil
}

func (c *config) logsEnabled() bool {
	return c.logsURL != "" || c.logsDiscoveryService != ""
}

func (c *config) logsEndpoint() string {
	if c.logsURL != "" {
		return c.logsURL
	}
	return "http://" + net.JoinHostPort(c.logsDiscoveryService+"."+c.logsDiscoveryNS, strconv.Itoa(c.logsDiscoveryPort)) + "/rpc"
}

func normalizeDNSServer(server string) (string, error) {
	if addr, err := netip.ParseAddr(server); err == nil {
		return netip.AddrPortFrom(addr, 53).String(), nil
	}
	addrPort, err := netip.ParseAddrPort(server)
	if err != nil {
		return "", fmt.Errorf("invalid DNS server %q", server)
	}
	return addrPort.String(), nil
}

func splitList(raw string) []string {
	return strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ' ' || r == '\n' || r == '\t'
	})
}

type envReader struct {
	getenv func(string) string
	err    error
}

func (e *envReader) string(name, fallback string) string {
	if value := e.getenv(name); value != "" {
		return value
	}
	return fallback
}

func (e *envReader) bool(name string, fallback bool) bool {
	raw := e.getenv(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		e.fail(fmt.Errorf("%s: %w", name, err))
		return fallback
	}
	return value
}

func (e *envReader) int(name string, fallback int) int {
	raw := e.getenv(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		e.fail(fmt.Errorf("%s: %w", name, err))
		return fallback
	}
	return value
}

func (e *envReader) seconds(name string, fallback time.Duration) time.Duration {
	raw := e.getenv(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		e.fail(fmt.Errorf("%s: must be a positive number of seconds", name))
		return fallback
	}
	return time.Duration(value) * time.Second
}

func (e *envReader) fail(err error) {
	if e.err == nil {
		e.err = err
	}
}
