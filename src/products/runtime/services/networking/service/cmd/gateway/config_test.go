package main

import (
	"strings"
	"testing"
	"time"
)

const testKeys = `{"keys":{"k1":"11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"}}`

func envMap(values map[string]string) func(string) string {
	return func(name string) string { return values[name] }
}

func TestLoadConfigDefaults(t *testing.T) {
	cfg, err := loadConfig(envMap(map[string]string{
		"EGRESS_GRANT_PUBLIC_KEYS":     testKeys,
		"EGRESS_GATEWAY_TLS_CERT_FILE": "/tls/tls.crt",
		"EGRESS_GATEWAY_TLS_KEY_FILE":  "/tls/tls.key",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.tunnelAddr != ":8443" || cfg.proxyAddr != ":8080" || cfg.metricsAddr != ":9090" || !cfg.tls {
		t.Fatalf("listeners %+v", cfg)
	}
	if cfg.allowInternalDestinations || !cfg.denyOwnAddresses || cfg.logsEnabled() {
		t.Fatalf("defaults %+v", cfg)
	}
	if cfg.flushInterval != time.Minute || cfg.maxBufferAge != 15*time.Minute || cfg.dialTimeout != 10*time.Second || cfg.idleTimeout != 10*time.Minute {
		t.Fatalf("durations %+v", cfg)
	}
	if cfg.publicKeys.Len() != 1 {
		t.Fatalf("keys %d", cfg.publicKeys.Len())
	}
}

func TestLoadConfigOnPremWithDiscoveryAndHardDeny(t *testing.T) {
	cfg, err := loadConfig(envMap(map[string]string{
		"EGRESS_GRANT_PUBLIC_KEYS_FILE":    "/trust/keys.json",
		"EGRESS_GATEWAY_TLS":               "false",
		"ALLOW_INTERNAL_DESTINATIONS":      "true",
		"HARD_DENY_CIDRS":                  "10.42.0.0/16, 10.43.0.0/16\nfd42::/48",
		"EGRESS_DNS_SERVERS":               "10.43.0.10,1.1.1.1:5353",
		"NETWORK_LOGS_DISCOVERY_NAMESPACE": "metorial.local",
		"NETWORK_LOGS_DISCOVERY_SERVICE":   "network-logs",
		"NETWORK_LOGS_RPC_SECRET":          "s",
	}))
	if err != nil {
		t.Fatal(err)
	}
	if !cfg.allowInternalDestinations || len(cfg.hardDeny) != 3 || len(cfg.dnsServers) != 2 {
		t.Fatalf("cfg %+v", cfg)
	}
	if !cfg.logsEnabled() || cfg.logsEndpoint() != "http://network-logs.metorial.local:52250/rpc" {
		t.Fatalf("logs endpoint %q", cfg.logsEndpoint())
	}
}

func TestLoadConfigRejectsInvalidSettings(t *testing.T) {
	base := map[string]string{"EGRESS_GRANT_PUBLIC_KEYS": testKeys, "EGRESS_GATEWAY_TLS": "false"}
	cases := map[string]map[string]string{
		"no keys":                 {"EGRESS_GRANT_PUBLIC_KEYS": "", "EGRESS_GATEWAY_TLS": "false"},
		"both key sources":        {"EGRESS_GRANT_PUBLIC_KEYS_FILE": "/k"},
		"bad keys":                {"EGRESS_GRANT_PUBLIC_KEYS": `{"keys":{"a":"short"}}`},
		"tls without cert":        {"EGRESS_GATEWAY_TLS": "true"},
		"bad cidr":                {"HARD_DENY_CIDRS": "10.0.0.0/33"},
		"bad bool":                {"ALLOW_INTERNAL_DESTINATIONS": "maybe"},
		"bad seconds":             {"EGRESS_DIAL_TIMEOUT_SECONDS": "0"},
		"bad dns server":          {"EGRESS_DNS_SERVERS": "dns.example"},
		"half discovery":          {"NETWORK_LOGS_DISCOVERY_SERVICE": "network-logs"},
		"url and discovery":       {"NETWORK_LOGS_URL": "http://x/rpc", "NETWORK_LOGS_DISCOVERY_SERVICE": "a", "NETWORK_LOGS_DISCOVERY_NAMESPACE": "b"},
		"secret and token file":   {"NETWORK_LOGS_RPC_SECRET": "s", "NETWORK_LOGS_TOKEN_FILE": "/t"},
		"both front ends off":     {"EGRESS_GATEWAY_TUNNEL_ADDR": "off", "EGRESS_GATEWAY_PROXY_ADDR": "off"},
		"discovery port too high": {"NETWORK_LOGS_DISCOVERY_PORT": "70000"},
	}

	for name, overrides := range cases {
		values := map[string]string{}
		for key, value := range base {
			values[key] = value
		}
		for key, value := range overrides {
			values[key] = value
		}
		if _, err := loadConfig(envMap(values)); err == nil {
			t.Errorf("%s: expected an error", name)
		} else if strings.TrimSpace(err.Error()) == "" {
			t.Errorf("%s: empty error", name)
		}
	}
}
