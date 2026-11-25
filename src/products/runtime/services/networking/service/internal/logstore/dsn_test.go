package logstore

import (
	"net/url"
	"testing"
)

func TestDSNMapsNoVerifyToLibpqRequire(t *testing.T) {
	cfg := Config{Host: "db", Port: "5432", Username: "metorial", Password: "pw", SSLMode: "no-verify"}

	parsed, err := url.Parse(cfg.DSN("logs"))
	if err != nil {
		t.Fatal(err)
	}
	if got := parsed.Query().Get("sslmode"); got != "require" {
		t.Fatalf("sslmode = %q, want require", got)
	}
}

func TestDSNPassesRootCert(t *testing.T) {
	cfg := Config{Host: "db", Port: "5432", Username: "metorial", SSLMode: "verify-full", SSLRootCert: "/etc/ca.pem"}

	query, _ := url.Parse(cfg.DSN("logs"))
	if query.Query().Get("sslmode") != "verify-full" || query.Query().Get("sslrootcert") != "/etc/ca.pem" {
		t.Fatalf("unexpected DSN %s", query)
	}
}

func TestDSNServerURLMapsNoVerify(t *testing.T) {
	cfg := Config{ServerURL: "postgres://u:p@db:5432/?sslmode=no-verify"}

	parsed, _ := url.Parse(cfg.DSN("logs"))
	if parsed.Path != "/logs" || parsed.Query().Get("sslmode") != "require" {
		t.Fatalf("unexpected DSN %s", parsed)
	}
}
