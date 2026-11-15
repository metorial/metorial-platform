package functions

import (
	"testing"
	"time"
)

type fakeClock struct{ t time.Time }

func (c *fakeClock) now() time.Time          { return c.t }
func (c *fakeClock) advance(d time.Duration) { c.t = c.t.Add(d) }

func newTestTracker(clock *fakeClock) *Tracker {
	tr := NewTracker(5*time.Minute, clock.now)
	tr.jitter = func(max time.Duration) time.Duration { return max }
	return tr
}

func TestTrackerFlushesFirstInvocationImmediately(t *testing.T) {
	clock := &fakeClock{t: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	tr := newTestTracker(clock)

	tr.Record("v1", "fn-a")
	due := tr.Due()
	if len(due) != 1 || due[0].VersionID != "v1" || due[0].Name != "fn-a" || !due[0].At.Equal(clock.t) {
		t.Fatalf("unexpected flush: %+v", due)
	}
	if due := tr.Due(); len(due) != 0 {
		t.Fatalf("nothing new to flush, got %+v", due)
	}
}

func TestTrackerRateLimitsPerVersion(t *testing.T) {
	clock := &fakeClock{t: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	tr := newTestTracker(clock)

	tr.Record("v1", "fn-a")
	tr.Due()

	clock.advance(time.Minute)
	tr.Record("v1", "fn-a")
	if due := tr.Due(); len(due) != 0 {
		t.Fatalf("flushed again within the interval: %+v", due)
	}

	clock.advance(4*time.Minute + 59*time.Second)
	if due := tr.Due(); len(due) != 0 {
		t.Fatalf("flushed before interval plus jitter elapsed: %+v", due)
	}

	clock.advance(time.Second)
	due := tr.Due()
	if len(due) != 1 || !due[0].At.Equal(clock.t.Add(-5*time.Minute)) {
		t.Fatalf("expected the latest invocation to flush, got %+v", due)
	}
}

func TestTrackerRetriesFailedFlush(t *testing.T) {
	clock := &fakeClock{t: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	tr := newTestTracker(clock)

	tr.Record("v1", "fn-a")
	due := tr.Due()
	tr.Failed(due[0])
	if again := tr.Due(); len(again) != 1 {
		t.Fatalf("failed flush not retried: %+v", again)
	}
}

func TestTrackerPrune(t *testing.T) {
	clock := &fakeClock{t: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)}
	tr := newTestTracker(clock)

	tr.Record("flushed", "fn-a")
	tr.Record("pending", "fn-b")
	for _, f := range tr.Due() {
		if f.VersionID == "pending" {
			tr.Failed(f)
		}
	}

	clock.advance(25 * time.Hour)
	tr.Prune(24 * time.Hour)
	if _, ok := tr.LastInvoked("flushed"); ok {
		t.Fatal("flushed version should be pruned")
	}
	if _, ok := tr.LastInvoked("pending"); !ok {
		t.Fatal("unflushed version must be kept")
	}
}
