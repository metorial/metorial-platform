// Package authtest mints invocation tokens and egress grants the way function-bay does, for
// tests of the supervisor.
package authtest

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
)

type Signer struct {
	*egress.SigningKey
}

func NewSigner() *Signer {
	seed := make([]byte, ed25519.SeedSize)
	if _, err := rand.Read(seed); err != nil {
		panic(err)
	}
	key, err := egress.NewSigningKey(seed, "")
	if err != nil {
		panic(err)
	}
	return &Signer{key}
}

func KeysJSON(signers ...*Signer) []byte {
	keys := map[string]string{}
	for _, s := range signers {
		keys[s.KeyID] = egress.EncodePublicKey(s.PublicKey())
	}
	out, _ := json.Marshal(map[string]any{"keys": keys})
	return out
}

// Sign signs arbitrary claims, for tokens function-bay would never mint.
func (s *Signer) Sign(claims map[string]any) string {
	header, _ := json.Marshal(map[string]string{"alg": "EdDSA", "typ": "JWT", "kid": s.KeyID})
	payload, _ := json.Marshal(claims)

	signingInput := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	signature := ed25519.Sign(s.PrivateKey, []byte(signingInput))
	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature)
}

type Invocation struct {
	ID          string
	VersionID   string
	PayloadJSON string
	TTL         time.Duration
	Policy      *policy.Policy
	AllowAll    bool
}

func (s *Signer) InvocationToken(in Invocation) string {
	now := time.Now().Unix()
	token, err := egress.MintInvocationToken(s.SigningKey, egress.InvocationToken{
		Issuer:            "function-bay",
		ID:                in.ID,
		FunctionVersionID: in.VersionID,
		PayloadSHA256:     egress.PayloadSHA256(in.PayloadJSON),
		IssuedAt:          now,
		ExpiresAt:         now + int64(ttl(in).Seconds()),
	})
	if err != nil {
		panic(err)
	}
	return token
}

func (s *Signer) EgressGrant(in Invocation) string {
	now := time.Now().Unix()
	grant, err := egress.MintGrant(s.SigningKey, egress.Grant{
		Issuer:            "function-bay",
		ID:                in.ID,
		TenantID:          "ten_test",
		FunctionID:        "fn_test",
		FunctionVersionID: in.VersionID,
		Source:            egress.SourceKnative,
		Policy:            in.Policy,
		AllowAll:          in.AllowAll,
		IssuedAt:          now,
		NotBefore:         now,
		ExpiresAt:         now + int64(ttl(in).Seconds()) + 30,
	})
	if err != nil {
		panic(err)
	}
	return grant
}

func ttl(in Invocation) time.Duration {
	if in.TTL == 0 {
		return time.Minute
	}
	return in.TTL
}
