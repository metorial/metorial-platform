package main

import (
	"testing"
	"time"
)

func TestLoadConfig(t *testing.T) {
	database := map[string]string{
		"DATABASE_HOST": "db", "DATABASE_PORT": "5432", "DATABASE_NAME": "network_logs", "DATABASE_USERNAME": "u",
	}
	with := func(extra map[string]string) func(string) string {
		values := map[string]string{}
		for key, value := range database {
			values[key] = value
		}
		for key, value := range extra {
			values[key] = value
		}
		return func(name string) string { return values[name] }
	}

	cfg, err := loadConfig(with(map[string]string{"NETWORK_LOGS_RPC_SECRET": "s", "OBSERVER_RETENTION_HOURS": "48"}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.rpcAddr != ":52250" || cfg.legacyIngestAddr != ":52210" || cfg.legacyQueryAddr != ":52211" || cfg.authMode != "hmac" {
		t.Fatalf("defaults %+v", cfg)
	}
	if cfg.retention != 48*time.Hour || cfg.cleanupInterval != time.Hour || cfg.database.SSLMode != "require" {
		t.Fatalf("durations %+v", cfg)
	}

	cfg, err = loadConfig(with(map[string]string{"NETWORK_LOGS_AUTH": "kubeauth", "POD_NAMESPACE": "metorial", "NETWORK_LOGS_RETENTION_HOURS": "24", "OBSERVER_RETENTION_HOURS": "48"}))
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.ingestAccounts) != 1 || cfg.ingestAccounts[0] != "metorial/metorial-egress-gateway" || cfg.listAccounts[0] != "metorial/metorial-functions" {
		t.Fatalf("accounts %+v", cfg)
	}
	if cfg.retention != 24*time.Hour || cfg.kubeAudience != "metorial-network-logs" {
		t.Fatalf("kubeauth cfg %+v", cfg)
	}

	for name, extra := range map[string]map[string]string{
		"hmac without secret":    {},
		"kubeauth with secret":   {"NETWORK_LOGS_AUTH": "kubeauth", "POD_NAMESPACE": "m", "NETWORK_LOGS_RPC_SECRET": "s"},
		"unknown auth":           {"NETWORK_LOGS_AUTH": "none"},
		"bad retention":          {"NETWORK_LOGS_RPC_SECRET": "s", "NETWORK_LOGS_RETENTION_HOURS": "-1"},
		"all listeners disabled": {"NETWORK_LOGS_RPC_SECRET": "s", "NETWORK_LOGS_RPC_ADDR": "off", "OBSERVER_INGEST_ADDR": "off", "OBSERVER_QUERY_ADDR": "off"},
	} {
		if _, err := loadConfig(with(extra)); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
	if _, err := loadConfig(func(name string) string { return map[string]string{"NETWORK_LOGS_RPC_SECRET": "s"}[name] }); err == nil {
		t.Error("missing database: expected an error")
	}
}
