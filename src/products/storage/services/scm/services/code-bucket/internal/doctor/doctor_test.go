package doctor

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"testing"
	"testing/fstest"

	lowerdeck "github.com/metorial/metorial-platform/src/lib/doctor/go"
)

func run(t *testing.T, check lowerdeck.Check) *lowerdeck.CheckResult {
	t.Helper()

	d := lowerdeck.New(lowerdeck.Options{Component: "test"})
	if err := d.Register(check); err != nil {
		t.Fatal(err)
	}

	report, err := d.Run(context.Background(), true)
	if err != nil {
		t.Fatal(err)
	}
	return &report.Checks[0]
}

func TestFingerprint(t *testing.T) {
	sum := sha256.Sum256([]byte("secret"))
	if got, want := Fingerprint("secret"), hex.EncodeToString(sum[:])[:12]; got != want {
		t.Fatalf("Fingerprint = %q, want %q", got, want)
	}
}

func TestLoopback(t *testing.T) {
	cases := map[string]string{":5050": "127.0.0.1:5050", "0.0.0.0:5050": "127.0.0.1:5050", "rpc:5050": "rpc:5050"}
	for input, want := range cases {
		if got := loopback(input); got != want {
			t.Errorf("loopback(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestJWTSecret(t *testing.T) {
	if result := run(t, jwtSecretCheck("short")); result.Status != lowerdeck.StatusFail {
		t.Fatalf("short secret: status %s", result.Status)
	}

	if result := run(t, jwtSecretCheck("0123456789abcdef0123456789abcdef")); result.Status != lowerdeck.StatusPass {
		t.Fatalf("valid secret: status %s", result.Status)
	}
}

func TestEditorURL(t *testing.T) {
	if result := run(t, editorURLCheck("https://x.example/code-bucket-api/", "https://x.example")); result.Status != lowerdeck.StatusPass {
		t.Fatalf("matching URL: status %s", result.Status)
	}

	if result := run(t, editorURLCheck("http://localhost:52091", "https://x.example")); result.Status != lowerdeck.StatusWarn {
		t.Fatalf("mismatched URL: status %s", result.Status)
	}
}

func TestWorkspaceAssets(t *testing.T) {
	present := func() (fs.FS, error) { return fstest.MapFS{"index.html": {Data: []byte("x")}}, nil }
	if result := run(t, workspaceAssetsCheck(present)); result.Status != lowerdeck.StatusPass {
		t.Fatalf("present assets: status %s", result.Status)
	}

	missing := func() (fs.FS, error) { return fstest.MapFS{}, nil }
	if result := run(t, workspaceAssetsCheck(missing)); result.Status != lowerdeck.StatusFail {
		t.Fatalf("missing assets: status %s", result.Status)
	}
}
