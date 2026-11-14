package auth_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/auth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/supervisor/auth/authtest"
)

const versionID = "fnv_1"

func newVerifier(t *testing.T, signers ...*authtest.Signer) *auth.Verifier {
	t.Helper()
	keys, err := egress.ParseKeySet(authtest.KeysJSON(signers...))
	if err != nil {
		t.Fatal(err)
	}
	return &auth.Verifier{Keys: keys, VersionID: versionID, Replay: auth.NewReplayCache(0, nil)}
}

func invocation(s *authtest.Signer, id, payload string) auth.Invocation {
	in := authtest.Invocation{ID: id, VersionID: versionID, PayloadJSON: payload}
	return auth.Invocation{
		VersionID:       versionID,
		PayloadJSON:     payload,
		InvocationToken: s.InvocationToken(in),
		EgressGrant:     s.EgressGrant(in),
	}
}

func expectReason(t *testing.T, r *auth.Rejection, reason string) {
	t.Helper()
	if r == nil {
		t.Fatalf("expected rejection %q, got success", reason)
	}
	if r.Reason != reason {
		t.Fatalf("expected rejection %q, got %q (%s)", reason, r.Reason, r.Detail)
	}
}

func TestVerifyAcceptsValidPair(t *testing.T) {
	s := authtest.NewSigner()
	v := newVerifier(t, s)

	verified, r := v.Verify(invocation(s, "inv_1", `{"ünïcödé":"✓"}`))
	if r != nil {
		t.Fatal(r)
	}
	if verified.InvocationID != "inv_1" || verified.Grant.FunctionVersionID != versionID {
		t.Fatalf("unexpected verified result %+v", verified)
	}
}

func TestVerifyRejections(t *testing.T) {
	s := authtest.NewSigner()
	other := authtest.NewSigner()
	now := time.Now().Unix()

	cases := []struct {
		name   string
		mutate func(in *auth.Invocation)
		reason string
	}{
		{"unsigned token", func(in *auth.Invocation) {
			parts := strings.Split(in.InvocationToken, ".")
			in.InvocationToken = parts[0] + "." + parts[1] + "."
		}, "token_bad_signature"},
		{"garbage token", func(in *auth.Invocation) { in.InvocationToken = "nope" }, "token_malformed"},
		{"alg none", func(in *auth.Invocation) {
			parts := strings.Split(in.InvocationToken, ".")
			in.InvocationToken = "eyJhbGciOiJub25lIiwia2lkIjoieCJ9." + parts[1] + "."
		}, "token_unsupported_alg"},
		{"untrusted key", func(in *auth.Invocation) {
			in.InvocationToken = other.InvocationToken(authtest.Invocation{ID: "inv", VersionID: versionID, PayloadJSON: in.PayloadJSON})
		}, "token_unknown_kid"},
		{"tampered payload", func(in *auth.Invocation) { in.PayloadJSON = `{"a":2}` }, "payload_mismatch"},
		{"input version mismatch", func(in *auth.Invocation) { in.VersionID = "fnv_other" }, "version_mismatch"},
		{"token for another version", func(in *auth.Invocation) {
			in.InvocationToken = s.InvocationToken(authtest.Invocation{ID: "inv", VersionID: "fnv_other", PayloadJSON: in.PayloadJSON})
		}, "token_version_mismatch"},
		{"expired token", func(in *auth.Invocation) {
			in.InvocationToken = s.Sign(map[string]any{
				"aud": egress.InvocationAudience, "jti": "inv", "functionVersionId": versionID,
				"payloadSha256": egress.PayloadSHA256(in.PayloadJSON), "iat": now - 600, "exp": now - 31,
			})
		}, "token_expired"},
		{"token from the future", func(in *auth.Invocation) {
			in.InvocationToken = s.Sign(map[string]any{
				"aud": egress.InvocationAudience, "jti": "inv", "functionVersionId": versionID,
				"payloadSha256": egress.PayloadSHA256(in.PayloadJSON), "iat": now + 120, "exp": now + 600,
			})
		}, "token_issued_in_future"},
		{"grant used as token", func(in *auth.Invocation) { in.InvocationToken = in.EgressGrant }, "token_wrong_audience"},
		{"token used as grant", func(in *auth.Invocation) { in.EgressGrant = in.InvocationToken }, "grant_wrong_audience"},
		{"unsigned grant", func(in *auth.Invocation) {
			parts := strings.Split(in.EgressGrant, ".")
			in.EgressGrant = parts[0] + "." + parts[1] + "."
		}, "grant_bad_signature"},
		{"grant from another invocation", func(in *auth.Invocation) {
			in.EgressGrant = s.EgressGrant(authtest.Invocation{ID: "inv_other", VersionID: versionID})
		}, "grant_binding_mismatch"},
		{"grant for another version", func(in *auth.Invocation) {
			in.EgressGrant = s.EgressGrant(authtest.Invocation{ID: "inv", VersionID: "fnv_other"})
		}, "grant_binding_mismatch"},
		{"expired grant", func(in *auth.Invocation) {
			in.EgressGrant = s.Sign(map[string]any{
				"aud": egress.GrantAudience, "jti": "inv", "functionVersionId": versionID, "tenantId": "t",
				"functionId": "f", "source": "knative", "iat": now - 600, "exp": now - 31,
			})
		}, "grant_expired"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			v := newVerifier(t, s)
			in := invocation(s, "inv", `{"a":1}`)
			tc.mutate(&in)

			_, r := v.Verify(in)
			expectReason(t, r, tc.reason)
		})
	}
}

func TestVerifyRejectsReplayButNotAfterRejection(t *testing.T) {
	s := authtest.NewSigner()
	v := newVerifier(t, s)
	in := invocation(s, "inv_replay", `{}`)

	tampered := in
	tampered.PayloadJSON = `{"x":1}`
	_, r := v.Verify(tampered)
	expectReason(t, r, "payload_mismatch")

	if _, r := v.Verify(in); r != nil {
		t.Fatalf("first use rejected: %v", r)
	}
	_, r = v.Verify(in)
	expectReason(t, r, "replayed")
}

func TestReplayCacheExpiresAndBounds(t *testing.T) {
	now := time.Unix(1000, 0)
	cache := auth.NewReplayCache(2, func() time.Time { return now })

	if r := cache.Add("a", now.Add(time.Minute)); r != nil {
		t.Fatal(r)
	}
	if r := cache.Add("b", now.Add(2*time.Minute)); r != nil {
		t.Fatal(r)
	}
	expectReason(t, cache.Add("a", now.Add(time.Minute)), "replayed")
	expectReason(t, cache.Add("c", now.Add(time.Minute)), "replay_cache_full")

	now = now.Add(90 * time.Second)
	if r := cache.Add("c", now.Add(time.Minute)); r != nil {
		t.Fatalf("expected expired entry to be pruned: %v", r)
	}
	expectReason(t, cache.Add("a", now.Add(time.Minute)), "replay_cache_full")
	if cache.Len() != 2 {
		t.Fatalf("unexpected cache size %d", cache.Len())
	}
}

func TestFileKeysLoadLateAndRotate(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "keys.json")
	first := authtest.NewSigner()
	second := authtest.NewSigner()

	keys := auth.NewFileKeys(path)
	if _, ok := keys.PublicKey(first.KeyID); ok {
		t.Fatal("key served before the file existed")
	}

	if err := os.WriteFile(path, authtest.KeysJSON(first), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, ok := keys.PublicKey(first.KeyID); !ok {
		t.Fatal("key not loaded once the file appeared")
	}

	next := filepath.Join(dir, "next.json")
	if err := os.WriteFile(next, authtest.KeysJSON(first, second), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(next, path); err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(3 * time.Second)
	for {
		if _, ok := keys.PublicKey(second.KeyID); ok {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("rotated key was never picked up")
		}
		time.Sleep(50 * time.Millisecond)
	}
}
