package auth

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/x509"
	"errors"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/golang-jwt/jwt/v5"
	"github.com/metorial/function-bay-deflector/internal/policy"
)

type Verifier struct {
	kmsClient *kms.Client
	keyID     string
	audience  string

	mu        sync.RWMutex
	publicKey *ecdsa.PublicKey
	expiresAt time.Time
}

func NewVerifier(kmsClient *kms.Client, keyID string, audience string) *Verifier {
	return &Verifier{kmsClient: kmsClient, keyID: keyID, audience: audience}
}

func (v *Verifier) Verify(ctx context.Context, token string) (policy.Claims, error) {
	pub, err := v.getPublicKey(ctx)
	if err != nil {
		return policy.Claims{}, err
	}

	claims := policy.Claims{}
	parserOptions := []jwt.ParserOption{
		jwt.WithExpirationRequired(),
		jwt.WithValidMethods([]string{jwt.SigningMethodES256.Alg()}),
	}
	if v.audience != "" {
		parserOptions = append(parserOptions, jwt.WithAudience(v.audience))
	}

	parsed, err := jwt.ParseWithClaims(token, &claims, func(t *jwt.Token) (any, error) {
		return pub, nil
	}, parserOptions...)
	if err != nil {
		return policy.Claims{}, err
	}
	if !parsed.Valid {
		return policy.Claims{}, errors.New("invalid jwt")
	}

	return claims, nil
}

func (v *Verifier) getPublicKey(ctx context.Context) (*ecdsa.PublicKey, error) {
	v.mu.RLock()
	if v.publicKey != nil && time.Now().Before(v.expiresAt) {
		defer v.mu.RUnlock()
		return v.publicKey, nil
	}
	v.mu.RUnlock()

	v.mu.Lock()
	defer v.mu.Unlock()
	if v.publicKey != nil && time.Now().Before(v.expiresAt) {
		return v.publicKey, nil
	}

	resp, err := v.kmsClient.GetPublicKey(ctx, &kms.GetPublicKeyInput{
		KeyId: aws.String(v.keyID),
	})
	if err != nil {
		return nil, err
	}

	parsed, err := x509.ParsePKIXPublicKey(resp.PublicKey)
	if err != nil {
		return nil, err
	}
	pub, ok := parsed.(*ecdsa.PublicKey)
	if !ok || pub.Curve != elliptic.P256() {
		return nil, errors.New("kms public key must be P-256 ECDSA")
	}

	v.publicKey = pub
	v.expiresAt = time.Now().Add(15 * time.Minute)
	return pub, nil
}
