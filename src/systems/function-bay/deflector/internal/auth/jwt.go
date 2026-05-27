package auth

import (
	"context"
	"errors"

	"github.com/golang-jwt/jwt/v5"
	"github.com/metorial/function-bay-deflector/internal/policy"
)

type Verifier struct {
	secret   []byte
	audience string
}

func NewVerifier(secret string, audience string) *Verifier {
	return &Verifier{secret: []byte(secret), audience: audience}
}

func (v *Verifier) Verify(ctx context.Context, token string) (policy.Claims, error) {
	if len(v.secret) == 0 {
		return policy.Claims{}, errors.New("jwt secret is required")
	}

	claims := policy.Claims{}
	parserOptions := []jwt.ParserOption{
		jwt.WithExpirationRequired(),
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
	}
	if v.audience != "" {
		parserOptions = append(parserOptions, jwt.WithAudience(v.audience))
	}

	parsed, err := jwt.ParseWithClaims(token, &claims, func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("unexpected jwt signing method")
		}
		return v.secret, nil
	}, parserOptions...)
	if err != nil {
		return policy.Claims{}, err
	}
	if !parsed.Valid {
		return policy.Claims{}, errors.New("invalid jwt")
	}
	if claims.TenantID == "" || claims.FunctionID == "" || claims.FunctionVersionID == "" {
		return policy.Claims{}, errors.New("jwt is missing required invocation claims")
	}

	return claims, nil
}
