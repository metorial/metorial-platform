package main

import (
	"context"
	"crypto/ed25519"
	"os"
	"path/filepath"
	"testing"
	"time"

	doctor "github.com/metorial/metorial-platform/src/lib/doctor/go"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
)

func TestHostPort(t *testing.T) {
	cases := map[string]string{
		"http://network-logs:52250/rpc": "network-logs:52250",
		"https://logs.example.com":      "logs.example.com:443",
	}
	for input, want := range cases {
		got, err := hostPort(input)
		if err != nil || got != want {
			t.Errorf("hostPort(%q) = %q, %v; want %q", input, got, err, want)
		}
	}

	if _, err := hostPort("network-logs"); err == nil {
		t.Error("hostPort accepted an address without a scheme or port")
	}
}

func TestNetworkLogsWarnsWhenNotConfigured(t *testing.T) {
	d := doctor.New(doctor.Options{Component: "test"})
	if err := d.Register(networkLogsCheck(&config{})); err != nil {
		t.Fatal(err)
	}

	report, err := d.Run(context.Background(), true)
	if err != nil {
		t.Fatal(err)
	}
	if status := report.Checks[0].Status; status != doctor.StatusWarn {
		t.Fatalf("status %s, want warn", status)
	}
}

func runGrantKeysCheck(t *testing.T, cfg *config, uptime time.Duration) doctor.CheckResult {
	t.Helper()
	started := time.Now()
	d := doctor.New(doctor.Options{Component: "test"})
	if err := d.Register(grantKeysCheck(cfg, started, func() time.Time { return started.Add(uptime) })); err != nil {
		t.Fatal(err)
	}

	report, err := d.Run(context.Background(), true)
	if err != nil {
		t.Fatal(err)
	}
	return report.Checks[0]
}

func TestGrantKeysWaitsForPublishedFileAtStartup(t *testing.T) {
	cfg := &config{publicKeysFile: filepath.Join(t.TempDir(), "keys.json")}

	if status := runGrantKeysCheck(t, cfg, 30*time.Second).Status; status != doctor.StatusWarn {
		t.Fatalf("missing file right after start: status %s, want warn", status)
	}
	if status := runGrantKeysCheck(t, cfg, 3*time.Minute).Status; status != doctor.StatusFail {
		t.Fatalf("missing file after the grace period: status %s, want fail", status)
	}

	if err := os.WriteFile(cfg.publicKeysFile, []byte(`{"keys":{}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if status := runGrantKeysCheck(t, cfg, 30*time.Second).Status; status != doctor.StatusWarn {
		t.Fatalf("empty file right after start: status %s, want warn", status)
	}
	if status := runGrantKeysCheck(t, cfg, 3*time.Minute).Status; status != doctor.StatusFail {
		t.Fatalf("empty file after the grace period: status %s, want fail", status)
	}

	if err := os.WriteFile(cfg.publicKeysFile, []byte("{broken"), 0o644); err != nil {
		t.Fatal(err)
	}
	if status := runGrantKeysCheck(t, cfg, 30*time.Second).Status; status != doctor.StatusFail {
		t.Fatalf("broken file: status %s, want fail", status)
	}
}

func TestGrantKeysFromEnvFailsImmediately(t *testing.T) {
	if status := runGrantKeysCheck(t, &config{}, 0).Status; status != doctor.StatusFail {
		t.Fatalf("no keys from the environment: status %s, want fail", status)
	}
}

func TestGrantKeysReady(t *testing.T) {
	dir := t.TempDir()
	file := filepath.Join(dir, "keys.json")
	cfg := &config{publicKeysFile: file}

	if err := grantKeysReady(cfg); err == nil {
		t.Fatal("expected not ready without the key file")
	}

	if err := os.WriteFile(file, []byte("not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := grantKeysReady(cfg); err == nil {
		t.Fatal("expected not ready with an unparsable key file")
	}

	public, _, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	keys := `{"keys":{"functions-1":"` + egress.EncodePublicKey(public) + `"}}`
	if err := os.WriteFile(file, []byte(keys), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := grantKeysReady(cfg); err != nil {
		t.Fatalf("expected ready once the keys are published: %v", err)
	}
}
