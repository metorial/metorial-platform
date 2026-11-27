package store

import (
	"strings"
	"testing"
)

func TestDSNTranslatesNoVerifyForPgx(t *testing.T) {
	cfg := DatabaseConfig{
		ServerURL: "postgres://u:p@db:5432/postgres?sslmode=no-verify&connection_limit=20",
		Name:      "metorial_error_collector",
	}

	dsn := cfg.DSN()
	if !strings.Contains(dsn, "sslmode=require") || strings.Contains(dsn, "no-verify") {
		t.Fatalf("expected sslmode=require, got %s", dsn)
	}
	if strings.Contains(dsn, "connection_limit") {
		t.Fatalf("expected prisma options to be removed, got %s", dsn)
	}
	if !strings.Contains(cfg.maintenanceDSN(), "sslmode=require") {
		t.Fatalf("expected maintenance DSN to be translated, got %s", cfg.maintenanceDSN())
	}
}

func TestDSNKeepsOtherSSLModes(t *testing.T) {
	cfg := DatabaseConfig{URL: "postgres://u:p@db:5432/x?sslmode=verify-full"}
	if !strings.Contains(cfg.DSN(), "sslmode=verify-full") {
		t.Fatalf("unexpected DSN %s", cfg.DSN())
	}
}
