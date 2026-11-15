// Package auth decides whether the supervisor may run an invocation (PLAN.md 7.7), on top of
// the token and grant primitives in packages/egress.
package auth

import (
	"crypto/ed25519"
	"fmt"
	"sync"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
)

const (
	ClockSkew            = 30 * time.Second
	keyFileCheckInterval = time.Second
)

type Rejection struct {
	Reason string
	Detail string
}

func (r *Rejection) Error() string {
	if r.Detail == "" {
		return "auth: " + r.Reason
	}
	return fmt.Sprintf("auth: %s: %s", r.Reason, r.Detail)
}

func reject(reason, detail string) *Rejection {
	return &Rejection{Reason: reason, Detail: detail}
}

func rejectEgress(prefix string, err error) *Rejection {
	code := egress.CodeOf(err)
	if code == "" {
		code = "invalid"
	}
	return reject(prefix+"_"+string(code), err.Error())
}

type Invocation struct {
	VersionID       string
	PayloadJSON     string
	InvocationToken string
	EgressGrant     string
}

type Verified struct {
	InvocationID string
	ExpiresAt    time.Time
	Grant        *egress.Grant
}

type Verifier struct {
	Keys      egress.Keys
	VersionID string
	Replay    *ReplayCache
	Now       func() time.Time
}

// Verify records the jti in the replay cache only after every other check passed, so
// rejected calls can't burn invocation ids.
func (v *Verifier) Verify(in Invocation) (*Verified, *Rejection) {
	now := v.now()

	if in.VersionID != v.VersionID {
		return nil, reject("version_mismatch", "input versionId is not this pod's version")
	}

	token, err := egress.VerifyInvocationToken(in.InvocationToken, v.Keys, now)
	if err != nil {
		return nil, rejectEgress("token", err)
	}
	if token.FunctionVersionID != v.VersionID {
		return nil, reject("token_version_mismatch", "token was minted for another version")
	}
	if err := token.CheckPayload(in.PayloadJSON); err != nil {
		return nil, reject("payload_mismatch", "payloadJson does not match payloadSha256")
	}

	grant, err := egress.VerifyGrant(in.EgressGrant, v.Keys, now)
	if err != nil {
		return nil, rejectEgress("grant", err)
	}
	if err := token.CheckGrant(grant); err != nil {
		return nil, reject("grant_binding_mismatch", "grant jti or functionVersionId differ from the token")
	}

	expiresAt := time.Unix(token.ExpiresAt, 0).Add(ClockSkew)
	if v.Replay != nil {
		if r := v.Replay.Add(token.ID, expiresAt); r != nil {
			return nil, r
		}
	}

	return &Verified{InvocationID: token.ID, ExpiresAt: expiresAt, Grant: grant}, nil
}

func (v *Verifier) now() time.Time {
	if v.Now != nil {
		return v.Now()
	}
	return time.Now()
}

// FileKeys serves runtime-trust keys.json. The file may not exist yet when the supervisor
// starts (kubelet populates projected volumes asynchronously), so loading is retried on use.
type FileKeys struct {
	path string

	mu  sync.Mutex
	set *egress.FileKeySet
}

func NewFileKeys(path string) *FileKeys {
	return &FileKeys{path: path}
}

func (k *FileKeys) PublicKey(kid string) (ed25519.PublicKey, bool) {
	k.mu.Lock()
	if k.set == nil {
		set, err := egress.NewFileKeySet(k.path, keyFileCheckInterval)
		if err != nil {
			k.mu.Unlock()
			return nil, false
		}
		k.set = set
	}
	set := k.set
	k.mu.Unlock()

	return set.PublicKey(kid)
}
