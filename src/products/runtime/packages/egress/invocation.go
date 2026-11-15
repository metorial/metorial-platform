package egress

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"time"
)

// InvocationToken is the claim set of a function invocation token. Field order is the
// canonical claim order used for minting.
type InvocationToken struct {
	Issuer            string `json:"iss,omitempty"`
	Audience          string `json:"aud"`
	ID                string `json:"jti"`
	FunctionVersionID string `json:"functionVersionId"`
	PayloadSHA256     string `json:"payloadSha256"`
	IssuedAt          int64  `json:"iat"`
	ExpiresAt         int64  `json:"exp"`
}

// MintInvocationToken signs t. An empty Audience defaults to InvocationAudience.
func MintInvocationToken(key *SigningKey, t InvocationToken) (string, error) {
	if t.Audience == "" {
		t.Audience = InvocationAudience
	}
	return sign(key, t)
}

func VerifyInvocationToken(token string, keys Keys, now time.Time) (*InvocationToken, error) {
	payload, err := verify(token, keys, InvocationAudience, now)
	if err != nil {
		return nil, err
	}

	var claims struct {
		InvocationToken
		Audience json.RawMessage `json:"aud"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, newError(ErrMalformed, "invocation claims have unexpected types")
	}
	t := claims.InvocationToken
	t.Audience = InvocationAudience
	if t.ID == "" || t.FunctionVersionID == "" || !isSHA256Hex(t.PayloadSHA256) {
		return nil, newError(ErrMissingClaims, "jti, functionVersionId and payloadSha256 are required")
	}
	return &t, nil
}

// PayloadSHA256 hashes the exact UTF-8 bytes of payloadJSON as lowercase hex.
func PayloadSHA256(payloadJSON string) string {
	sum := sha256.Sum256([]byte(payloadJSON))
	return hex.EncodeToString(sum[:])
}

func (t *InvocationToken) CheckPayload(payloadJSON string) error {
	if subtle.ConstantTimeCompare([]byte(PayloadSHA256(payloadJSON)), []byte(t.PayloadSHA256)) != 1 {
		return newError(ErrPayloadHash, "")
	}
	return nil
}

// CheckGrant enforces that a grant was minted for this invocation.
func (t *InvocationToken) CheckGrant(g *Grant) error {
	if g == nil || g.ID != t.ID || g.FunctionVersionID != t.FunctionVersionID {
		return newError(ErrBinding, "")
	}
	return nil
}

func isSHA256Hex(value string) bool {
	if len(value) != 64 {
		return false
	}
	for _, r := range value {
		if !(r >= '0' && r <= '9' || r >= 'a' && r <= 'f') {
			return false
		}
	}
	return true
}
