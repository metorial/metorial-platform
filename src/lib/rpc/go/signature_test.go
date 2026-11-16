package ldrpc

import (
	"net/url"
	"testing"
	"time"
)

func TestHMACMatchesTypeScript(t *testing.T) {
	v := loadVectors(t).HMAC
	u, _ := url.Parse(v.URL)
	at := time.UnixMilli(v.Timestamp)

	if got := SignHMAC(v.Token, at, v.Method, PathAndQuery(u), []byte(v.Body)); got != v.Header {
		t.Fatalf("got %s, want %s", got, v.Header)
	}
	if !VerifyHMAC(v.Token, v.Header, v.Method, PathAndQuery(u), []byte(v.Body), at, DefaultSignatureMaxAge) {
		t.Fatal("expected TypeScript signature to verify")
	}
	if VerifyHMAC(v.Token, v.Header, v.Method, PathAndQuery(u), []byte(v.Body+" "), at, DefaultSignatureMaxAge) {
		t.Fatal("tampered body verified")
	}
	if VerifyHMAC(v.Token, v.Header, v.Method, PathAndQuery(u), []byte(v.Body), at.Add(2*time.Minute), DefaultSignatureMaxAge) {
		t.Fatal("expired signature verified")
	}
}

func TestEd25519MatchesTypeScript(t *testing.T) {
	v := loadVectors(t).Ed25519
	u, _ := url.Parse(v.URL)
	at := time.UnixMilli(v.Timestamp)

	priv, err := ParseEd25519PrivateJWK(v.PrivateJWK)
	if err != nil {
		t.Fatal(err)
	}
	pub, err := ParseEd25519PublicJWK(v.PublicJWK)
	if err != nil {
		t.Fatal(err)
	}

	creds := Ed25519Credentials{KeyID: v.KeyID, Audience: v.Audience, PrivateKey: priv}
	got, err := signEd25519(creds, at, v.Nonce, v.Method, PathAndQuery(u), v.Authorization, []byte(v.Body))
	if err != nil {
		t.Fatal(err)
	}
	if got != v.Header {
		t.Fatalf("got %s, want %s", got, v.Header)
	}

	verify := func(header, audience, authorization string, now time.Time) bool {
		return VerifyEd25519(header, pub, audience, v.Method, PathAndQuery(u), authorization, []byte(v.Body), now, DefaultSignatureMaxAge)
	}
	if !verify(v.Header, v.Audience, v.Authorization, at) {
		t.Fatal("expected TypeScript signature to verify")
	}
	if verify(v.Header, "other", v.Authorization, at) {
		t.Fatal("wrong audience verified")
	}
	if verify(v.Header, v.Audience, "Bearer other", at) {
		t.Fatal("changed authorization verified")
	}
	if verify(v.Header, v.Audience, v.Authorization, at.Add(-2*time.Minute)) {
		t.Fatal("expired signature verified")
	}

	fresh, err := SignEd25519(creds, time.Now(), v.Method, PathAndQuery(u), v.Authorization, []byte(v.Body))
	if err != nil {
		t.Fatal(err)
	}
	if !verify(fresh, v.Audience, v.Authorization, time.Now()) {
		t.Fatal("expected fresh signature to verify")
	}
}
