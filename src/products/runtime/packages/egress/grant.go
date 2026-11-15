package egress

import (
	"encoding/json"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress/policy"
)

type Source string

const (
	SourceLambda  Source = "lambda"
	SourceKnative Source = "knative"
	SourceBuild   Source = "build"
)

// Grant is the claim set of an egress grant. Field order is the canonical claim order
// used for minting (see testdata/vectors.json).
type Grant struct {
	Issuer              string         `json:"iss,omitempty"`
	Audience            string         `json:"aud"`
	ID                  string         `json:"jti"`
	TenantID            string         `json:"tenantId,omitempty"`
	FunctionID          string         `json:"functionId,omitempty"`
	EffectiveFunctionID string         `json:"effectiveFunctionId,omitempty"`
	FunctionVersionID   string         `json:"functionVersionId,omitempty"`
	EnclaveID           string         `json:"enclaveId,omitempty"`
	EnclaveIdentifier   string         `json:"enclaveIdentifier,omitempty"`
	BuildRunID          string         `json:"buildRunId,omitempty"`
	Source              Source         `json:"source"`
	Policy              *policy.Policy `json:"policy,omitempty"`
	AllowAll            bool           `json:"allowAll,omitempty"`
	IssuedAt            int64          `json:"iat"`
	NotBefore           int64          `json:"nbf,omitempty"`
	ExpiresAt           int64          `json:"exp"`

	rules *policy.Rules
}

// MintGrant signs g. An empty Audience defaults to GrantAudience.
func MintGrant(key *SigningKey, g Grant) (string, error) {
	if g.Audience == "" {
		g.Audience = GrantAudience
	}
	return sign(key, g)
}

func VerifyGrant(token string, keys Keys, now time.Time) (*Grant, error) {
	payload, err := verify(token, keys, GrantAudience, now)
	if err != nil {
		return nil, err
	}

	var claims struct {
		Grant
		Audience json.RawMessage `json:"aud"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, newError(ErrMalformed, "grant claims have unexpected types")
	}
	g := claims.Grant
	g.Audience = GrantAudience
	if g.ID == "" {
		return nil, newError(ErrMissingClaims, "jti is required")
	}

	switch g.Source {
	case SourceBuild:
		if g.BuildRunID == "" {
			return nil, newError(ErrMissingClaims, "buildRunId is required for build grants")
		}
	case SourceLambda, SourceKnative:
		if g.TenantID == "" || g.FunctionID == "" || g.FunctionVersionID == "" {
			return nil, newError(ErrMissingClaims, "tenantId, functionId and functionVersionId are required")
		}
	default:
		return nil, newError(ErrMissingClaims, "source must be lambda, knative or build")
	}

	rules, err := policy.Compile(g.Policy, g.AllowAll)
	if err != nil {
		return nil, newError(ErrInvalidPolicy, err.Error())
	}
	g.rules = rules
	return &g, nil
}

// Rules returns the compiled policy of a verified grant.
func (g *Grant) Rules() *policy.Rules {
	if g.rules == nil {
		rules, err := policy.Compile(g.Policy, g.AllowAll)
		if err != nil {
			return nil
		}
		g.rules = rules
	}
	return g.rules
}

func (g *Grant) Expiry() time.Time {
	return time.Unix(g.ExpiresAt, 0)
}
