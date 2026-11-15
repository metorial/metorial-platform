package egress

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"
)

// Keys resolves verification keys by kid.
type Keys interface {
	PublicKey(kid string) (ed25519.PublicKey, bool)
}

type KeySet struct {
	keys map[string]ed25519.PublicKey
}

type keySetJSON struct {
	Keys map[string]string `json:"keys"`
}

func NewKeySet(keys map[string]ed25519.PublicKey) *KeySet {
	copied := make(map[string]ed25519.PublicKey, len(keys))
	for kid, key := range keys {
		copied[kid] = key
	}
	return &KeySet{keys: copied}
}

// ParseKeySet parses {"keys": {"<kid>": "<base64url raw Ed25519 public key>"}}.
func ParseKeySet(data []byte) (*KeySet, error) {
	var raw keySetJSON
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("egress: invalid key set: %w", err)
	}
	if raw.Keys == nil {
		return nil, errors.New("egress: key set has no keys object")
	}

	keys := make(map[string]ed25519.PublicKey, len(raw.Keys))
	for kid, encoded := range raw.Keys {
		if kid == "" {
			return nil, errors.New("egress: key set contains an empty kid")
		}
		key, err := DecodePublicKey(encoded)
		if err != nil {
			return nil, fmt.Errorf("egress: key %q: %w", kid, err)
		}
		keys[kid] = key
	}
	return &KeySet{keys: keys}, nil
}

func (k *KeySet) PublicKey(kid string) (ed25519.PublicKey, bool) {
	if k == nil {
		return nil, false
	}
	key, ok := k.keys[kid]
	return key, ok
}

func (k *KeySet) Len() int {
	if k == nil {
		return 0
	}
	return len(k.keys)
}

func (k *KeySet) MarshalJSON() ([]byte, error) {
	raw := keySetJSON{Keys: map[string]string{}}
	if k != nil {
		for kid, key := range k.keys {
			raw.Keys[kid] = EncodePublicKey(key)
		}
	}
	return json.Marshal(raw)
}

func DecodePublicKey(encoded string) (ed25519.PublicKey, error) {
	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, errors.New("public key is not base64url without padding")
	}
	if len(raw) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("public key must be %d bytes", ed25519.PublicKeySize)
	}
	return ed25519.PublicKey(raw), nil
}

func EncodePublicKey(key ed25519.PublicKey) string {
	return base64.RawURLEncoding.EncodeToString(key)
}

// KeyID is the default kid: the first 16 hex characters of sha256(public key).
func KeyID(key ed25519.PublicKey) string {
	sum := sha256.Sum256(key)
	return hex.EncodeToString(sum[:])[:16]
}

type SigningKey struct {
	KeyID      string
	PrivateKey ed25519.PrivateKey
}

func NewSigningKey(seed []byte, kid string) (*SigningKey, error) {
	if len(seed) != ed25519.SeedSize {
		return nil, fmt.Errorf("egress: signing key seed must be %d bytes", ed25519.SeedSize)
	}
	private := ed25519.NewKeyFromSeed(seed)
	if kid == "" {
		kid = KeyID(private.Public().(ed25519.PublicKey))
	}
	return &SigningKey{KeyID: kid, PrivateKey: private}, nil
}

// ParseSigningKey decodes a base64url (no padding) 32-byte seed. An empty kid selects
// the default derived from the public key.
func ParseSigningKey(seed string, kid string) (*SigningKey, error) {
	raw, err := base64.RawURLEncoding.DecodeString(seed)
	if err != nil {
		return nil, errors.New("egress: signing key is not base64url without padding")
	}
	return NewSigningKey(raw, kid)
}

func (k *SigningKey) PublicKey() ed25519.PublicKey {
	return k.PrivateKey.Public().(ed25519.PublicKey)
}

// FileKeySet serves a key set file and re-reads it when its modification time or size
// changes. A file that fails to parse keeps the last good key set in place.
type FileKeySet struct {
	path          string
	checkInterval time.Duration
	now           func() time.Time

	mu        sync.Mutex
	current   *KeySet
	modTime   time.Time
	size      int64
	checkedAt time.Time
	lastErr   error
}

func NewFileKeySet(path string, checkInterval time.Duration) (*FileKeySet, error) {
	f := &FileKeySet{path: path, checkInterval: checkInterval, now: time.Now}
	if err := f.reload(); err != nil {
		return nil, err
	}
	return f, nil
}

func (f *FileKeySet) PublicKey(kid string) (ed25519.PublicKey, bool) {
	f.mu.Lock()
	if f.now().Sub(f.checkedAt) >= f.checkInterval {
		f.mu.Unlock()
		_ = f.reload()
		f.mu.Lock()
	}
	current := f.current
	f.mu.Unlock()
	return current.PublicKey(kid)
}

// LastError reports the most recent reload failure, if the file is currently unreadable.
func (f *FileKeySet) LastError() error {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.lastErr
}

func (f *FileKeySet) reload() error {
	now := f.now()
	info, err := os.Stat(f.path)

	f.mu.Lock()
	f.checkedAt = now
	if err == nil && f.current != nil && info.ModTime().Equal(f.modTime) && info.Size() == f.size {
		f.lastErr = nil
		f.mu.Unlock()
		return nil
	}
	f.mu.Unlock()

	if err != nil {
		return f.fail(err)
	}
	data, err := os.ReadFile(f.path)
	if err != nil {
		return f.fail(err)
	}
	set, err := ParseKeySet(data)
	if err != nil {
		return f.fail(err)
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.current = set
	f.modTime = info.ModTime()
	f.size = info.Size()
	f.lastErr = nil
	return nil
}

func (f *FileKeySet) fail(err error) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lastErr = err
	return err
}
