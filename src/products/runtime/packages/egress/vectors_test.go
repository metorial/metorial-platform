package egress

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"flag"
	"net/netip"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
)

var updateVectors = flag.Bool("update", false, "rewrite testdata/vectors.json")

const vectorsPath = "testdata/vectors.json"

const vectorNow int64 = 1794000000

type vectorFile struct {
	Version          int                `json:"version"`
	Description      []string           `json:"description"`
	Now              int64              `json:"now"`
	ClockSkewSeconds int64              `json:"clockSkewSeconds"`
	Keys             []vectorKey        `json:"keys"`
	KeySet           json.RawMessage    `json:"keySet"`
	Grants           []tokenVector      `json:"grants"`
	InvocationTokens []tokenVector      `json:"invocationTokens"`
	PayloadHashes    []payloadHash      `json:"payloadHashes"`
	Policy           policyVectorDomain `json:"policy"`
}

type vectorKey struct {
	Name      string `json:"name"`
	Kid       string `json:"kid"`
	Seed      string `json:"seed"`
	PublicKey string `json:"publicKey"`
	Trusted   bool   `json:"trusted"`
}

type tokenExpectation struct {
	Valid bool      `json:"valid"`
	Error ErrorCode `json:"error,omitempty"`
}

type tokenVector struct {
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Signer      string           `json:"signer,omitempty"`
	Mintable    bool             `json:"mintable"`
	HeaderJSON  string           `json:"headerJson,omitempty"`
	ClaimsJSON  string           `json:"claimsJson,omitempty"`
	Claims      json.RawMessage  `json:"claims,omitempty"`
	Token       string           `json:"token"`
	Expect      tokenExpectation `json:"expect"`

	PayloadJSON   *string   `json:"payloadJson,omitempty"`
	ExpectPayload ErrorCode `json:"expectPayload,omitempty"`
	BindGrant     string    `json:"bindGrant,omitempty"`
	ExpectBinding ErrorCode `json:"expectBinding,omitempty"`
}

type payloadHash struct {
	Description string `json:"description"`
	PayloadJSON string `json:"payloadJson"`
	SHA256      string `json:"sha256"`
}

type policyVectorDomain struct {
	InternalRanges []string                  `json:"internalRanges"`
	HardDenyRanges []string                  `json:"hardDenyRanges"`
	Configs        map[string]policyConfig   `json:"configs"`
	Grants         map[string]policyGrantRef `json:"grants"`
	Cases          []policyCase              `json:"cases"`
}

type policyConfig struct {
	AllowInternalDestinations bool     `json:"allowInternalDestinations"`
	HardDenyCIDRs             []string `json:"hardDenyCidrs"`
}

type policyGrantRef struct {
	Policy   *policy.Policy `json:"policy,omitempty"`
	AllowAll bool           `json:"allowAll,omitempty"`
}

type policyCase struct {
	Name   string         `json:"name"`
	Config string         `json:"config"`
	Grant  string         `json:"grant"`
	Host   string         `json:"host,omitempty"`
	IP     string         `json:"ip"`
	Port   int            `json:"port"`
	Expect policy.Verdict `json:"expect"`
}

func TestVectors(t *testing.T) {
	if *updateVectors {
		generated := generateVectors(t)
		data, err := marshalVectors(generated)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(vectorsPath, data, 0o644); err != nil {
			t.Fatal(err)
		}
	}

	data, err := os.ReadFile(vectorsPath)
	if err != nil {
		t.Fatal(err)
	}
	var file vectorFile
	if err := json.Unmarshal(data, &file); err != nil {
		t.Fatal(err)
	}

	regenerated, err := marshalVectors(generateVectors(t))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(regenerated, data) {
		t.Fatalf("%s is stale; run go test ./packages/egress -run TestVectors -update", vectorsPath)
	}

	runVectorFile(t, file)
}

func runVectorFile(t *testing.T, file vectorFile) {
	now := time.Unix(file.Now, 0)
	keys, err := ParseKeySet(file.KeySet)
	if err != nil {
		t.Fatal(err)
	}

	signers := map[string]*SigningKey{}
	for _, key := range file.Keys {
		seed, err := base64.RawURLEncoding.DecodeString(key.Seed)
		if err != nil {
			t.Fatal(err)
		}
		signer, err := NewSigningKey(seed, key.Kid)
		if err != nil {
			t.Fatal(err)
		}
		if EncodePublicKey(signer.PublicKey()) != key.PublicKey {
			t.Fatalf("key %s: public key mismatch", key.Name)
		}
		_, trusted := keys.PublicKey(key.Kid)
		if trusted != key.Trusted {
			t.Fatalf("key %s: trusted=%v but key set says %v", key.Name, key.Trusted, trusted)
		}
		signers[key.Name] = signer
	}

	grants := map[string]*Grant{}
	for _, vector := range file.Grants {
		t.Run("grant/"+vector.Name, func(t *testing.T) {
			checkMint(t, vector, signers)
			grant, err := VerifyGrant(vector.Token, keys, now)
			checkVerify(t, vector.Expect, err)
			if grant != nil {
				grants[vector.Name] = grant
			}
		})
	}

	for _, vector := range file.InvocationTokens {
		t.Run("invocation/"+vector.Name, func(t *testing.T) {
			checkMint(t, vector, signers)
			token, err := VerifyInvocationToken(vector.Token, keys, now)
			checkVerify(t, vector.Expect, err)
			if token == nil {
				return
			}
			if vector.PayloadJSON != nil {
				if got := CodeOf(token.CheckPayload(*vector.PayloadJSON)); got != okOr(vector.ExpectPayload) {
					t.Fatalf("payload check: got %q, want %q", got, vector.ExpectPayload)
				}
			}
			if vector.BindGrant != "" {
				grant, ok := grants[vector.BindGrant]
				if !ok {
					t.Fatalf("grant vector %s is not a valid grant", vector.BindGrant)
				}
				if got := CodeOf(token.CheckGrant(grant)); got != okOr(vector.ExpectBinding) {
					t.Fatalf("binding check: got %q, want %q", got, vector.ExpectBinding)
				}
			}
		})
	}

	for _, vector := range file.PayloadHashes {
		if got := PayloadSHA256(vector.PayloadJSON); got != vector.SHA256 {
			t.Fatalf("payload hash %q: got %s, want %s", vector.Description, got, vector.SHA256)
		}
	}

	if !reflect.DeepEqual(file.Policy.InternalRanges, policy.InternalRanges) {
		t.Fatal("internal ranges in vectors differ from policy.InternalRanges")
	}
	if !reflect.DeepEqual(file.Policy.HardDenyRanges, policy.HardDenyRanges) {
		t.Fatal("hard deny ranges in vectors differ from policy.HardDenyRanges")
	}
	for _, c := range file.Policy.Cases {
		t.Run("policy/"+c.Name, func(t *testing.T) {
			got := evaluateCase(t, file.Policy, c)
			if got != c.Expect {
				t.Fatalf("got %+v, want %+v", got, c.Expect)
			}
		})
	}
}

func okOr(code ErrorCode) ErrorCode {
	if code == "ok" {
		return ""
	}
	return code
}

func checkMint(t *testing.T, vector tokenVector, signers map[string]*SigningKey) {
	t.Helper()
	if !vector.Mintable {
		return
	}
	signer := signers[vector.Signer]
	if signer == nil {
		t.Fatalf("unknown signer %s", vector.Signer)
	}
	token := signRaw(signer, signer.KeyID, []byte(vector.ClaimsJSON))
	if token != vector.Token {
		t.Fatalf("minted token differs:\n got %s\nwant %s", token, vector.Token)
	}
}

func checkVerify(t *testing.T, expect tokenExpectation, err error) {
	t.Helper()
	if expect.Valid {
		if err != nil {
			t.Fatalf("expected valid, got %v", err)
		}
		return
	}
	if CodeOf(err) != expect.Error {
		t.Fatalf("expected %s, got %v", expect.Error, err)
	}
}

func evaluateCase(t *testing.T, domain policyVectorDomain, c policyCase) policy.Verdict {
	t.Helper()
	config, ok := domain.Configs[c.Config]
	if !ok {
		t.Fatalf("unknown config %s", c.Config)
	}
	grant, ok := domain.Grants[c.Grant]
	if !ok {
		t.Fatalf("unknown grant %s", c.Grant)
	}
	hardDeny, err := policy.ParsePrefixes(config.HardDenyCIDRs)
	if err != nil {
		t.Fatal(err)
	}
	rules, err := policy.Compile(grant.Policy, grant.AllowAll)
	if err != nil {
		t.Fatal(err)
	}
	evaluator := policy.Evaluator{AllowInternalDestinations: config.AllowInternalDestinations, HardDeny: hardDeny}
	return evaluator.Evaluate(rules, policy.Destination{Host: c.Host, Addr: netip.MustParseAddr(c.IP), Port: c.Port})
}

func signRaw(key *SigningKey, kid string, claims []byte) string {
	return signRawWithHeader(key, []byte(`{"alg":"EdDSA","typ":"JWT","kid":"`+kid+`"}`), claims)
}

func signRawWithHeader(key *SigningKey, header []byte, claims []byte) string {
	input := encodeSegment(header) + "." + encodeSegment(claims)
	return input + "." + encodeSegment(ed25519.Sign(key.PrivateKey, []byte(input)))
}

func marshalVectors(file vectorFile) ([]byte, error) {
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(file); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

type vectorBuilder struct {
	t       *testing.T
	keys    map[string]*SigningKey
	file    vectorFile
	tokens  map[string]string
	trusted map[string]bool
}

func vectorSeed(name string) []byte {
	sum := sha256.Sum256([]byte("metorial-egress-test-vector:" + name))
	return sum[:]
}

func generateVectors(t *testing.T) vectorFile {
	b := &vectorBuilder{t: t, keys: map[string]*SigningKey{}, tokens: map[string]string{}, trusted: map[string]bool{}}
	b.file = vectorFile{
		Version: 1,
		Description: []string{
			"Canonical egress grant, invocation token and policy vectors. Generated by `go test ./packages/egress -run TestVectors -update`; never edit by hand.",
			"Times are Unix seconds; verify every token at `now`. Verifiers allow clockSkewSeconds on exp, nbf and iat.",
			"Keys: seed is the base64url (no padding) 32-byte Ed25519 seed, publicKey the raw public key. keySet is the trust set in the egress-trust/runtime-trust format; untrusted keys are not in it.",
			"Tokens: compact JWS, header {\"alg\":\"EdDSA\",\"typ\":\"JWT\",\"kid\":...}. For mintable vectors, signing base64url(headerJson) + '.' + base64url(claimsJson) with the signer's key must reproduce `token` byte for byte (Ed25519 is deterministic). `claims` equals claimsJson parsed; JSON.stringify(claims) === claimsJson.",
			"Canonical claim order: grants iss, aud, jti, tenantId, functionId, effectiveFunctionId, functionVersionId, enclaveId, enclaveIdentifier, buildRunId, source, policy, allowAll, iat, nbf, exp; invocation tokens iss, aud, jti, functionVersionId, payloadSha256, iat, exp. Absent optional claims are omitted, never null.",
			"Verification order (determines the error code): malformed (segments, base64url, JSON), unsupported_alg (alg != EdDSA), unknown_kid, bad_signature, malformed (claims not a JSON object), wrong_audience, missing_claims (iat or exp absent), expired (now > exp + skew), not_yet_valid (now + skew < nbf), issued_in_future (now + skew < iat), then per-token claims: missing_claims, invalid_policy.",
			"Invocation vectors may carry payloadJson (check sha256 of its UTF-8 bytes against payloadSha256, expectPayload) and bindGrant (jti and functionVersionId must equal that grant's, expectBinding). \"ok\" means the check passes.",
			"Policy cases: evaluate the destination (host is the hostname the address was resolved for, empty for IP literals) under configs[config] and grants[grant]. Reasons: allowed public|internal, denied policy|hard_deny|internal_disabled. Embedded IPv4 forms (::ffff:0:0/96, ::/96, 64:ff9b::/96, 2002::/16) are evaluated as both the IPv6 and the embedded IPv4 address, with the IPv6 form classified internal exactly when the embedded address is; the stricter verdict wins (hard_deny > internal_disabled > policy).",
		},
		Now:              vectorNow,
		ClockSkewSeconds: int64(ClockSkew / time.Second),
	}

	b.addKey("function-bay", "", true)
	b.addKey("function-bay-explicit-kid", "function-bay-2026-11", true)
	b.addKey("forge", "", true)
	b.addKey("untrusted", "", false)

	trustSet := map[string]ed25519.PublicKey{}
	for _, key := range b.file.Keys {
		if key.Trusted {
			public, _ := DecodePublicKey(key.PublicKey)
			trustSet[key.Kid] = public
		}
	}
	keySet, err := NewKeySet(trustSet).MarshalJSON()
	if err != nil {
		t.Fatal(err)
	}
	b.file.KeySet = keySet

	b.grantVectors()
	b.invocationVectors()
	b.payloadHashVectors()
	b.policyVectors()
	return b.file
}

func (b *vectorBuilder) addKey(name string, kid string, trusted bool) {
	key, err := NewSigningKey(vectorSeed(name), kid)
	if err != nil {
		b.t.Fatal(err)
	}
	b.keys[name] = key
	b.trusted[name] = trusted
	b.file.Keys = append(b.file.Keys, vectorKey{
		Name:      name,
		Kid:       key.KeyID,
		Seed:      base64.RawURLEncoding.EncodeToString(vectorSeed(name)),
		PublicKey: EncodePublicKey(key.PublicKey()),
		Trusted:   trusted,
	})
}

func (b *vectorBuilder) mintable(signer string, description string, claims any) tokenVector {
	key := b.keys[signer]
	claimsJSON, err := marshalCompact(claims)
	if err != nil {
		b.t.Fatal(err)
	}
	headerJSON, err := marshalCompact(header{Alg: "EdDSA", Typ: "JWT", Kid: key.KeyID})
	if err != nil {
		b.t.Fatal(err)
	}
	return tokenVector{
		Description: description,
		Signer:      signer,
		Mintable:    true,
		HeaderJSON:  string(headerJSON),
		ClaimsJSON:  string(claimsJSON),
		Claims:      json.RawMessage(claimsJSON),
		Token:       signRaw(key, key.KeyID, claimsJSON),
	}
}

func (b *vectorBuilder) addGrant(name string, v tokenVector, expect tokenExpectation) {
	v.Name = name
	v.Expect = expect
	b.tokens[name] = v.Token
	b.file.Grants = append(b.file.Grants, v)
}

func (b *vectorBuilder) addInvocation(name string, v tokenVector, expect tokenExpectation) {
	v.Name = name
	v.Expect = expect
	b.tokens[name] = v.Token
	b.file.InvocationTokens = append(b.file.InvocationTokens, v)
}

func raw(description string, token string) tokenVector {
	return tokenVector{Description: description, Token: token}
}

var valid = tokenExpectation{Valid: true}

func invalid(code ErrorCode) tokenExpectation {
	return tokenExpectation{Error: code}
}

func functionGrant(now int64) Grant {
	return Grant{
		Issuer:              "function-bay",
		ID:                  "inv_01JD8X3W6Q4V7N2M5K9P0R1S2T",
		TenantID:            "ten_01JD8X0000AAAA",
		FunctionID:          "fn_01JD8X1111BBBB",
		EffectiveFunctionID: "fn_01JD8X2222CCCC",
		FunctionVersionID:   "fnv_01JD8X3333DDDD",
		EnclaveID:           "enc_01JD8X4444EEEE",
		EnclaveIdentifier:   "production-eu",
		Source:              SourceLambda,
		Policy: &policy.Policy{
			Entries: []policy.Entry{
				{CIDR: "93.184.216.0/24", PortRange: &policy.PortRange{From: 80, To: 443}},
				{CIDR: "10.20.0.0/16", PortRange: &policy.PortRange{From: 443, To: 443}},
				{CIDR: "2606:2800::/32"},
			},
			Hosts: []policy.HostRule{
				{Pattern: "*.example.com", Ports: []int{443}},
				{Pattern: "api.github.com"},
			},
		},
		IssuedAt:  now - 10,
		NotBefore: now - 40,
		ExpiresAt: now + 960,
	}
}

func (b *vectorBuilder) grantVectors() {
	now := vectorNow

	full := withAud(functionGrant(now))
	b.addGrant("function-grant-full", b.mintable("function-bay", "Lambda function grant with every attribution claim, CIDR entries with and without port ranges, and host rules.", full), valid)

	minimal := Grant{
		Issuer:            "function-bay",
		ID:                "inv_minimal",
		TenantID:          "ten_1",
		FunctionID:        "fn_1",
		FunctionVersionID: "fnv_1",
		Source:            SourceKnative,
		IssuedAt:          now,
		ExpiresAt:         now + 90,
	}
	b.addGrant("function-grant-public-only", b.mintable("function-bay", "Knative grant without policy (public internet only), without nbf.", withAud(minimal)), valid)

	allowAll := minimal
	allowAll.ID = "inv_allow_all"
	allowAll.AllowAll = true
	b.addGrant("function-grant-allow-all", b.mintable("function-bay", "allowAll grant.", withAud(allowAll)), valid)

	emptyPolicy := minimal
	emptyPolicy.ID = "inv_empty_policy"
	emptyPolicy.Policy = &policy.Policy{Entries: []policy.Entry{{CIDR: "0.0.0.0/32"}, {CIDR: "::/128"}}}
	b.addGrant("function-grant-empty-fallback", b.mintable("function-bay", "Policy compiled from firewalls that allow nothing (compileNetworkAllowList empty fallback).", withAud(emptyPolicy)), valid)

	build := Grant{
		Issuer:     "forge",
		ID:         "brun_01JD8X5555FFFF",
		TenantID:   "ten_1",
		BuildRunID: "brun_01JD8X5555FFFF",
		Source:     SourceBuild,
		Policy:     &policy.Policy{Entries: []policy.Entry{}, Hosts: []policy.HostRule{{Pattern: "registry.npmjs.org", Ports: []int{443}}}},
		IssuedAt:   now - 5,
		NotBefore:  now - 5,
		ExpiresAt:  now + 3900,
	}
	b.addGrant("build-grant", b.mintable("forge", "Build grant signed by forge's key.", withAud(build)), valid)

	explicitKid := minimal
	explicitKid.ID = "inv_explicit_kid"
	b.addGrant("explicit-kid", b.mintable("function-bay-explicit-kid", "Signed with a key whose kid is configured explicitly instead of derived.", withAud(explicitKid)), valid)

	expiredEdge := minimal
	expiredEdge.ID = "inv_expiry_edge"
	expiredEdge.IssuedAt = now - 120
	expiredEdge.ExpiresAt = now - 30
	b.addGrant("expired-within-skew", b.mintable("function-bay", "exp = now - 30: still valid with 30 s skew.", withAud(expiredEdge)), valid)

	expired := expiredEdge
	expired.ID = "inv_expired"
	expired.ExpiresAt = now - 31
	b.addGrant("expired", b.mintable("function-bay", "exp = now - 31.", withAud(expired)), invalid(ErrExpired))

	nbfEdge := minimal
	nbfEdge.ID = "inv_nbf_edge"
	nbfEdge.NotBefore = now + 30
	b.addGrant("not-before-within-skew", b.mintable("function-bay", "nbf = now + 30: valid with skew.", withAud(nbfEdge)), valid)

	nbf := nbfEdge
	nbf.ID = "inv_nbf"
	nbf.NotBefore = now + 31
	b.addGrant("not-yet-valid", b.mintable("function-bay", "nbf = now + 31.", withAud(nbf)), invalid(ErrNotYetValid))

	iatFuture := minimal
	iatFuture.ID = "inv_iat_future"
	iatFuture.IssuedAt = now + 31
	iatFuture.ExpiresAt = now + 600
	b.addGrant("issued-in-future", b.mintable("function-bay", "iat = now + 31.", withAud(iatFuture)), invalid(ErrIssuedInFuture))

	wrongAud := minimal
	wrongAud.ID = "inv_wrong_aud"
	wrongAud.Audience = InvocationAudience
	b.addGrant("wrong-audience", b.mintable("function-bay", "aud is the invocation audience.", wrongAud), invalid(ErrWrongAudience))

	b.addGrant("audience-array", b.mintable("function-bay", "aud as an array containing metorial-egress is accepted.", map[string]any{
		"iss":               "function-bay",
		"aud":               []string{"other", GrantAudience},
		"jti":               "inv_aud_array",
		"tenantId":          "ten_1",
		"functionId":        "fn_1",
		"functionVersionId": "fnv_1",
		"source":            "lambda",
		"iat":               now,
		"exp":               now + 60,
	}), valid)
	b.file.Grants[len(b.file.Grants)-1].Mintable = false

	unknownKid := minimal
	unknownKid.ID = "inv_unknown_kid"
	b.addGrant("unknown-kid", b.mintable("untrusted", "Signed by a key that is not in the trust set.", withAud(unknownKid)), invalid(ErrUnknownKid))

	forged := minimal
	forged.ID = "inv_forged"
	forgedClaims, _ := marshalCompact(withAud(forged))
	b.addGrant("bad-signature-wrong-key", raw("Header names a trusted kid, signature made with the untrusted key.", signRaw(b.keys["untrusted"], b.keys["function-bay"].KeyID, forgedClaims)), invalid(ErrBadSignature))

	b.addGrant("bad-signature-flipped", raw("Valid token with one signature byte changed.", flipSignature(b.tokens["function-grant-public-only"])), invalid(ErrBadSignature))

	tampered := minimal
	tampered.AllowAll = true
	b.addGrant("tampered-payload", raw("function-grant-public-only with allowAll added to the payload, original signature.", replacePayload(b.tokens["function-grant-public-only"], withAud(tampered))), invalid(ErrBadSignature))

	b.addGrant("alg-hs256", raw("alg HS256 (the deflector's format) is rejected before any key lookup.", signRawWithHeader(b.keys["function-bay"], []byte(`{"alg":"HS256","typ":"JWT","kid":"`+b.keys["function-bay"].KeyID+`"}`), forgedClaims)), invalid(ErrUnsupportedAlg))

	b.addGrant("alg-none", raw("alg none with an empty signature.", encodeSegment([]byte(`{"alg":"none","typ":"JWT"}`))+"."+encodeSegment(forgedClaims)+"."), invalid(ErrUnsupportedAlg))

	b.addGrant("malformed-two-segments", raw("Only two segments.", strings.Join(strings.Split(b.tokens["function-grant-public-only"], ".")[:2], ".")), invalid(ErrMalformed))

	b.addGrant("missing-exp", b.mintable("function-bay", "No exp claim.", map[string]any{
		"iss": "function-bay", "aud": GrantAudience, "jti": "inv_no_exp", "tenantId": "ten_1", "functionId": "fn_1", "functionVersionId": "fnv_1", "source": "lambda", "iat": now,
	}), invalid(ErrMissingClaims))
	b.file.Grants[len(b.file.Grants)-1].Mintable = false

	noSource := minimal
	noSource.ID = "inv_no_source"
	noSource.Source = ""
	b.addGrant("missing-source", b.mintable("function-bay", "No source claim.", withAud(noSource)), invalid(ErrMissingClaims))

	noTenant := minimal
	noTenant.ID = "inv_no_tenant"
	noTenant.TenantID = ""
	b.addGrant("function-grant-missing-tenant", b.mintable("function-bay", "Function grant without tenantId.", withAud(noTenant)), invalid(ErrMissingClaims))

	noRun := build
	noRun.BuildRunID = ""
	b.addGrant("build-grant-missing-run", b.mintable("forge", "Build grant without buildRunId.", withAud(noRun)), invalid(ErrMissingClaims))

	badCIDR := minimal
	badCIDR.ID = "inv_bad_cidr"
	badCIDR.Policy = &policy.Policy{Entries: []policy.Entry{{CIDR: "10.0.0.0/33"}}}
	b.addGrant("invalid-policy-cidr", b.mintable("function-bay", "Unparseable CIDR.", withAud(badCIDR)), invalid(ErrInvalidPolicy))

	badPorts := minimal
	badPorts.ID = "inv_bad_ports"
	badPorts.Policy = &policy.Policy{Entries: []policy.Entry{{CIDR: "0.0.0.0/0", PortRange: &policy.PortRange{From: 0, To: 80}}}}
	b.addGrant("invalid-policy-port-range", b.mintable("function-bay", "Port range starting at 0.", withAud(badPorts)), invalid(ErrInvalidPolicy))

	badHost := minimal
	badHost.ID = "inv_bad_host"
	badHost.Policy = &policy.Policy{Entries: []policy.Entry{}, Hosts: []policy.HostRule{{Pattern: "*.*.example.com"}}}
	b.addGrant("invalid-policy-host", b.mintable("function-bay", "Host pattern with two wildcards.", withAud(badHost)), invalid(ErrInvalidPolicy))
}

func withAud(g Grant) Grant {
	if g.Audience == "" {
		g.Audience = GrantAudience
	}
	return g
}

func withInvocationAud(t InvocationToken) InvocationToken {
	if t.Audience == "" {
		t.Audience = InvocationAudience
	}
	return t
}

func flipSignature(token string) string {
	parts := strings.Split(token, ".")
	signature, _ := base64.RawURLEncoding.DecodeString(parts[2])
	signature[10] ^= 0x01
	parts[2] = encodeSegment(signature)
	return strings.Join(parts, ".")
}

func replacePayload(token string, claims any) string {
	parts := strings.Split(token, ".")
	payload, _ := marshalCompact(claims)
	parts[1] = encodeSegment(payload)
	return strings.Join(parts, ".")
}

var (
	asciiPayload   = `{"messages":[{"role":"user","content":"hello"}],"invocationId":"inv_01JD8X3W6Q4V7N2M5K9P0R1S2T"}`
	unicodePayload = `{"messages":[{"content":"héllo wörld – 日本語 🚀"}]}`
	escapedPayload = `{"messages":[{"content":"h\u00e9llo w\u00f6rld \u2013 \u65e5\u672c\u8a9e \ud83d\ude80"}]}`
)

func (b *vectorBuilder) invocationVectors() {
	now := vectorNow
	grant := functionGrant(now)

	base := InvocationToken{
		Issuer:            "function-bay",
		ID:                grant.ID,
		FunctionVersionID: grant.FunctionVersionID,
		PayloadSHA256:     PayloadSHA256(asciiPayload),
		IssuedAt:          now - 2,
		ExpiresAt:         now + 928,
	}

	ascii := asciiPayload
	v := b.mintable("function-bay", "Valid token for an ASCII payload, bound to function-grant-full.", withInvocationAud(base))
	v.PayloadJSON = &ascii
	v.ExpectPayload = "ok"
	v.BindGrant = "function-grant-full"
	v.ExpectBinding = "ok"
	b.addInvocation("valid-ascii", v, valid)

	unicode := unicodePayload
	unicodeToken := base
	unicodeToken.PayloadSHA256 = PayloadSHA256(unicodePayload)
	v = b.mintable("function-bay", "Non-ASCII payloadJson (2-, 3- and 4-byte UTF-8): the hash covers the exact UTF-8 bytes.", withInvocationAud(unicodeToken))
	v.PayloadJSON = &unicode
	v.ExpectPayload = "ok"
	v.BindGrant = "function-grant-full"
	v.ExpectBinding = "ok"
	b.addInvocation("valid-unicode", v, valid)

	escaped := escapedPayload
	v = b.mintable("function-bay", "Same token as valid-unicode, presented with the \\u-escaped spelling of the same JSON value: different bytes, so the hash doesn't match.", withInvocationAud(unicodeToken))
	v.PayloadJSON = &escaped
	v.ExpectPayload = ErrPayloadHash
	b.addInvocation("payload-escaped-spelling", v, valid)

	otherJti := base
	otherJti.ID = "inv_other"
	v = b.mintable("function-bay", "Token for another invocation paired with function-grant-full.", withInvocationAud(otherJti))
	v.BindGrant = "function-grant-full"
	v.ExpectBinding = ErrBinding
	b.addInvocation("binding-other-jti", v, valid)

	otherVersion := base
	otherVersion.FunctionVersionID = "fnv_other"
	v = b.mintable("function-bay", "Token for another version paired with function-grant-full.", withInvocationAud(otherVersion))
	v.BindGrant = "function-grant-full"
	v.ExpectBinding = ErrBinding
	b.addInvocation("binding-other-version", v, valid)

	expired := base
	expired.IssuedAt = now - 300
	expired.ExpiresAt = now - 31
	b.addInvocation("expired", b.mintable("function-bay", "exp = now - 31.", withInvocationAud(expired)), invalid(ErrExpired))

	b.addInvocation("grant-as-invocation-token", raw("An egress grant presented as an invocation token.", b.tokens["function-grant-full"]), invalid(ErrWrongAudience))

	b.addInvocation("unknown-kid", b.mintable("untrusted", "Signed by an untrusted key.", withInvocationAud(base)), invalid(ErrUnknownKid))

	b.addInvocation("bad-signature", raw("Valid token with one signature byte changed.", flipSignature(b.tokens["valid-ascii"])), invalid(ErrBadSignature))

	tampered := base
	tampered.PayloadSHA256 = PayloadSHA256(`{"messages":[]}`)
	b.addInvocation("tampered-payload-hash", raw("valid-ascii with payloadSha256 replaced, original signature.", replacePayload(b.tokens["valid-ascii"], withInvocationAud(tampered))), invalid(ErrBadSignature))

	upper := base
	upper.PayloadSHA256 = strings.ToUpper(base.PayloadSHA256)
	b.addInvocation("uppercase-payload-hash", b.mintable("function-bay", "payloadSha256 must be lowercase hex.", withInvocationAud(upper)), invalid(ErrMissingClaims))

	b.addGrant("invocation-token-as-grant", raw("An invocation token presented as an egress grant.", b.tokens["valid-ascii"]), invalid(ErrWrongAudience))
}

func (b *vectorBuilder) payloadHashVectors() {
	for _, p := range []struct{ description, payload string }{
		{"empty string", ""},
		{"ASCII", asciiPayload},
		{"non-ASCII UTF-8", unicodePayload},
		{"same value, \\u-escaped spelling", escapedPayload},
		{"line and paragraph separators", "{\"text\":\"a\u2028b\u2029c\"}"},
		{"whitespace is significant", "{ \"a\" : 1 }"},
	} {
		b.file.PayloadHashes = append(b.file.PayloadHashes, payloadHash{Description: p.description, PayloadJSON: p.payload, SHA256: PayloadSHA256(p.payload)})
	}
}

func (b *vectorBuilder) policyVectors() {
	domain := policyVectorDomain{
		InternalRanges: policy.InternalRanges,
		HardDenyRanges: policy.HardDenyRanges,
		Configs: map[string]policyConfig{
			"cloud":  {AllowInternalDestinations: false, HardDenyCIDRs: []string{}},
			"onprem": {AllowInternalDestinations: true, HardDenyCIDRs: []string{"10.42.0.0/16", "10.43.0.0/16", "192.168.5.0/24", "fd42::/48"}},
		},
		Grants: map[string]policyGrantRef{
			"none":          {},
			"allowAll":      {AllowAll: true},
			"unrestricted":  {Policy: &policy.Policy{Entries: []policy.Entry{{CIDR: "0.0.0.0/0"}, {CIDR: "::/0"}}}},
			"ipv4Only":      {Policy: &policy.Policy{Entries: []policy.Entry{{CIDR: "0.0.0.0/0"}}}},
			"emptyFallback": {Policy: &policy.Policy{Entries: []policy.Entry{{CIDR: "0.0.0.0/32"}, {CIDR: "::/128"}}}},
			"explicit": {Policy: &policy.Policy{Entries: []policy.Entry{
				{CIDR: "93.184.216.0/24", PortRange: &policy.PortRange{From: 80, To: 443}},
				{CIDR: "10.20.0.0/16", PortRange: &policy.PortRange{From: 443, To: 443}},
				{CIDR: "2606:2800::/32"},
				{CIDR: "fd12:3456::/32"},
			}}},
			"explicitDangerous": {Policy: &policy.Policy{Entries: []policy.Entry{
				{CIDR: "127.0.0.0/8"}, {CIDR: "169.254.0.0/16"}, {CIDR: "100.100.100.200/32"}, {CIDR: "::1/128"},
				{CIDR: "fe80::/10"}, {CIDR: "fd00::/8"}, {CIDR: "224.0.0.0/4"}, {CIDR: "0.0.0.0/8"}, {CIDR: "2001::/32"}, {CIDR: "64:ff9b:1::/48"},
			}}},
			"privateAll":    {Policy: &policy.Policy{Entries: []policy.Entry{{CIDR: "10.0.0.0/8"}, {CIDR: "172.16.0.0/12"}, {CIDR: "192.168.0.0/16"}, {CIDR: "100.64.0.0/10"}, {CIDR: "fc00::/7"}}}},
			"broadPrivate":  {Policy: &policy.Policy{Entries: []policy.Entry{{CIDR: "8.0.0.0/5"}}}},
			"spanning":      {Policy: &policy.Policy{Entries: []policy.Entry{{CIDR: "10.0.0.0/7"}}}},
			"mappedEntry":   {Policy: &policy.Policy{Entries: []policy.Entry{{CIDR: "::ffff:10.20.0.0/112"}}}},
			"exactPort":     {Policy: &policy.Policy{Entries: []policy.Entry{{CIDR: "93.184.216.34/32", PortRange: &policy.PortRange{From: 443, To: 443}}}}},
			"nat64Internal": {Policy: &policy.Policy{Entries: []policy.Entry{{CIDR: "10.20.0.0/16"}, {CIDR: "64:ff9b::a14:0/112"}}}},
			"hosts": {Policy: &policy.Policy{Entries: []policy.Entry{}, Hosts: []policy.HostRule{
				{Pattern: "*.example.com", Ports: []int{443}},
				{Pattern: "api.github.com"},
			}}},
			"hostsWithInternal": {Policy: &policy.Policy{
				Entries: []policy.Entry{{CIDR: "10.20.0.0/16"}},
				Hosts:   []policy.HostRule{{Pattern: "*.example.com"}},
			}},
		},
	}

	allowed := func(reason policy.Reason) policy.Verdict { return policy.Verdict{Allowed: true, Reason: reason} }
	denied := func(reason policy.Reason) policy.Verdict { return policy.Verdict{Reason: reason} }
	public, internal := allowed(policy.ReasonPublic), allowed(policy.ReasonInternal)
	hardDeny, internalDisabled, byPolicy := denied(policy.ReasonHardDeny), denied(policy.ReasonInternalDisabled), denied(policy.ReasonPolicy)

	add := func(name, config, grant, host, ip string, port int, expect policy.Verdict) {
		domain.Cases = append(domain.Cases, policyCase{Name: name, Config: config, Grant: grant, Host: host, IP: ip, Port: port, Expect: expect})
	}

	for _, config := range []string{"cloud", "onprem"} {
		for _, grant := range []string{"allowAll", "unrestricted", "explicitDangerous", "none"} {
			for _, d := range []struct{ family, ip string }{
				{"loopback-v4", "127.0.0.1"},
				{"loopback-v4-other", "127.255.0.9"},
				{"loopback-v6", "::1"},
				{"unspecified-v4", "0.0.0.0"},
				{"this-network", "0.1.2.3"},
				{"unspecified-v6", "::"},
				{"link-local-metadata", "169.254.169.254"},
				{"link-local-v4", "169.254.10.1"},
				{"link-local-v6", "fe80::1"},
				{"multicast-v4", "224.0.0.251"},
				{"multicast-v6", "ff02::1"},
				{"broadcast", "255.255.255.255"},
				{"alibaba-metadata", "100.100.100.200"},
				{"aws-metadata-v6", "fd00:ec2::254"},
				{"teredo", "2001:0:4136:e378:8000:63bf:3fff:fdd2"},
				{"nat64-local-use", "64:ff9b:1::a00:1"},
				{"mapped-loopback", "::ffff:127.0.0.1"},
				{"mapped-metadata", "::ffff:169.254.169.254"},
				{"nat64-loopback", "64:ff9b::7f00:1"},
				{"nat64-metadata", "64:ff9b::a9fe:a9fe"},
				{"6to4-loopback", "2002:7f00:1::1"},
				{"6to4-metadata", "2002:a9fe:a9fe::1"},
				{"compatible-loopback", "::127.0.0.1"},
				{"compatible-metadata", "::169.254.169.254"},
			} {
				add("hard-deny/"+config+"/"+grant+"/"+d.family, config, grant, "", d.ip, 80, hardDeny)
			}
		}
	}

	add("hard-deny/onprem/cluster-pod-cidr-with-private-entry", "onprem", "privateAll", "", "10.42.3.4", 443, hardDeny)
	add("hard-deny/onprem/cluster-service-cidr-with-private-entry", "onprem", "privateAll", "", "10.43.0.10", 443, hardDeny)
	add("hard-deny/onprem/cluster-node-cidr-with-private-entry", "onprem", "privateAll", "", "192.168.5.20", 22, hardDeny)
	add("hard-deny/onprem/cluster-v6-cidr-with-private-entry", "onprem", "privateAll", "", "fd42::5", 443, hardDeny)
	add("hard-deny/onprem/cluster-cidr-mapped", "onprem", "privateAll", "", "::ffff:10.42.3.4", 443, hardDeny)
	add("hard-deny/onprem/cluster-cidr-nat64", "onprem", "allowAll", "", "64:ff9b::a2a:304", 443, hardDeny)
	add("hard-deny/onprem/cluster-cidr-via-hostname", "onprem", "hostsWithInternal", "svc.example.com", "10.43.0.10", 443, hardDeny)
	add("internal/cloud/cluster-like-address-without-configured-cidrs", "cloud", "privateAll", "", "10.42.3.4", 443, internalDisabled)

	add("internal/onprem/explicit-entry-opens", "onprem", "explicit", "", "10.20.1.5", 443, internal)
	add("internal/onprem/explicit-entry-wrong-port", "onprem", "explicit", "", "10.20.1.5", 22, byPolicy)
	add("internal/onprem/outside-entry", "onprem", "explicit", "", "10.21.0.1", 443, byPolicy)
	add("internal/cloud/explicit-entry-ignored", "cloud", "explicit", "", "10.20.1.5", 443, internalDisabled)
	add("internal/onprem/v6-ula-entry-opens", "onprem", "explicit", "", "fd12:3456::1", 443, internal)
	add("internal/cloud/v6-ula-entry-ignored", "cloud", "explicit", "", "fd12:3456::1", 443, internalDisabled)
	add("internal/onprem/private-entries-open-10", "onprem", "privateAll", "", "10.1.2.3", 5432, internal)
	add("internal/onprem/private-entries-open-172", "onprem", "privateAll", "", "172.20.0.1", 80, internal)
	add("internal/onprem/private-entries-open-192", "onprem", "privateAll", "", "192.168.1.10", 8080, internal)
	add("internal/onprem/private-entries-open-cgnat", "onprem", "privateAll", "", "100.64.1.1", 443, internal)
	add("internal/onprem/private-entries-open-ula", "onprem", "privateAll", "", "fd99::1", 443, internal)
	add("internal/onprem/unrestricted-never-opens", "onprem", "unrestricted", "", "10.20.1.5", 443, byPolicy)
	add("internal/onprem/allow-all-never-opens", "onprem", "allowAll", "", "10.20.1.5", 443, byPolicy)
	add("internal/onprem/no-policy-never-opens", "onprem", "none", "", "192.168.1.10", 443, byPolicy)
	add("internal/onprem/broad-entry-never-opens", "onprem", "broadPrivate", "", "10.1.1.1", 443, byPolicy)
	add("internal/onprem/spanning-entry-never-opens", "onprem", "spanning", "", "10.0.0.1", 443, byPolicy)
	add("internal/onprem/spanning-entry-public-half", "onprem", "spanning", "", "11.0.0.1", 443, public)
	add("internal/onprem/mapped-entry-opens", "onprem", "mappedEntry", "", "10.20.0.9", 443, internal)
	add("internal/cloud/unrestricted", "cloud", "unrestricted", "", "10.0.0.1", 443, internalDisabled)
	add("internal/cloud/allow-all", "cloud", "allowAll", "", "172.16.0.1", 443, internalDisabled)
	add("internal/cloud/no-policy", "cloud", "none", "", "192.168.0.1", 443, internalDisabled)
	add("internal/cloud/documentation", "cloud", "allowAll", "", "203.0.113.5", 443, internalDisabled)
	add("internal/cloud/benchmarking", "cloud", "allowAll", "", "198.18.0.1", 443, internalDisabled)
	add("internal/cloud/reserved-class-e", "cloud", "allowAll", "", "240.0.0.1", 443, internalDisabled)
	add("internal/cloud/site-local-v6", "cloud", "allowAll", "", "fec0::1", 443, internalDisabled)
	add("internal/cloud/discard-only-v6", "cloud", "allowAll", "", "100::1", 443, internalDisabled)
	add("internal/cloud/documentation-v6", "cloud", "allowAll", "", "2001:db8::1", 443, internalDisabled)

	add("embedded/cloud/mapped-private", "cloud", "allowAll", "", "::ffff:10.0.0.1", 443, internalDisabled)
	add("embedded/cloud/nat64-private", "cloud", "allowAll", "", "64:ff9b::a00:1", 443, internalDisabled)
	add("embedded/cloud/6to4-private", "cloud", "allowAll", "", "2002:a00:1::1", 443, internalDisabled)
	add("embedded/cloud/compatible-private", "cloud", "allowAll", "", "::10.0.0.1", 443, internalDisabled)
	add("embedded/onprem/nat64-private-allow-all", "onprem", "allowAll", "", "64:ff9b::a00:1", 443, byPolicy)
	add("embedded/onprem/nat64-private-v4-entry-only", "onprem", "explicit", "", "64:ff9b::a14:105", 443, byPolicy)
	add("embedded/onprem/nat64-private-both-entries", "onprem", "nat64Internal", "", "64:ff9b::a14:105", 443, internal)
	add("embedded/onprem/mapped-private-entry", "onprem", "explicit", "", "::ffff:10.20.1.5", 443, internal)
	add("embedded/cloud/mapped-public", "cloud", "allowAll", "", "::ffff:8.8.8.8", 443, public)
	add("embedded/cloud/mapped-public-v4-entry", "cloud", "ipv4Only", "", "::ffff:8.8.8.8", 443, public)
	add("embedded/cloud/nat64-public-allow-all", "cloud", "allowAll", "", "64:ff9b::808:808", 443, public)
	add("embedded/cloud/nat64-public-no-policy", "cloud", "none", "", "64:ff9b::808:808", 443, public)
	add("embedded/cloud/nat64-public-unrestricted", "cloud", "unrestricted", "", "64:ff9b::808:808", 443, public)
	add("embedded/cloud/nat64-public-ipv4-entry-only", "cloud", "ipv4Only", "", "64:ff9b::808:808", 443, byPolicy)
	add("embedded/cloud/6to4-public", "cloud", "allowAll", "", "2002:808:808::1", 443, public)

	add("public/cloud/no-policy", "cloud", "none", "", "93.184.216.34", 443, public)
	add("public/cloud/no-policy-v6", "cloud", "none", "", "2606:2800:220:1:248:1893:25c8:1946", 443, public)
	add("public/cloud/allow-all", "cloud", "allowAll", "", "1.1.1.1", 853, public)
	add("public/cloud/unrestricted", "cloud", "unrestricted", "", "1.1.1.1", 53, public)
	add("public/cloud/explicit-in-range", "cloud", "explicit", "", "93.184.216.34", 443, public)
	add("public/cloud/explicit-port-low-edge", "cloud", "explicit", "", "93.184.216.34", 80, public)
	add("public/cloud/explicit-port-below", "cloud", "explicit", "", "93.184.216.34", 79, byPolicy)
	add("public/cloud/explicit-port-above", "cloud", "explicit", "", "93.184.216.34", 8443, byPolicy)
	add("public/cloud/explicit-outside", "cloud", "explicit", "", "1.1.1.1", 443, byPolicy)
	add("public/cloud/explicit-v6-all-ports", "cloud", "explicit", "", "2606:2800:220:1::1", 65535, public)
	add("public/cloud/exact-port", "cloud", "exactPort", "", "93.184.216.34", 443, public)
	add("public/cloud/exact-port-miss", "cloud", "exactPort", "", "93.184.216.34", 444, byPolicy)
	add("public/cloud/empty-fallback", "cloud", "emptyFallback", "", "93.184.216.34", 443, byPolicy)
	add("public/cloud/port-zero", "cloud", "allowAll", "", "93.184.216.34", 0, byPolicy)
	add("public/onprem/explicit", "onprem", "explicit", "", "93.184.216.34", 443, public)

	add("hosts/cloud/wildcard-match", "cloud", "hosts", "api.example.com", "93.184.216.34", 443, public)
	add("hosts/cloud/wildcard-deep-match", "cloud", "hosts", "a.b.example.com", "93.184.216.34", 443, public)
	add("hosts/cloud/wildcard-wrong-port", "cloud", "hosts", "api.example.com", "93.184.216.34", 80, byPolicy)
	add("hosts/cloud/wildcard-apex", "cloud", "hosts", "example.com", "93.184.216.34", 443, byPolicy)
	add("hosts/cloud/wildcard-suffix-trick", "cloud", "hosts", "evilexample.com", "93.184.216.34", 443, byPolicy)
	add("hosts/cloud/case-and-trailing-dot", "cloud", "hosts", "API.Example.COM.", "93.184.216.34", 443, public)
	add("hosts/cloud/exact-any-port", "cloud", "hosts", "api.github.com", "140.82.112.5", 22, public)
	add("hosts/cloud/exact-other-host", "cloud", "hosts", "github.com", "140.82.112.5", 443, byPolicy)
	add("hosts/cloud/ip-literal", "cloud", "hosts", "", "93.184.216.34", 443, byPolicy)
	add("hosts/cloud/rebinding-to-private", "cloud", "hosts", "api.example.com", "10.0.0.1", 443, internalDisabled)
	add("hosts/onprem/rebinding-to-private", "onprem", "hosts", "api.example.com", "10.0.0.1", 443, byPolicy)
	add("hosts/onprem/rebinding-to-loopback", "onprem", "hosts", "api.example.com", "127.0.0.1", 443, hardDeny)
	add("hosts/onprem/rebinding-to-metadata", "onprem", "hosts", "api.example.com", "169.254.169.254", 80, hardDeny)
	add("hosts/onprem/rebinding-to-nat64-private", "onprem", "hosts", "api.example.com", "64:ff9b::a00:1", 443, byPolicy)
	add("hosts/onprem/internal-with-matching-entry", "onprem", "hostsWithInternal", "git.example.com", "10.20.4.4", 443, internal)
	add("hosts/cloud/internal-with-matching-entry", "cloud", "hostsWithInternal", "git.example.com", "10.20.4.4", 443, internalDisabled)
	add("hosts/onprem/internal-outside-entry", "onprem", "hostsWithInternal", "git.example.com", "10.30.4.4", 443, byPolicy)

	for _, c := range domain.Cases {
		got := evaluateCase(b.t, domain, c)
		if got != c.Expect {
			b.t.Fatalf("policy case %s: evaluator says %+v, expected %+v", c.Name, got, c.Expect)
		}
	}
	b.file.Policy = domain
}
