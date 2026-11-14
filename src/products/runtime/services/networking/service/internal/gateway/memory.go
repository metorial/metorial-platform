package gateway

import (
	"net/netip"
	"sync"
	"time"
)

const (
	maxRememberedAddrsPerGrant = 4096
	maxRememberedGrants        = 200_000
)

// ResolveMemory remembers, per grant until it expires, which hostname each resolved IP
// was handed out for, so a later CONNECT to the IP is evaluated against host rules.
type ResolveMemory struct {
	mu     sync.Mutex
	now    func() time.Time
	grants map[string]*rememberedGrant
}

type rememberedGrant struct {
	expires time.Time
	hosts   map[netip.Addr]string
}

func NewResolveMemory() *ResolveMemory {
	return &ResolveMemory{now: time.Now, grants: map[string]*rememberedGrant{}}
}

func (m *ResolveMemory) Remember(grantID string, expires time.Time, host string, addrs []netip.Addr) {
	if m == nil || len(addrs) == 0 {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	entry, ok := m.grants[grantID]
	if !ok {
		if len(m.grants) >= maxRememberedGrants {
			m.pruneLocked()
			if len(m.grants) >= maxRememberedGrants {
				return
			}
		}
		entry = &rememberedGrant{hosts: map[netip.Addr]string{}}
		m.grants[grantID] = entry
	}
	if expires.After(entry.expires) {
		entry.expires = expires
	}

	for _, addr := range addrs {
		if _, exists := entry.hosts[addr]; !exists && len(entry.hosts) >= maxRememberedAddrsPerGrant {
			continue
		}
		entry.hosts[addr] = host
	}
}

func (m *ResolveMemory) Lookup(grantID string, addr netip.Addr) string {
	if m == nil {
		return ""
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	entry, ok := m.grants[grantID]
	if !ok || !m.now().Before(entry.expires) {
		return ""
	}
	return entry.hosts[addr]
}

func (m *ResolveMemory) Prune() {
	if m == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pruneLocked()
}

func (m *ResolveMemory) Len() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.grants)
}

func (m *ResolveMemory) pruneLocked() {
	now := m.now()
	for id, entry := range m.grants {
		if !now.Before(entry.expires) {
			delete(m.grants, id)
		}
	}
}
