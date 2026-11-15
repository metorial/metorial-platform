package auth

import (
	"sync"
	"time"
)

const (
	DefaultReplayCacheSize = 100_000
	replayPruneInterval    = 30 * time.Second
)

// ReplayCache remembers invocation ids until their token expires. When full it refuses new
// ids instead of evicting live ones, so a flood can't make an old token replayable.
type ReplayCache struct {
	max int
	now func() time.Time

	mu       sync.Mutex
	entries  map[string]time.Time
	prunedAt time.Time
}

func NewReplayCache(max int, now func() time.Time) *ReplayCache {
	if max <= 0 {
		max = DefaultReplayCacheSize
	}
	if now == nil {
		now = time.Now
	}
	return &ReplayCache{max: max, now: now, entries: map[string]time.Time{}}
}

func (c *ReplayCache) Add(jti string, expiresAt time.Time) *Rejection {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := c.now()
	if exp, ok := c.entries[jti]; ok && now.Before(exp) {
		return reject("replayed", "")
	}

	if now.Sub(c.prunedAt) >= replayPruneInterval {
		c.prune(now)
	}
	if len(c.entries) >= c.max {
		c.prune(now)
		if len(c.entries) >= c.max {
			return reject("replay_cache_full", "")
		}
	}

	c.entries[jti] = expiresAt
	return nil
}

func (c *ReplayCache) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.entries)
}

func (c *ReplayCache) prune(now time.Time) {
	c.prunedAt = now
	for jti, exp := range c.entries {
		if !now.Before(exp) {
			delete(c.entries, jti)
		}
	}
}
