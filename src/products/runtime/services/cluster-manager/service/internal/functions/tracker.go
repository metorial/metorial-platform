package functions

import (
	"context"
	"math/rand/v2"
	"sync"
	"time"
)

// Tracker records invocations in memory and decides when a version's last-invoked-at
// annotation is due for a write: immediately for the first invocation seen, then at most once
// per interval (plus jitter) per version.
type Tracker struct {
	mu       sync.Mutex
	now      func() time.Time
	interval time.Duration
	jitter   func(time.Duration) time.Duration
	versions map[string]*trackedVersion
}

type trackedVersion struct {
	name        string
	lastInvoked time.Time
	flushedAt   time.Time
	flushedTo   time.Time
	nextFlush   time.Time
}

type Flush struct {
	VersionID string
	Name      string
	At        time.Time
}

func NewTracker(interval time.Duration, now func() time.Time) *Tracker {
	return &Tracker{
		now:      now,
		interval: interval,
		jitter: func(max time.Duration) time.Duration {
			if max <= 0 {
				return 0
			}
			return rand.N(max)
		},
		versions: map[string]*trackedVersion{},
	}
}

func (t *Tracker) Record(versionID, name string) {
	t.mu.Lock()
	defer t.mu.Unlock()

	v, ok := t.versions[versionID]
	if !ok {
		v = &trackedVersion{name: name}
		t.versions[versionID] = v
	}
	v.lastInvoked = t.now()
}

func (t *Tracker) LastInvoked(versionID string) (time.Time, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()

	v, ok := t.versions[versionID]
	if !ok {
		return time.Time{}, false
	}
	return v.lastInvoked, true
}

// Due returns the versions whose annotation should be written now and marks them flushed.
// Call Failed for a flush that couldn't be written so it's retried on the next pass.
func (t *Tracker) Due() []Flush {
	t.mu.Lock()
	defer t.mu.Unlock()

	now := t.now()
	var due []Flush
	for id, v := range t.versions {
		if !v.lastInvoked.After(v.flushedTo) || now.Before(v.nextFlush) {
			continue
		}
		due = append(due, Flush{VersionID: id, Name: v.name, At: v.lastInvoked})
		v.flushedAt = now
		v.flushedTo = v.lastInvoked
		v.nextFlush = now.Add(t.interval + t.jitter(t.interval/5))
	}
	return due
}

func (t *Tracker) Failed(f Flush) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if v, ok := t.versions[f.VersionID]; ok && v.flushedTo.Equal(f.At) {
		v.flushedTo = time.Time{}
		v.nextFlush = time.Time{}
	}
}

func (t *Tracker) Forget(versionID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.versions, versionID)
}

// Prune drops versions not invoked for longer than maxAge, once their last use is flushed.
func (t *Tracker) Prune(maxAge time.Duration) {
	t.mu.Lock()
	defer t.mu.Unlock()

	cutoff := t.now().Add(-maxAge)
	for id, v := range t.versions {
		if v.lastInvoked.Before(cutoff) && !v.lastInvoked.After(v.flushedTo) {
			delete(t.versions, id)
		}
	}
}

func (t *Tracker) Run(ctx context.Context, tick time.Duration, flush func(context.Context, Flush) error) {
	ticker := time.NewTicker(tick)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}

		for _, f := range t.Due() {
			if err := flush(ctx, f); err != nil {
				t.Failed(f)
			}
		}
		t.Prune(24 * time.Hour)
	}
}
