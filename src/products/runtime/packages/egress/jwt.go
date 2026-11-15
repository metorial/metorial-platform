package egress

import (
	"bytes"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

const (
	GrantAudience      = "metorial-egress"
	InvocationAudience = "metorial-function-invoke"
	ClockSkew          = 30 * time.Second

	maxTokenBytes = 64 << 10
)

type ErrorCode string

const (
	ErrMalformed      ErrorCode = "malformed"
	ErrUnsupportedAlg ErrorCode = "unsupported_alg"
	ErrUnknownKid     ErrorCode = "unknown_kid"
	ErrBadSignature   ErrorCode = "bad_signature"
	ErrWrongAudience  ErrorCode = "wrong_audience"
	ErrExpired        ErrorCode = "expired"
	ErrNotYetValid    ErrorCode = "not_yet_valid"
	ErrIssuedInFuture ErrorCode = "issued_in_future"
	ErrMissingClaims  ErrorCode = "missing_claims"
	ErrInvalidPolicy  ErrorCode = "invalid_policy"
	ErrPayloadHash    ErrorCode = "payload_mismatch"
	ErrBinding        ErrorCode = "binding_mismatch"
)

type Error struct {
	Code    ErrorCode
	Message string
}

func (e *Error) Error() string {
	if e.Message == "" {
		return "egress: " + string(e.Code)
	}
	return "egress: " + string(e.Code) + ": " + e.Message
}

func newError(code ErrorCode, message string) *Error {
	return &Error{Code: code, Message: message}
}

// CodeOf returns the ErrorCode of err, or "" when err isn't an *Error.
func CodeOf(err error) ErrorCode {
	var e *Error
	if errors.As(err, &e) {
		return e.Code
	}
	return ""
}

type header struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
	Kid string `json:"kid"`
}

type registeredClaims struct {
	Audience  json.RawMessage `json:"aud"`
	IssuedAt  *int64          `json:"iat"`
	NotBefore *int64          `json:"nbf"`
	ExpiresAt *int64          `json:"exp"`
}

func sign(key *SigningKey, claims any) (string, error) {
	if key == nil || len(key.PrivateKey) != ed25519.PrivateKeySize {
		return "", errors.New("egress: signing key is required")
	}

	headerJSON, err := marshalCompact(header{Alg: "EdDSA", Typ: "JWT", Kid: key.KeyID})
	if err != nil {
		return "", err
	}
	payloadJSON, err := marshalCompact(claims)
	if err != nil {
		return "", err
	}

	signingInput := encodeSegment(headerJSON) + "." + encodeSegment(payloadJSON)
	signature := ed25519.Sign(key.PrivateKey, []byte(signingInput))
	return signingInput + "." + encodeSegment(signature), nil
}

// marshalCompact matches JSON.stringify for the claim types used here: no HTML escaping,
// no trailing newline.
func marshalCompact(value any) ([]byte, error) {
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(buf.Bytes(), []byte("\n")), nil
}

func encodeSegment(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}

// verify checks structure, header, kid and signature, then the audience and times, and
// returns the raw payload. Checks run in this order so error codes are stable.
func verify(token string, keys Keys, audience string, now time.Time) ([]byte, error) {
	if len(token) > maxTokenBytes {
		return nil, newError(ErrMalformed, "token too large")
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, newError(ErrMalformed, "expected three segments")
	}

	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, newError(ErrMalformed, "header is not base64url")
	}
	var h header
	if err := json.Unmarshal(headerJSON, &h); err != nil {
		return nil, newError(ErrMalformed, "header is not JSON")
	}
	if h.Alg != "EdDSA" {
		return nil, newError(ErrUnsupportedAlg, h.Alg)
	}
	if h.Typ != "" && h.Typ != "JWT" {
		return nil, newError(ErrMalformed, "unexpected typ")
	}

	if keys == nil {
		return nil, newError(ErrUnknownKid, h.Kid)
	}
	key, ok := keys.PublicKey(h.Kid)
	if !ok || h.Kid == "" {
		return nil, newError(ErrUnknownKid, h.Kid)
	}

	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || len(signature) != ed25519.SignatureSize {
		return nil, newError(ErrBadSignature, "")
	}
	if !ed25519.Verify(key, []byte(parts[0]+"."+parts[1]), signature) {
		return nil, newError(ErrBadSignature, "")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, newError(ErrMalformed, "payload is not base64url")
	}
	var claims registeredClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, newError(ErrMalformed, "payload is not a JSON object")
	}

	if !audienceMatches(claims.Audience, audience) {
		return nil, newError(ErrWrongAudience, "")
	}

	unix := now.Unix()
	skew := int64(ClockSkew / time.Second)
	if claims.ExpiresAt == nil || claims.IssuedAt == nil {
		return nil, newError(ErrMissingClaims, "iat and exp are required")
	}
	if unix > *claims.ExpiresAt+skew {
		return nil, newError(ErrExpired, "")
	}
	if claims.NotBefore != nil && unix+skew < *claims.NotBefore {
		return nil, newError(ErrNotYetValid, "")
	}
	if unix+skew < *claims.IssuedAt {
		return nil, newError(ErrIssuedInFuture, "")
	}

	return payload, nil
}

func audienceMatches(raw json.RawMessage, audience string) bool {
	var single string
	if err := json.Unmarshal(raw, &single); err == nil {
		return single == audience
	}
	var many []string
	if err := json.Unmarshal(raw, &many); err == nil {
		for _, candidate := range many {
			if candidate == audience {
				return true
			}
		}
	}
	return false
}
