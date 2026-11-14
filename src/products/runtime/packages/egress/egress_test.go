package egress

import (
	"crypto/ed25519"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
)

func testKey(t *testing.T, name string) *SigningKey {
	t.Helper()
	key, err := NewSigningKey(vectorSeed(name), "")
	if err != nil {
		t.Fatal(err)
	}
	return key
}

func TestMintVerifyGrantRoundTrip(t *testing.T) {
	key := testKey(t, "roundtrip")
	keys := NewKeySet(map[string]ed25519.PublicKey{key.KeyID: key.PublicKey()})
	now := time.Unix(1794000000, 0)

	token, err := MintGrant(key, Grant{
		Issuer:            "function-bay",
		ID:                "inv_1",
		TenantID:          "ten_1",
		FunctionID:        "fn_1",
		FunctionVersionID: "fnv_1",
		Source:            SourceLambda,
		Policy:            &policy.Policy{Entries: []policy.Entry{{CIDR: "1.2.3.0/24"}}},
		IssuedAt:          now.Unix(),
		ExpiresAt:         now.Unix() + 60,
	})
	if err != nil {
		t.Fatal(err)
	}

	grant, err := VerifyGrant(token, keys, now)
	if err != nil {
		t.Fatal(err)
	}
	if grant.Audience != GrantAudience || grant.ID != "inv_1" || grant.Rules() == nil {
		t.Fatalf("unexpected grant %+v", grant)
	}
	if grant.Expiry() != now.Add(time.Minute) {
		t.Fatalf("unexpected expiry %s", grant.Expiry())
	}

	if _, err := VerifyInvocationToken(token, keys, now); CodeOf(err) != ErrWrongAudience {
		t.Fatalf("grant accepted as invocation token: %v", err)
	}
}

func TestInvocationTokenChecks(t *testing.T) {
	key := testKey(t, "invocation")
	keys := NewKeySet(map[string]ed25519.PublicKey{key.KeyID: key.PublicKey()})
	now := time.Unix(1794000000, 0)
	payload := `{"a":"ü"}`

	token, err := MintInvocationToken(key, InvocationToken{
		ID:                "inv_1",
		FunctionVersionID: "fnv_1",
		PayloadSHA256:     PayloadSHA256(payload),
		IssuedAt:          now.Unix(),
		ExpiresAt:         now.Unix() + 30,
	})
	if err != nil {
		t.Fatal(err)
	}

	verified, err := VerifyInvocationToken(token, keys, now)
	if err != nil {
		t.Fatal(err)
	}
	if err := verified.CheckPayload(payload); err != nil {
		t.Fatal(err)
	}
	if CodeOf(verified.CheckPayload(`{"a":"u"}`)) != ErrPayloadHash {
		t.Fatal("payload mismatch not detected")
	}
	if err := verified.CheckGrant(&Grant{ID: "inv_1", FunctionVersionID: "fnv_1"}); err != nil {
		t.Fatal(err)
	}
	if CodeOf(verified.CheckGrant(&Grant{ID: "inv_2", FunctionVersionID: "fnv_1"})) != ErrBinding {
		t.Fatal("binding mismatch not detected")
	}
	if CodeOf(verified.CheckGrant(nil)) != ErrBinding {
		t.Fatal("nil grant accepted")
	}
}

func TestParseKeySet(t *testing.T) {
	key := testKey(t, "keyset")
	data, err := json.Marshal(map[string]any{"keys": map[string]string{"k1": EncodePublicKey(key.PublicKey())}})
	if err != nil {
		t.Fatal(err)
	}

	set, err := ParseKeySet(data)
	if err != nil {
		t.Fatal(err)
	}
	if got, ok := set.PublicKey("k1"); !ok || !got.Equal(key.PublicKey()) {
		t.Fatal("key not found")
	}
	if _, ok := set.PublicKey("k2"); ok {
		t.Fatal("unexpected key")
	}

	for _, bad := range []string{
		`{}`,
		`{"keys":{"k":"not base64!"}}`,
		`{"keys":{"k":"AAAA"}}`,
		`{"keys":{"":"` + EncodePublicKey(key.PublicKey()) + `"}}`,
		`[]`,
	} {
		if _, err := ParseKeySet([]byte(bad)); err == nil {
			t.Fatalf("accepted %s", bad)
		}
	}
}

func TestSigningKeyDefaults(t *testing.T) {
	key, err := ParseSigningKey(encodeSegment(vectorSeed("defaults")), "")
	if err != nil {
		t.Fatal(err)
	}
	if key.KeyID != KeyID(key.PublicKey()) || len(key.KeyID) != 16 {
		t.Fatalf("unexpected default kid %q", key.KeyID)
	}

	explicit, err := ParseSigningKey(encodeSegment(vectorSeed("defaults")), "custom")
	if err != nil {
		t.Fatal(err)
	}
	if explicit.KeyID != "custom" {
		t.Fatalf("unexpected kid %q", explicit.KeyID)
	}

	if _, err := ParseSigningKey("AAAA", ""); err == nil {
		t.Fatal("short seed accepted")
	}
}

func TestFileKeySetReloads(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "keys.json")
	first, second := testKey(t, "file-1"), testKey(t, "file-2")

	write := func(keys map[string]ed25519.PublicKey, modTime time.Time) {
		data, err := NewKeySet(keys).MarshalJSON()
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, data, 0o644); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(path, modTime, modTime); err != nil {
			t.Fatal(err)
		}
	}

	base := time.Now().Add(-time.Hour)
	write(map[string]ed25519.PublicKey{"a": first.PublicKey()}, base)

	set, err := NewFileKeySet(path, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	clock := time.Now()
	set.now = func() time.Time { return clock }

	if _, ok := set.PublicKey("a"); !ok {
		t.Fatal("initial key missing")
	}

	write(map[string]ed25519.PublicKey{"a": first.PublicKey(), "b": second.PublicKey()}, base.Add(time.Minute))
	if _, ok := set.PublicKey("b"); ok {
		t.Fatal("reloaded before the check interval")
	}
	clock = clock.Add(2 * time.Second)
	if _, ok := set.PublicKey("b"); !ok {
		t.Fatal("new key not picked up")
	}

	if err := os.WriteFile(path, []byte("{broken"), 0o644); err != nil {
		t.Fatal(err)
	}
	clock = clock.Add(2 * time.Second)
	if _, ok := set.PublicKey("b"); !ok {
		t.Fatal("broken file dropped the last good key set")
	}
	if set.LastError() == nil {
		t.Fatal("expected reload error")
	}

	if _, err := NewFileKeySet(filepath.Join(dir, "missing.json"), time.Second); err == nil {
		t.Fatal("missing file accepted")
	}
}
