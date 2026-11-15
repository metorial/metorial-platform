package ldrpc

import (
	"bytes"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const (
	SignatureHeader         = "metorial-rpc-signature"
	DefaultSignatureMaxAge  = 60 * time.Second
	hmacSignatureVersion    = "v1"
	ed25519SignatureVersion = "ed25519-v1"
)

var (
	hmacHexPattern      = regexp.MustCompile(`^[a-fA-F0-9]{64}$`)
	digitsPattern       = regexp.MustCompile(`^\d+$`)
	ed25519SafeValue    = regexp.MustCompile(`^[A-Za-z0-9_.:/-]{1,256}$`)
	ed25519NoncePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{32}$`)
	ed25519TsPattern    = regexp.MustCompile(`^\d{1,16}$`)
	ed25519SigPattern   = regexp.MustCompile(`^[A-Za-z0-9_-]{86}$`)
	b64url              = base64.RawURLEncoding
)

// PathAndQuery is the URL part covered by request signatures: the escaped path plus "?query"
// when a query is present, matching `url.pathname + url.search` in JavaScript.
func PathAndQuery(u *url.URL) string {
	if u.RawQuery == "" {
		return u.EscapedPath()
	}
	return u.EscapedPath() + "?" + u.RawQuery
}

func hmacCanonical(timestamp int64, method, pathAndQuery string, body []byte) []byte {
	var b bytes.Buffer
	b.WriteString(hmacSignatureVersion)
	b.WriteByte('\n')
	b.WriteString(strconv.FormatInt(timestamp, 10))
	b.WriteByte('\n')
	b.WriteString(strings.ToUpper(method))
	b.WriteByte('\n')
	b.WriteString(pathAndQuery)
	b.WriteByte('\n')
	b.Write(body)
	return b.Bytes()
}

func hmacSignature(token string, timestamp int64, method, pathAndQuery string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(token))
	mac.Write(hmacCanonical(timestamp, method, pathAndQuery, body))
	return hex.EncodeToString(mac.Sum(nil))
}

// SignHMAC returns a metorial-rpc-signature header value: "t=<unix ms>,v1=<hex hmac-sha256>".
func SignHMAC(token string, at time.Time, method, pathAndQuery string, body []byte) string {
	ts := at.UnixMilli()
	return fmt.Sprintf("t=%d,%s=%s", ts, hmacSignatureVersion, hmacSignature(token, ts, method, pathAndQuery, body))
}

func VerifyHMAC(token, header, method, pathAndQuery string, body []byte, now time.Time, maxAge time.Duration) bool {
	if header == "" || token == "" {
		return false
	}

	values := map[string]string{}
	for part := range strings.SplitSeq(header, ",") {
		key, value, ok := strings.Cut(strings.TrimSpace(part), "=")
		if !ok || key == "" || value == "" {
			return false
		}
		values[key] = value
	}

	tsValue, sig := values["t"], values[hmacSignatureVersion]
	if !digitsPattern.MatchString(tsValue) || !hmacHexPattern.MatchString(sig) {
		return false
	}

	ts, err := strconv.ParseInt(tsValue, 10, 64)
	if err != nil || absDuration(now.Sub(time.UnixMilli(ts))) > maxAge {
		return false
	}

	expected := hmacSignature(token, ts, method, pathAndQuery, body)
	return subtle.ConstantTimeCompare([]byte(expected), []byte(strings.ToLower(sig))) == 1
}

type Ed25519Credentials struct {
	KeyID      string
	Audience   string
	PrivateKey ed25519.PrivateKey
}

type Ed25519Signature struct {
	KeyID     string
	Audience  string
	Timestamp int64
	Nonce     string
	Signature string
}

func digest(value []byte) string {
	sum := sha256.Sum256(value)
	return b64url.EncodeToString(sum[:])
}

// The canonical payload is JSON.stringify([...]) on the TypeScript side; HTML escaping must
// be off so a "&" in the query string serializes the same way.
func ed25519Canonical(meta Ed25519Signature, method, pathAndQuery, authorization string, body []byte) ([]byte, error) {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	err := enc.Encode([]any{
		ed25519SignatureVersion,
		meta.KeyID,
		meta.Audience,
		meta.Timestamp,
		meta.Nonce,
		strings.ToUpper(method),
		pathAndQuery,
		digest([]byte(authorization)),
		digest(body),
	})
	return bytes.TrimRight(b.Bytes(), "\n"), err
}

func SignEd25519(creds Ed25519Credentials, at time.Time, method, pathAndQuery, authorization string, body []byte) (string, error) {
	if !ed25519SafeValue.MatchString(creds.KeyID) || !ed25519SafeValue.MatchString(creds.Audience) {
		return "", errors.New("ldrpc: invalid signature metadata")
	}
	if len(creds.PrivateKey) != ed25519.PrivateKeySize {
		return "", errors.New("ldrpc: invalid ed25519 private key")
	}

	nonce := make([]byte, 24)
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}

	return signEd25519(creds, at, b64url.EncodeToString(nonce), method, pathAndQuery, authorization, body)
}

func signEd25519(creds Ed25519Credentials, at time.Time, nonce, method, pathAndQuery, authorization string, body []byte) (string, error) {
	meta := Ed25519Signature{
		KeyID:     creds.KeyID,
		Audience:  creds.Audience,
		Timestamp: at.UnixMilli(),
		Nonce:     nonce,
	}
	payload, err := ed25519Canonical(meta, method, pathAndQuery, authorization, body)
	if err != nil {
		return "", err
	}

	sig := b64url.EncodeToString(ed25519.Sign(creds.PrivateKey, payload))
	return fmt.Sprintf("version=%s,alg=ed25519,kid=%s,aud=%s,t=%d,nonce=%s,sig=%s",
		ed25519SignatureVersion, meta.KeyID, meta.Audience, meta.Timestamp, meta.Nonce, sig), nil
}

// ParseEd25519Signature validates the header's shape without checking the signature, so a
// server can look up the public key for KeyID first.
func ParseEd25519Signature(header string) (*Ed25519Signature, bool) {
	if header == "" || len(header) > 2048 {
		return nil, false
	}

	values := map[string]string{}
	for part := range strings.SplitSeq(header, ",") {
		key, value, ok := strings.Cut(part, "=")
		key, value = strings.TrimSpace(key), strings.TrimSpace(value)
		if !ok || key == "" || value == "" {
			return nil, false
		}
		if _, dup := values[key]; dup {
			return nil, false
		}
		values[key] = value
	}

	if len(values) != 7 || values["version"] != ed25519SignatureVersion || values["alg"] != "ed25519" {
		return nil, false
	}
	if !ed25519SafeValue.MatchString(values["kid"]) || !ed25519SafeValue.MatchString(values["aud"]) {
		return nil, false
	}
	if !ed25519NoncePattern.MatchString(values["nonce"]) || !ed25519TsPattern.MatchString(values["t"]) {
		return nil, false
	}
	if !ed25519SigPattern.MatchString(values["sig"]) {
		return nil, false
	}

	ts, err := strconv.ParseInt(values["t"], 10, 64)
	if err != nil {
		return nil, false
	}

	return &Ed25519Signature{
		KeyID:     values["kid"],
		Audience:  values["aud"],
		Timestamp: ts,
		Nonce:     values["nonce"],
		Signature: values["sig"],
	}, true
}

func VerifyEd25519(header string, publicKey ed25519.PublicKey, audience, method, pathAndQuery, authorization string, body []byte, now time.Time, maxAge time.Duration) bool {
	meta, ok := ParseEd25519Signature(header)
	if !ok || meta.Audience != audience || len(publicKey) != ed25519.PublicKeySize {
		return false
	}
	if absDuration(now.Sub(time.UnixMilli(meta.Timestamp))) > maxAge {
		return false
	}

	sig, err := b64url.DecodeString(meta.Signature)
	if err != nil {
		return false
	}
	payload, err := ed25519Canonical(*meta, method, pathAndQuery, authorization, body)
	if err != nil {
		return false
	}

	return ed25519.Verify(publicKey, payload, sig)
}

type jwk struct {
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	D   string `json:"d,omitempty"`
}

// ParseEd25519PrivateJWK reads the OKP/Ed25519 JWK format used by @lowerdeck/rpc-signature.
func ParseEd25519PrivateJWK(data []byte) (ed25519.PrivateKey, error) {
	var k jwk
	if err := json.Unmarshal(data, &k); err != nil {
		return nil, err
	}
	if k.Kty != "OKP" || k.Crv != "Ed25519" || k.D == "" {
		return nil, errors.New("ldrpc: not an Ed25519 private JWK")
	}

	seed, err := b64url.DecodeString(k.D)
	if err != nil || len(seed) != ed25519.SeedSize {
		return nil, errors.New("ldrpc: invalid Ed25519 JWK seed")
	}
	return ed25519.NewKeyFromSeed(seed), nil
}

func ParseEd25519PublicJWK(data []byte) (ed25519.PublicKey, error) {
	var k jwk
	if err := json.Unmarshal(data, &k); err != nil {
		return nil, err
	}
	if k.Kty != "OKP" || k.Crv != "Ed25519" || k.X == "" || k.D != "" {
		return nil, errors.New("ldrpc: not an Ed25519 public JWK")
	}

	x, err := b64url.DecodeString(k.X)
	if err != nil || len(x) != ed25519.PublicKeySize {
		return nil, errors.New("ldrpc: invalid Ed25519 JWK public key")
	}
	return ed25519.PublicKey(x), nil
}

func absDuration(d time.Duration) time.Duration {
	if d < 0 {
		return -d
	}
	return d
}
