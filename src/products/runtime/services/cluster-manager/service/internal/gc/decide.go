package gc

import (
	"sort"
	"time"
)

type Reason string

const (
	ReasonSpeculativeTTL Reason = "speculative_ttl"
	ReasonIdleTTL        Reason = "idle_ttl"
	ReasonCap            Reason = "cap"
)

type Candidate struct {
	Name          string
	UID           string
	VersionID     string
	Speculative   bool
	CreatedAt     time.Time
	LastInvokedAt *time.Time
	Pods          int
}

func (c *Candidate) lastUsed() time.Time {
	if c.LastInvokedAt != nil && c.LastInvokedAt.After(c.CreatedAt) {
		return *c.LastInvokedAt
	}
	return c.CreatedAt
}

type Policy struct {
	SpeculativeTTL  time.Duration
	IdleTTL         time.Duration
	MaxMaterialized int
	// Warm versions used within this window are never evicted to make room.
	ProtectWindow time.Duration
}

type Eviction struct {
	Candidate Candidate
	Reason    Reason
}

// Decide returns what one GC pass evicts: TTL expiries first, then least recently used versions
// until the cap holds again.
func Decide(now time.Time, candidates []Candidate, p Policy) []Eviction {
	var evictions []Eviction
	var kept []Candidate

	for _, c := range candidates {
		switch {
		case c.LastInvokedAt == nil && c.Speculative && now.Sub(c.CreatedAt) > p.SpeculativeTTL:
			evictions = append(evictions, Eviction{Candidate: c, Reason: ReasonSpeculativeTTL})
		case (c.LastInvokedAt != nil || !c.Speculative) && now.Sub(c.lastUsed()) > p.IdleTTL:
			evictions = append(evictions, Eviction{Candidate: c, Reason: ReasonIdleTTL})
		default:
			kept = append(kept, c)
		}
	}

	if excess := len(kept) - p.MaxMaterialized; excess > 0 {
		for _, c := range SelectLRU(now, kept, excess, p.ProtectWindow) {
			evictions = append(evictions, Eviction{Candidate: c, Reason: ReasonCap})
		}
	}
	return evictions
}

// SelectLRU picks up to n versions to evict, preferring versions without pods and then the least
// recently used. Warm versions used within protect are never picked, so fewer than n may be
// returned.
func SelectLRU(now time.Time, candidates []Candidate, n int, protect time.Duration) []Candidate {
	if n <= 0 {
		return nil
	}

	eligible := make([]Candidate, 0, len(candidates))
	for _, c := range candidates {
		if c.Pods > 0 && now.Sub(c.lastUsed()) < protect {
			continue
		}
		eligible = append(eligible, c)
	}

	sort.SliceStable(eligible, func(i, j int) bool {
		a, b := eligible[i], eligible[j]
		if (a.Pods == 0) != (b.Pods == 0) {
			return a.Pods == 0
		}
		if !a.lastUsed().Equal(b.lastUsed()) {
			return a.lastUsed().Before(b.lastUsed())
		}
		return a.Name < b.Name
	})

	if len(eligible) > n {
		eligible = eligible[:n]
	}
	return eligible
}
